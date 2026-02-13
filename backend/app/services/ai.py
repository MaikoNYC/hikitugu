"""Gemini AI integration service."""

from app.config import settings


class AIService:
    """Interfaces with Google Gemini API for content generation."""

    async def generate_section_content(
        self,
        section_title: str,
        section_description: str,
        source_data: list[dict],
    ) -> str:
        """Generate content for a single document section.

        Args:
            section_title: The section heading.
            section_description: Description of what the section should contain.
            source_data: Relevant data from Calendar/Slack/Sheets.

        Returns:
            Generated Markdown content.
        """
        # TODO: Call Gemini API with structured prompt
        return ""

    async def propose_structure(
        self,
        data_summary: dict,
    ) -> list[dict]:
        """Ask Gemini to propose an optimal section structure.

        Args:
            data_summary: Summary of available data from all sources.

        Returns:
            List of proposed section dicts with title, description, estimated_sources.
        """
        # TODO: Call Gemini API with data summary
        return []
