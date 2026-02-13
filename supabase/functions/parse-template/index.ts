import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/build/pdf.js?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParseRequest {
  template_id: string;
  file_path: string;
  file_type: "docx" | "pdf";
}

interface Section {
  order: number;
  title: string;
  level: number;
}

// ── DOCX parsing ──────────────────────────────────────────────────────

const HEADING_STYLE_MAP: Record<string, number> = {
  Heading1: 1,
  "Heading 1": 1,
  Heading2: 2,
  "Heading 2": 2,
  Heading3: 3,
  "Heading 3": 3,
  Heading4: 4,
  "Heading 4": 4,
};

/**
 * Parse a DOCX file (ZIP containing XML) to extract heading structure.
 * Mirrors Python template_parser.py:_parse_docx().
 *
 * DOCX paragraphs with Heading styles (1-4) are extracted as sections.
 * The XML layout is: <w:p> → <w:pPr> → <w:pStyle w:val="Heading1"/>
 * and text lives in <w:r> → <w:t>.
 */
async function parseDocx(fileBytes: ArrayBuffer): Promise<{ sections: Section[] }> {
  const zip = await JSZip.loadAsync(fileBytes);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) {
    throw new Error("Invalid DOCX: word/document.xml not found");
  }

  const sections: Section[] = [];
  let order = 0;

  // Split into paragraphs (<w:p ...>...</w:p>)
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;

  while ((paraMatch = paraRegex.exec(docXml)) !== null) {
    const paraXml = paraMatch[0];

    // Look for paragraph style: <w:pStyle w:val="Heading1"/>
    const styleMatch = paraXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
    if (!styleMatch) continue;

    const styleName = styleMatch[1];
    const level = HEADING_STYLE_MAP[styleName];
    if (level === undefined) continue;

    // Extract all text runs: <w:t>...</w:t> and <w:t xml:space="preserve">...</w:t>
    const textParts: string[] = [];
    const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(paraXml)) !== null) {
      textParts.push(textMatch[1]);
    }

    const title = textParts.join("").trim();
    if (title) {
      order++;
      sections.push({ order, title, level });
    }
  }

  return { sections };
}

// ── PDF parsing ───────────────────────────────────────────────────────

/**
 * Heading detection pattern matching Python template_parser.py:_parse_pdf().
 * Matches:
 *   - 第一章, 第2節, 第三条 etc.
 *   - 1. , 2) , 3）
 *   - I. , IV) , ii）
 */
const HEADING_PATTERN =
  /^(?:第[一二三四五六七八九十\d]+[章節条項]|[\d]+[.\)）]\s*|[IVXivx]+[.\)）]\s*)/;

/**
 * Parse a PDF file to extract heading structure.
 * Uses pdfjs-dist for text extraction, then regex + heuristics.
 */
async function parsePdf(fileBytes: ArrayBuffer): Promise<{ sections: Section[] }> {
  // Disable worker (not available in Deno edge runtime)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(fileBytes) }).promise;
  const sections: Section[] = [];
  let order = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Reconstruct lines from text items
    const lines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const y = (item as { transform: number[] }).transform[5];
      // New line if Y position changes significantly
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = "";
      }
      currentLine += (item as { str: string }).str;
      lastY = y;
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    for (const line of lines) {
      if (!line) continue;
      // Match heading pattern or uppercase short text (< 60 chars)
      if (
        HEADING_PATTERN.test(line) ||
        (line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line))
      ) {
        order++;
        sections.push({ order, title: line, level: 1 });
      }
    }
  }

  return { sections };
}

// ── Edge Function handler ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { template_id, file_path, file_type }: ParseRequest = await req.json();

    // Update status to processing
    await supabase
      .from("templates")
      .update({ status: "processing" })
      .eq("id", template_id);

    // Download file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("templates")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const fileBytes = await fileData.arrayBuffer();

    // Parse file structure based on type
    let parsedStructure: { sections: Section[] };

    if (file_type === "docx") {
      parsedStructure = await parseDocx(fileBytes);
    } else if (file_type === "pdf") {
      parsedStructure = await parsePdf(fileBytes);
    } else {
      throw new Error(`Unsupported file type: ${file_type}`);
    }

    // Update template with parsed structure
    const { error: updateError } = await supabase
      .from("templates")
      .update({
        parsed_structure: parsedStructure,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", template_id);

    if (updateError) {
      throw new Error(`Failed to update template: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, template_id, sections: parsedStructure.sections.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Try to update template status to error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const body = await new Request(req.url, { body: req.body }).json().catch(() => ({}));
      if (body.template_id) {
        await supabase
          .from("templates")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", body.template_id);
      }
    } catch {
      // Best effort
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
