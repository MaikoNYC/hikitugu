"""Supabase Storage service for file management."""

from app.db.client import get_supabase_client


class StorageService:
    """Manages file uploads and downloads in Supabase Storage."""

    TEMPLATES_BUCKET = "templates"
    GENERATED_BUCKET = "generated"

    async def upload_template(self, file_bytes: bytes, file_name: str) -> str:
        """Upload a template file to Supabase Storage.

        Args:
            file_bytes: The file content.
            file_name: Destination file name.

        Returns:
            The storage path of the uploaded file.
        """
        # TODO: Upload to Supabase Storage templates bucket
        return f"{self.TEMPLATES_BUCKET}/{file_name}"

    async def download_file(self, bucket: str, path: str) -> bytes:
        """Download a file from Supabase Storage.

        Args:
            bucket: Storage bucket name.
            path: File path within the bucket.

        Returns:
            File content bytes.
        """
        # TODO: Download from Supabase Storage
        return b""

    async def delete_file(self, bucket: str, path: str) -> None:
        """Delete a file from Supabase Storage.

        Args:
            bucket: Storage bucket name.
            path: File path within the bucket.
        """
        # TODO: Delete from Supabase Storage
        pass
