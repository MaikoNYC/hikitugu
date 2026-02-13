import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto.ts";
import { generateSectionContent } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  document_id: string;
  job_id: string;
}

interface SectionDef {
  order: number;
  title: string;
  level: number;
  description?: string;
  estimated_sources?: string[];
}

// ── Helper: update generation job progress ────────────────────────────

async function updateJob(
  supabase: SupabaseClient,
  jobId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("generation_jobs")
    .update(fields)
    .eq("id", jobId);
}

// ── Google Calendar API ───────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string | null;
  attendees: string[];
  location: string | null;
  url: string;
}

async function fetchCalendarEvents(
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  targetEmail?: string | null,
): Promise<CalendarEvent[]> {
  const timeMin = new Date(`${dateFrom}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${dateTo}T23:59:59Z`).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const items: unknown[] = data.items ?? [];
  const results: CalendarEvent[] = [];

  for (const raw of items) {
    const event = raw as Record<string, unknown>;
    const attendees = ((event.attendees as Array<Record<string, string>>) ?? [])
      .map((a) => a.email ?? "");

    if (targetEmail && !attendees.includes(targetEmail)) {
      continue;
    }

    const startObj = (event.start as Record<string, string>) ?? {};
    const endObj = (event.end as Record<string, string>) ?? {};

    results.push({
      id: (event.id as string) ?? "",
      title: (event.summary as string) ?? "",
      start: startObj.dateTime ?? startObj.date ?? "",
      end: endObj.dateTime ?? endObj.date ?? "",
      description: (event.description as string) ?? null,
      attendees,
      location: (event.location as string) ?? null,
      url: (event.htmlLink as string) ?? "",
    });
  }

  return results;
}

// ── Slack API ─────────────────────────────────────────────────────────

interface SlackMessage {
  id: string;
  user: string;
  user_name: string;
  text: string;
  timestamp: string;
  thread_replies: Array<{
    id: string;
    user_name: string;
    text: string;
    timestamp: string;
  }>;
  url: string;
}

async function slackApi(
  token: string,
  method: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = `https://slack.com/api/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  return await res.json();
}

async function fetchSlackMessages(
  accessToken: string,
  channelId: string,
  dateFrom: string,
  dateTo: string,
): Promise<SlackMessage[]> {
  const oldest = String(new Date(`${dateFrom}T00:00:00Z`).getTime() / 1000);
  const latest = String(new Date(`${dateTo}T23:59:59Z`).getTime() / 1000);

  const history = await slackApi(accessToken, "conversations.history", {
    channel: channelId,
    oldest,
    latest,
  });

  const messages = (history.messages as Array<Record<string, unknown>>) ?? [];
  const userCache: Record<string, string> = {};

  async function resolveUser(userId: string): Promise<string> {
    if (userCache[userId]) return userCache[userId];
    try {
      const info = await slackApi(accessToken, "users.info", { user: userId });
      const user = info.user as Record<string, unknown>;
      const name =
        (user?.real_name as string) || (user?.name as string) || userId;
      userCache[userId] = name;
      return name;
    } catch {
      userCache[userId] = userId;
      return userId;
    }
  }

  const results: SlackMessage[] = [];

  for (const msg of messages) {
    const userId = (msg.user as string) ?? "";
    const userName = await resolveUser(userId);
    const ts = (msg.ts as string) ?? "";

    // Fetch thread replies if present
    const threadReplies: SlackMessage["thread_replies"] = [];
    if (msg.thread_ts && (msg.reply_count as number) > 0) {
      const repliesData = await slackApi(
        accessToken,
        "conversations.replies",
        { channel: channelId, ts: msg.thread_ts as string },
      );
      const replyMsgs =
        (repliesData.messages as Array<Record<string, unknown>>) ?? [];
      // Skip first message (parent) per Python implementation
      for (const reply of replyMsgs.slice(1)) {
        const replyUser = await resolveUser((reply.user as string) ?? "");
        threadReplies.push({
          id: (reply.ts as string) ?? "",
          user_name: replyUser,
          text: (reply.text as string) ?? "",
          timestamp: (reply.ts as string) ?? "",
        });
      }
    }

    results.push({
      id: ts,
      user: userId,
      user_name: userName,
      text: (msg.text as string) ?? "",
      timestamp: ts,
      thread_replies: threadReplies,
      url: `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`,
    });
  }

  return results;
}

// ── Google Sheets API ─────────────────────────────────────────────────

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

interface SpreadsheetResult {
  id: string;
  title: string;
  sheets: SheetData[];
}

async function fetchSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetResult> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Fetch metadata
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    { headers },
  );
  if (!metaRes.ok) {
    const text = await metaRes.text();
    throw new Error(`Sheets API error (${metaRes.status}): ${text}`);
  }
  const metadata = await metaRes.json();
  const title =
    (metadata.properties as Record<string, string>)?.title ?? "";
  const sheetList: Array<Record<string, unknown>> =
    metadata.sheets ?? [];

  const sheetsData: SheetData[] = [];

  for (const sheet of sheetList) {
    const props = sheet.properties as Record<string, unknown>;
    const name = (props?.title as string) ?? "";

    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(name)}`,
      { headers },
    );
    if (!valuesRes.ok) continue;

    const valuesData = await valuesRes.json();
    const values: string[][] = valuesData.values ?? [];
    const sheetHeaders = values.length > 0 ? values[0] : [];
    const rows = values.length > 1 ? values.slice(1) : [];

    sheetsData.push({ name, headers: sheetHeaders, rows });
  }

  return { id: spreadsheetId, title, sheets: sheetsData };
}

