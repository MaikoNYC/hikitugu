import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  document_id: string;
  job_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { document_id, job_id }: GenerateRequest = await req.json();

    // Step 1: Update job status to processing
    await supabase
      .from("generation_jobs")
      .update({
        status: "processing",
        current_step: "fetching_data",
        progress: 0,
        started_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    // Step 2: Fetch document details
    const { data: document } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (!document) {
      throw new Error("Document not found");
    }

    // Step 3: Fetch data from sources (progress: 0-30%)
    await supabase
      .from("generation_jobs")
      .update({ progress: 10, current_step: "fetching_data" })
      .eq("id", job_id);

    // TODO: Fetch from Google Calendar API
    // TODO: Fetch from Slack API
    // TODO: Fetch from Google Sheets API

    // Step 4: Process and aggregate data (progress: 30-40%)
    await supabase
      .from("generation_jobs")
      .update({ progress: 35, current_step: "processing_data" })
      .eq("id", job_id);

    // TODO: Sort by timeline, deduplicate, normalize

    // Step 5: Generate content with Gemini AI (progress: 40-80%)
    await supabase
      .from("generation_jobs")
      .update({ progress: 50, current_step: "generating_content" })
      .eq("id", job_id);

    // TODO: Call Gemini API to generate section content
    // For each section in template/proposal structure:
    //   - Build prompt with relevant data
    //   - Call Gemini API
    //   - Store result

    // Step 6: Save sections (progress: 80-100%)
    await supabase
      .from("generation_jobs")
      .update({ progress: 85, current_step: "saving" })
      .eq("id", job_id);

    // TODO: Insert document_sections records

    // Step 7: Mark as completed
    await supabase
      .from("documents")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", document_id);

    await supabase
      .from("generation_jobs")
      .update({
        status: "completed",
        progress: 100,
        current_step: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({ success: true, document_id, job_id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Update job status to failed
    try {
      const body = await new Request(req.url, { body: req.body }).json().catch(() => ({}));
      if (body.job_id) {
        await supabase
          .from("generation_jobs")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", body.job_id);
      }
      if (body.document_id) {
        await supabase
          .from("documents")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", body.document_id);
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
