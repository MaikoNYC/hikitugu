from fastapi import APIRouter, HTTPException, status

from app.db.client import get_supabase_admin_client
from app.models.document import DocumentResponse, DocumentSectionResponse

router = APIRouter()


@router.get("/{token}", response_model=DocumentResponse)
async def get_shared_document(token: str):
    """Access a shared document via its public token. No authentication required."""
    admin = get_supabase_admin_client()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured",
        )

    doc_row = (
        admin.table("documents")
        .select("*")
        .eq("share_token", token)
        .eq("share_enabled", True)
        .maybe_single()
        .execute()
    )

    if not doc_row.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="共有リンクが見つからないか、無効化されています",
        )

    d = doc_row.data

    sections_result = (
        admin.table("document_sections")
        .select("*")
        .eq("document_id", d["id"])
        .order("section_order")
        .execute()
    )
    sections = [
        DocumentSectionResponse(
            id=s["id"],
            section_order=s["section_order"],
            title=s["title"],
            content=s.get("content"),
            source_tags=s.get("source_tags", []),
            source_references=s.get("source_references", []),
            is_ai_generated=s.get("is_ai_generated", True),
        )
        for s in (sections_result.data or [])
    ]

    return DocumentResponse(
        id=d["id"],
        title=d["title"],
        target_user_email=d.get("target_user_email"),
        generation_mode=d.get("generation_mode", "template"),
        template_id=d.get("template_id"),
        date_range_start=d.get("date_range_start"),
        date_range_end=d.get("date_range_end"),
        data_sources=d.get("data_sources", []),
        status=d.get("status", "draft"),
        share_enabled=d.get("share_enabled", False),
        metadata=d.get("metadata", {}),
        sections=sections,
        created_at=d.get("created_at"),
        updated_at=d.get("updated_at"),
    )
