"""Template file parsing service."""

import io
import re

from app.services.storage import StorageService


class TemplateParserService:
    """Parses uploaded .docx and .pdf templates to extract structure."""

    def __init__(self):
        self._storage = StorageService()

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
        from docx import Document

        # file_path format: "templates/filename.docx" -> bucket="templates", path="filename.docx"
        parts = file_path.split("/", 1)
        bucket = parts[0]
        path = parts[1] if len(parts) > 1 else parts[0]

        file_bytes = await self._storage.download_file(bucket, path)
        doc = Document(io.BytesIO(file_bytes))

        sections = []
        order = 0

        heading_levels = {
            "Heading 1": 1,
            "Heading 2": 2,
            "Heading 3": 3,
            "Heading 4": 4,
        }

        for para in doc.paragraphs:
            style_name = para.style.name if para.style else ""
            if style_name in heading_levels:
                order += 1
                sections.append(
                    {
                        "order": order,
                        "title": para.text.strip(),
                        "level": heading_levels[style_name],
                    }
                )

        return {"sections": sections}

    async def _parse_pdf(self, file_path: str) -> dict:
        """Extract structure from a .pdf file using pdfplumber."""
        import pdfplumber

        parts = file_path.split("/", 1)
        bucket = parts[0]
        path = parts[1] if len(parts) > 1 else parts[0]

        file_bytes = await self._storage.download_file(bucket, path)

        sections = []
        order = 0

        heading_pattern = re.compile(
            r"^(?:第[一二三四五六七八九十\d]+[章節条項]|[\d]+[\.\)）]\s*|[IVXivx]+[\.\)）]\s*)"
        )

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                for line in text.split("\n"):
                    stripped = line.strip()
                    if not stripped:
                        continue
                    if heading_pattern.match(stripped) or (
                        len(stripped) < 60 and stripped.isupper()
                    ):
                        order += 1
                        sections.append(
                            {
                                "order": order,
                                "title": stripped,
                                "level": 1,
                            }
                        )

        return {"sections": sections}
