"""Document file generation service (PDF/Word export)."""


class FileGeneratorService:
    """Generates PDF and Word files from document sections."""

    async def generate_pdf(self, document: dict, sections: list[dict]) -> bytes:
        """Generate a PDF file from document sections.

        Args:
            document: Document metadata dict.
            sections: List of section dicts with title and content.

        Returns:
            PDF file bytes.
        """
        # TODO: Use a PDF generation library
        return b""

    async def generate_docx(self, document: dict, sections: list[dict]) -> bytes:
        """Generate a Word (.docx) file from document sections.

        Args:
            document: Document metadata dict.
            sections: List of section dicts with title and content.

        Returns:
            DOCX file bytes.
        """
        # TODO: Use python-docx to build the document
        return b""