// ── Data aggregation ──────────────────────────────────────────────────

function aggregateData(
  calendarEvents: CalendarEvent[],
  slackMessages: SlackMessage[],
  spreadsheetData: SpreadsheetResult[],
): Record<string, unknown> {
  return {
    summary: {
      calendar_events_count: calendarEvents.length,
      slack_messages_count: slackMessages.length,
      spreadsheet_rows_count: spreadsheetData.reduce(
        (sum, ss) => sum + ss.sheets.reduce((s, sh) => s + sh.rows.length, 0),
        0,
      ),
    },
    calendar_events: calendarEvents,
    slack_messages: slackMessages,
    spreadsheet_data: spreadsheetData,
  };
}

// ── Edge Function handler ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let documentId = "";
  let jobId = "";

  try {
    const body: GenerateRequest = await req.json();
    documentId = body.document_id;
    jobId = body.job_id;

    // ── Step 1: Update job status to processing ─────────────────────
    await updateJob(supabase, jobId, {
      status: "processing",
      current_step: "データ取得中",
      progress: 0,
      started_at: new Date().toISOString(),
    });

    // ── Step 2: Fetch document details ──────────────────────────────
    const { data: document } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (!document) {
      throw new Error("Document not found");
    }

    // ── Step 3: Determine sections from template or proposal ────────
    let sectionsToGenerate: SectionDef[] = [];

    if (
      document.generation_mode === "template" &&
      document.template_id
    ) {
      const { data: tmpl } = await supabase
        .from("templates")
        .select("parsed_structure")
        .eq("id", document.template_id)
        .single();

      if (tmpl?.parsed_structure?.sections) {
        sectionsToGenerate = tmpl.parsed_structure.sections;
      }
    } else {
      // ai_proposal mode: get most recent approved proposal
      const { data: proposals } = await supabase
        .from("ai_proposals")
        .select("proposed_structure")
        .eq("document_id", documentId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1);

      if (proposals && proposals.length > 0) {
        const proposed = proposals[0].proposed_structure ?? [];
        sectionsToGenerate = proposed.map(
          (
            sec: { title?: string; description?: string; estimated_sources?: string[] },
            i: number,
          ) => ({
            order: i + 1,
            title: sec.title ?? "",
            level: 1,
            description: sec.description ?? "",
            estimated_sources: sec.estimated_sources ?? [],
          }),
        );
      }
    }

    // Fallback: default 3 sections
    if (sectionsToGenerate.length === 0) {
      sectionsToGenerate = [
        { order: 1, title: "概要", level: 1, description: "引き継ぎの概要" },
        { order: 2, title: "担当業務", level: 1, description: "担当業務の一覧" },
        { order: 3, title: "引き継ぎ事項", level: 1, description: "引き継ぎが必要な事項" },
      ];
    }

    const totalSteps = sectionsToGenerate.length + 1;

    // ── Step 4: Fetch source data ───────────────────────────────────
    await updateJob(supabase, jobId, {
      current_step: "データソースからデータを取得中",
      progress: Math.floor(100 / totalSteps),
    });

    let calendarEvents: CalendarEvent[] = [];
    let slackMessages: SlackMessage[] = [];
    let spreadsheetData: SpreadsheetResult[] = [];

    const dataSources: string[] = document.data_sources ?? [];
    const metadata: Record<string, unknown> = document.metadata ?? {};

    // Resolve user ID for token lookup
    const userId = document.created_by;

    // Calendar
    if (userId && dataSources.includes("calendar")) {
      const { data: tokenRow } = await supabase
        .from("oauth_tokens")
        .select("encrypted_access_token")
        .eq("user_id", userId)
        .eq("provider", "google")
        .maybeSingle();

      if (tokenRow) {
        const googleToken = await decryptToken(tokenRow.encrypted_access_token);
        const dateFrom = document.date_range_start ?? "";
        const dateTo = document.date_range_end ?? "";
        if (dateFrom && dateTo) {
          calendarEvents = await fetchCalendarEvents(
            googleToken,
            dateFrom,
            dateTo,
            document.target_user_email,
          );
        }
      }
    }

    // Slack
    if (userId && dataSources.includes("slack")) {
      const { data: tokenRow } = await supabase
        .from("oauth_tokens")
        .select("encrypted_access_token")
        .eq("user_id", userId)
        .eq("provider", "slack")
        .maybeSingle();

      if (tokenRow) {
        const slackToken = await decryptToken(tokenRow.encrypted_access_token);
        const dateFrom = document.date_range_start ?? "";
        const dateTo = document.date_range_end ?? "";
        const channelIds = (metadata.slack_channel_ids as string[]) ?? [];

        for (const chId of channelIds) {
          if (dateFrom && dateTo) {
            const msgs = await fetchSlackMessages(slackToken, chId, dateFrom, dateTo);
            slackMessages.push(...msgs);
          }
        }
      }
    }

    // Spreadsheets
    if (userId && dataSources.includes("spreadsheet")) {
      const { data: tokenRow } = await supabase
        .from("oauth_tokens")
        .select("encrypted_access_token")
        .eq("user_id", userId)
        .eq("provider", "google")
        .maybeSingle();

      if (tokenRow) {
        const googleToken = await decryptToken(tokenRow.encrypted_access_token);
        const ssIds = (metadata.spreadsheet_ids as string[]) ?? [];

        for (const ssId of ssIds) {
          const ss = await fetchSpreadsheet(googleToken, ssId);
          spreadsheetData.push(ss);
        }
      }
    }

    // ── Step 5: Aggregate data ──────────────────────────────────────
    await updateJob(supabase, jobId, {
      current_step: "データ処理中",
      progress: 35,
    });

    const aggregated = aggregateData(calendarEvents, slackMessages, spreadsheetData);

    // ── Step 6: Generate each section with Gemini ───────────────────
    for (let i = 0; i < sectionsToGenerate.length; i++) {
      const sectionDef = sectionsToGenerate[i];
      const stepNum = i + 2;
      const progress = Math.floor((stepNum / totalSteps) * 100);

      await updateJob(supabase, jobId, {
        current_step: `セクション生成中: ${sectionDef.title}`,
        progress,
      });

      // Filter source data by estimated_sources (like Python generation.py)
      const sourceData: unknown[] = [];
      const estSources = sectionDef.estimated_sources ?? [];

      if (estSources.length === 0) {
        sourceData.push(
          { type: "calendar", data: aggregated.calendar_events },
          { type: "slack", data: aggregated.slack_messages },
          { type: "spreadsheet", data: aggregated.spreadsheet_data },
        );
      } else {
        if (estSources.includes("calendar")) {
          sourceData.push({ type: "calendar", data: aggregated.calendar_events });
        }
        if (estSources.includes("slack")) {
          sourceData.push({ type: "slack", data: aggregated.slack_messages });
        }
        if (estSources.includes("spreadsheet")) {
          sourceData.push({ type: "spreadsheet", data: aggregated.spreadsheet_data });
        }
      }

      const content = await generateSectionContent(
        geminiApiKey,
        sectionDef.title,
        sectionDef.description ?? "",
        sourceData,
      );

      const sourceTags = estSources.length > 0 ? estSources : dataSources;

      await supabase.from("document_sections").insert({
        document_id: documentId,
        section_order: sectionDef.order ?? i + 1,
        title: sectionDef.title,
        content,
        source_tags: sourceTags,
        source_references: [],
        is_ai_generated: true,
      });
    }

    // ── Step 7: Mark as completed ───────────────────────────────────
    await supabase
      .from("documents")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", documentId);

    await updateJob(supabase, jobId, {
      status: "completed",
      progress: 100,
      current_step: "完了",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, document_id: documentId, job_id: jobId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Update job/document status to failed
    try {
      if (jobId) {
        await updateJob(supabase, jobId, {
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        });
      }
      if (documentId) {
        await supabase
          .from("documents")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", documentId);
      }
    } catch {
      // Best effort
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
