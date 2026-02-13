"""Database repository layer for Supabase queries."""

from app.db.client import get_supabase_client, get_supabase_admin_client


class BaseRepository:
    """Base class for database repositories."""

    def __init__(self):
        self._client = get_supabase_client()
        self._admin_client = get_supabase_admin_client()

    @property
    def client(self):
        return self._client

    @property
    def admin_client(self):
        return self._admin_client


class UserRepository(BaseRepository):
    """Repository for user-related database operations."""

    async def get_by_supabase_auth_id(self, auth_id: str) -> dict | None:
        if not self.client:
            return None
        result = self.client.table("users").select("*").eq("supabase_auth_id", auth_id).maybe_single().execute()
        return result.data

    async def get_by_id(self, user_id: str) -> dict | None:
        if not self.client:
            return None
        result = self.client.table("users").select("*").eq("id", user_id).maybe_single().execute()
        return result.data


class DocumentRepository(BaseRepository):
    """Repository for document-related database operations."""

    async def list_by_tenant(self, tenant_id: str, page: int = 1, per_page: int = 20) -> tuple[list[dict], int]:
        if not self.client:
            return [], 0
        offset = (page - 1) * per_page
        result = (
            self.client.table("documents")
            .select("*", count="exact")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
        return result.data or [], result.count or 0

    async def get_by_id(self, document_id: str) -> dict | None:
        if not self.client:
            return None
        result = self.client.table("documents").select("*").eq("id", document_id).maybe_single().execute()
        return result.data

    async def get_by_share_token(self, token: str) -> dict | None:
        if not self.client:
            return None
        result = (
            self.client.table("documents")
            .select("*")
            .eq("share_token", token)
            .eq("share_enabled", True)
            .maybe_single()
            .execute()
        )
        return result.data


class TemplateRepository(BaseRepository):
    """Repository for template-related database operations."""

    async def list_by_tenant(self, tenant_id: str, page: int = 1, per_page: int = 20) -> tuple[list[dict], int]:
        if not self.client:
            return [], 0
        offset = (page - 1) * per_page
        result = (
            self.client.table("templates")
            .select("*", count="exact")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
        return result.data or [], result.count or 0

    async def get_by_id(self, template_id: str) -> dict | None:
        if not self.client:
            return None
        result = self.client.table("templates").select("*").eq("id", template_id).maybe_single().execute()
        return result.data


class GenerationJobRepository(BaseRepository):
    """Repository for generation job operations."""

    async def get_by_id(self, job_id: str) -> dict | None:
        if not self.client:
            return None
        result = self.client.table("generation_jobs").select("*").eq("id", job_id).maybe_single().execute()
        return result.data
