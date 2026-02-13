"""Template file parsing service."""


class TemplateParserService:
    """Parses uploaded .docx and .pdf templates to extract structure."""

    async def parse(self, file_path: str, file_type: str) -> dict:
        """Parse a template file and extract its section structure.

        Args:
            file_path: Path to the file in Supabase Storage.
            file_type: File extension ('docx' or 'pdf').

        Returns:
            Parsed structure dict with sections list.
        """
        if file_type == "docx":
            return await self._parse_docx(file_path)
        elif file_type == "pdf":
            return await self._parse_pdf(file_path)
        raise ValueError(f"Unsupported file type: {file_type}")

    async def _parse_docx(self, file_path: str) -> dict:
        """Extract structure from a .docx file using python-docx."""
        # TODO: Download from Storage, parse with python-docx
        return {"sections": []}

    async def _parse_pdf(self, file_path: str) -> dict:
        """Extract structure from a .pdf file."""
        # TODO: Download from Storage, parse with pdfplumber
        return {"sections": []}
