"""Document generation orchestration service."""


class GenerationService:
    """Orchestrates the document generation process."""

    async def start_generation(
        self,
        document_id: str,
        job_id: str,
    ) -> None:
        """Trigger the generation Edge Function for a document.

        Args:
            document_id: The document to generate content for.
            job_id: The generation job tracking ID.
        """
        # TODO: Invoke Supabase Edge Function 'generate-document'
        pass

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
        # TODO: Call Gemini API with aggregated data context
        return []
