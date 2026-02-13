"""Document generation orchestration service."""

import traceback

from app.db.client import get_supabase_admin_client
from app.services.ai import AIService
from app.services.calendar import CalendarService
from app.services.data_aggregator import DataAggregatorService
from app.services.encryption import EncryptionService
from app.services.slack import SlackService
from app.services.spreadsheet import SheetsService


class GenerationService:
    """Orchestrates the document generation process."""

    def __init__(self):
        self._ai = AIService()
        self._calendar = CalendarService()
        self._slack = SlackService()
        self._sheets = SheetsService()
        self._aggregator = DataAggregatorService()
        self._encryption = EncryptionService()

    async def start_generation(
        self,
        document_id: str,
        job_id: str,
    ) -> None:
        """Run the full document generation pipeline.

        Args:
            document_id: The document to generate content for.
            job_id: The generation job tracking ID.
        """
        admin = get_supabase_admin_client()
        try:
            # 1. Update job status
            admin.table("generation_jobs").update({
                "status": "processing",
                "current_step": "データ取得中",
                "started_at": "now()",
            }).eq("id", job_id).execute()

            # 2. Get document
            doc_row = admin.table("documents").select("*").eq("id", document_id).maybe_single().execute()
            if not doc_row.data:
                raise ValueError("Document not found")
            doc = doc_row.data

            # 3. Determine sections from template or proposal
            sections_to_generate = []
            if doc.get("generation_mode") == "template" and doc.get("template_id"):
                tmpl_row = admin.table("templates").select("parsed_structure").eq("id", doc["template_id"]).maybe_single().execute()
                if tmpl_row.data and tmpl_row.data.get("parsed_structure"):
                    sections_to_generate = tmpl_row.data["parsed_structure"].get("sections", [])
            else:
                proposal_row = (
                    admin.table("ai_proposals")
                    .select("proposed_structure")
                    .eq("document_id", document_id)
                    .eq("status", "approved")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if proposal_row.data:
                    proposed = proposal_row.data[0].get("proposed_structure", [])
                    for i, sec in enumerate(proposed):
                        sections_to_generate.append({
                            "order": i + 1,
                            "title": sec.get("title", ""),
                            "level": 1,
                            "description": sec.get("description", ""),
                            "estimated_sources": sec.get("estimated_sources", []),
                        })

            if not sections_to_generate:
                sections_to_generate = [
                    {"order": 1, "title": "概要", "level": 1, "description": "引き継ぎの概要"},
                    {"order": 2, "title": "担当業務", "level": 1, "description": "担当業務の一覧"},
                    {"order": 3, "title": "引き継ぎ事項", "level": 1, "description": "引き継ぎが必要な事項"},
                ]

            total_steps = len(sections_to_generate) + 1

            # 4. Fetch source data
            admin.table("generation_jobs").update({
                "current_step": "データソースからデータを取得中",
                "progress": int(100 / total_steps),
            }).eq("id", job_id).execute()

            calendar_events: list[dict] = []
            slack_messages: list[dict] = []
            spreadsheet_data: list[dict] = []

            user_row = admin.table("users").select("id").eq("id", doc.get("created_by")).maybe_single().execute()
            user_id = user_row.data["id"] if user_row.data else None

            data_sources = doc.get("data_sources", [])
            metadata = doc.get("metadata", {})

            if user_id and "calendar" in data_sources:
                token_row = (
                    admin.table("oauth_tokens")
                    .select("encrypted_access_token")
                    .eq("user_id", user_id)
                    .eq("provider", "google")
                    .maybe_single()
                    .execute()
                )
                if token_row.data:
                    google_token = self._encryption.decrypt(token_row.data["encrypted_access_token"])
                    date_from = doc.get("date_range_start", "")
                    date_to = doc.get("date_range_end", "")
                    if date_from and date_to:
                        calendar_events = await self._calendar.get_events(
                            google_token, date_from, date_to, doc.get("target_user_email")
                        )

            if user_id and "slack" in data_sources:
                token_row = (
                    admin.table("oauth_tokens")
                    .select("encrypted_access_token")
                    .eq("user_id", user_id)
                    .eq("provider", "slack")
                    .maybe_single()
                    .execute()
                )
                if token_row.data:
                    slack_token = self._encryption.decrypt(token_row.data["encrypted_access_token"])
                    date_from = doc.get("date_range_start", "")
                    date_to = doc.get("date_range_end", "")
                    for ch_id in metadata.get("slack_channel_ids", []):
                        if date_from and date_to:
                            msgs = await self._slack.get_messages(slack_token, ch_id, date_from, date_to)
                            slack_messages.extend(msgs)

            if user_id and "spreadsheet" in data_sources:
                token_row = (
                    admin.table("oauth_tokens")
                    .select("encrypted_access_token")
                    .eq("user_id", user_id)
                    .eq("provider", "google")
                    .maybe_single()
                    .execute()
                )
                if token_row.data:
                    google_token = self._encryption.decrypt(token_row.data["encrypted_access_token"])
                    for ss_id in metadata.get("spreadsheet_ids", []):
                        ss = await self._sheets.get_spreadsheet(google_token, ss_id)
                        spreadsheet_data.append(ss)

            aggregated = await self._aggregator.aggregate(calendar_events, slack_messages, spreadsheet_data)

            # 5. Generate each section
            for i, section_def in enumerate(sections_to_generate):
                step_num = i + 2
                progress = int((step_num / total_steps) * 100)

                admin.table("generation_jobs").update({
                    "current_step": f"セクション生成中: {section_def.get('title', '')}",
                    "progress": progress,
                }).eq("id", job_id).execute()

                source_data = []
                est_sources = section_def.get("estimated_sources", [])
                if not est_sources:
                    source_data = [
                        {"type": "calendar", "data": aggregated.get("calendar_events", [])},
                        {"type": "slack", "data": aggregated.get("slack_messages", [])},
                        {"type": "spreadsheet", "data": aggregated.get("spreadsheet_data", [])},
                    ]
                else:
                    if "calendar" in est_sources:
                        source_data.append({"type": "calendar", "data": aggregated.get("calendar_events", [])})
                    if "slack" in est_sources:
                        source_data.append({"type": "slack", "data": aggregated.get("slack_messages", [])})
                    if "spreadsheet" in est_sources:
                        source_data.append({"type": "spreadsheet", "data": aggregated.get("spreadsheet_data", [])})

                content = await self._ai.generate_section_content(
                    section_title=section_def.get("title", ""),
                    section_description=section_def.get("description", ""),
                    source_data=source_data,
                )

                source_tags = est_sources if est_sources else data_sources

                admin.table("document_sections").insert({
                    "document_id": document_id,
                    "section_order": section_def.get("order", i + 1),
                    "title": section_def.get("title", ""),
                    "content": content,
                    "source_tags": source_tags,
                    "source_references": [],
                    "is_ai_generated": True,
                }).execute()

            # 6. Complete
            admin.table("documents").update({"status": "completed"}).eq("id", document_id).execute()
            admin.table("generation_jobs").update({
                "status": "completed",
                "progress": 100,
                "current_step": "完了",
                "completed_at": "now()",
            }).eq("id", job_id).execute()

        except Exception as e:
            admin.table("generation_jobs").update({
                "status": "failed",
                "error_message": str(e),
                "completed_at": "now()",
            }).eq("id", job_id).execute()
            admin.table("documents").update({"status": "error"}).eq("id", document_id).execute()
            traceback.print_exc()

    async def generate_proposal(
        self,
        document_id: str,
        data_summary: dict,
    ) -> list[dict]:
        """Use Gemini AI to propose a section structure.

        Args:
            document_id: The document to propose structure for.
            data_summary: Aggregated data summary for context.

        Returns:
            List of proposed section dicts.
        """
        admin = get_supabase_admin_client()
        proposed = await self._ai.propose_structure(data_summary)

        admin.table("ai_proposals").insert({
            "document_id": document_id,
            "proposed_structure": proposed,
            "status": "pending",
        }).execute()

        return proposed
