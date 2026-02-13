import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Parse file structure based on type
    let parsedStructure: { sections: Array<{ order: number; title: string; level: number }> };

    if (file_type === "docx") {
      // TODO: Implement DOCX parsing using a Deno-compatible library
      // For now, return a placeholder structure
      parsedStructure = {
        sections: [
          { order: 1, title: "セクション1", level: 1 },
          { order: 2, title: "セクション2", level: 1 },
        ],
      };
    } else if (file_type === "pdf") {
      // TODO: Implement PDF parsing
      parsedStructure = {
        sections: [
          { order: 1, title: "セクション1", level: 1 },
        ],
      };
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
      JSON.stringify({ success: true, template_id }),
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
