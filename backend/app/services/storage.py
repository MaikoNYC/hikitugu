"""Supabase Storage service for file management."""

from app.db.client import get_supabase_admin_client


class StorageService:
    """Manages file uploads and downloads in Supabase Storage."""

    TEMPLATES_BUCKET = "templates"
    GENERATED_BUCKET = "generated"

    async def upload_template(self, file_bytes: bytes, file_name: str, content_type: str = "application/octet-stream") -> str:
        """Upload a template file to Supabase Storage.

        Args:
            file_bytes: The file content.
            file_name: Destination file name.
            content_type: MIME type of the file.

        Returns:
            The storage path of the uploaded file.
        """
        client = get_supabase_admin_client()
        path = file_name
        client.storage.from_(self.TEMPLATES_BUCKET).upload(
            path, file_bytes, {"content-type": content_type}
        )
        return f"{self.TEMPLATES_BUCKET}/{path}"

    async def download_file(self, bucket: str, path: str) -> bytes:
        """Download a file from Supabase Storage.

        Args:
            bucket: Storage bucket name.
            path: File path within the bucket.

        Returns:
            File content bytes.
        """
        client = get_supabase_admin_client()
        return client.storage.from_(bucket).download(path)

    async def delete_file(self, bucket: str, path: str) -> None:
        """Delete a file from Supabase Storage.

        Args:
            bucket: Storage bucket name.
            path: File path within the bucket.
        """
        client = get_supabase_admin_client()
        client.storage.from_(bucket).remove([path])
