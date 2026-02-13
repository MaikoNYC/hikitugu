import asyncio
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.db.client import get_supabase_admin_client
from app.dependencies import get_current_user
from app.models.document import (
    ApproveProposalRequest,
    DocumentResponse,
    DocumentSectionResponse,
    DocumentUpdateRequest,
    GenerateRequest,
    GenerationResponse,
    ProposeRequest,
    ProposalResponse,
    SectionUpdateRequest,
)
from app.models.job import JobStatusResponse
from app.models.common import PaginatedResponse
from app.services.file_generator import FileGeneratorService
from app.services.generation import GenerationService

router = APIRouter()

file_generator = FileGeneratorService()
generation_service = GenerationService()


async def _get_tenant_id(user) -> str:
    """Get the tenant_id for the current user."""
    admin = get_supabase_admin_client()
    if not admin:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not configured")
    row = admin.table("users").select("tenant_id").eq("supabase_auth_id", user.id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return row.data["tenant_id"]


async def _get_user_id(user) -> str:
    """Get the internal user id from the supabase auth id."""
    admin = get_supabase_admin_client()
    if not admin:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not configured")
    row = admin.table("users").select("id").eq("supabase_auth_id", user.id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return row.data["id"]


# --- Generation endpoints ---


@router.post("/generate", response_model=GenerationResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_document(body: GenerateRequest, user=Depends(get_current_user)):
    """Start asynchronous document generation using a template."""
    admin = get_supabase_admin_client()
    tenant_id = await _get_tenant_id(user)
    user_id = await _get_user_id(user)

    doc = admin.table("documents").insert({
        "tenant_id": tenant_id,
        "created_by": user_id,
        "title": body.title,
        "target_user_email": body.target_user_email,
        "generation_mode": "template",
        "template_id": body.template_id,
        "date_range_start": body.date_range_start,
        "date_range_end": body.date_range_end,
        "data_sources": body.data_sources,
        "status": "generating",
        "metadata": {
            "slack_channel_ids": body.slack_channel_ids,
            "spreadsheet_ids": body.spreadsheet_ids,
        },
    }).execute()
    document_id = doc.data[0]["id"]

    job = admin.table("generation_jobs").insert({
        "document_id": document_id,
        "tenant_id": tenant_id,
        "status": "pending",
        "progress": 0,
    }).execute()
    job_id = job.data[0]["id"]

    asyncio.create_task(generation_service.start_generation(document_id, job_id))

    return GenerationResponse(
        document_id=document_id,
        job_id=job_id,
        status="pending",
        message="資料生成を開始しました",
    )


@router.post("/propose", response_model=ProposalResponse)
async def propose_document(body: ProposeRequest, user=Depends(get_current_user)):
    """Generate an AI-proposed section structure for review."""
    admin = get_supabase_admin_client()
    tenant_id = await _get_tenant_id(user)
    user_id = await _get_user_id(user)

    doc = admin.table("documents").insert({
        "tenant_id": tenant_id,
        "created_by": user_id,
        "title": body.title,
        "target_user_email": body.target_user_email,
        "generation_mode": "ai_proposal",
        "date_range_start": body.date_range_start,
        "date_range_end": body.date_range_end,
        "data_sources": body.data_sources,
        "status": "draft",
        "metadata": {
            "slack_channel_ids": body.slack_channel_ids,
            "spreadsheet_ids": body.spreadsheet_ids,
        },
    }).execute()
    document_id = doc.data[0]["id"]

    data_summary = {
        "title": body.title,
        "target_email": body.target_user_email,
        "date_range": f"{body.date_range_start} ~ {body.date_range_end}",
        "data_sources": body.data_sources,
    }

    proposed = await generation_service.generate_proposal(document_id, data_summary)

    proposal = admin.table("ai_proposals").select("id").eq("document_id", document_id).order("created_at", desc=True).limit(1).execute()
    proposal_id = proposal.data[0]["id"] if proposal.data else ""

    return ProposalResponse(
        document_id=document_id,
        proposal_id=proposal_id,
        proposed_structure=proposed,
    )


@router.post("/{document_id}/approve-proposal", response_model=GenerationResponse, status_code=status.HTTP_202_ACCEPTED)
async def approve_proposal(
    document_id: str,
    body: ApproveProposalRequest,
    user=Depends(get_current_user),
):
    """Approve a proposal and start full document generation."""
    admin = get_supabase_admin_client()
    tenant_id = await _get_tenant_id(user)

    admin.table("ai_proposals").update({
        "status": "approved",
        "user_feedback": body.feedback,
        "approved_at": "now()",
    }).eq("id", body.proposal_id).execute()

    if body.approved_structure:
        admin.table("ai_proposals").update({
            "proposed_structure": body.approved_structure,
        }).eq("id", body.proposal_id).execute()

    admin.table("documents").update({"status": "generating"}).eq("id", document_id).execute()

    job = admin.table("generation_jobs").insert({
        "document_id": document_id,
        "tenant_id": tenant_id,
        "status": "pending",
        "progress": 0,
    }).execute()
    job_id = job.data[0]["id"]

    asyncio.create_task(generation_service.start_generation(document_id, job_id))

    return GenerationResponse(
        document_id=document_id,
        job_id=job_id,
        status="pending",
        message="提案を承認しました。資料生成を開始します",
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, user=Depends(get_current_user)):
    """Poll the status of an async generation job."""
    admin = get_supabase_admin_client()
    row = admin.table("generation_jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    j = row.data
    return JobStatusResponse(
        id=j["id"],
        document_id=j.get("document_id"),
        status=j.get("status", "pending"),
        progress=j.get("progress", 0),
        current_step=j.get("current_step"),
        started_at=j.get("started_at"),
        completed_at=j.get("completed_at"),
        error_message=j.get("error_message"),
    )


# --- Document management endpoints ---


@router.get("/", response_model=PaginatedResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    document_status: str | None = Query(None, alias="status"),
    q: str | None = None,
    user=Depends(get_current_user),
):
    """List all documents in the current tenant."""
    admin = get_supabase_admin_client()
    tenant_id = await _get_tenant_id(user)

    offset = (page - 1) * per_page
    query = admin.table("documents").select("*", count="exact").eq("tenant_id", tenant_id)

    if document_status:
        query = query.eq("status", document_status)
    if q:
        query = query.ilike("title", f"%{q}%")

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    return PaginatedResponse(
        items=result.data or [],
        total_count=result.count or 0,
        page=page,
        per_page=per_page,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, user=Depends(get_current_user)):
    """Get a document with its sections."""
    admin = get_supabase_admin_client()
    doc_row = admin.table("documents").select("*").eq("id", document_id).maybe_single().execute()
    if not doc_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    d = doc_row.data

    sections_result = (
        admin.table("document_sections")
        .select("*")
        .eq("document_id", document_id)
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
        share_token=d.get("share_token"),
        metadata=d.get("metadata", {}),
        sections=sections,
        created_at=d.get("created_at"),
        updated_at=d.get("updated_at"),
    )


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    body: DocumentUpdateRequest,
    user=Depends(get_current_user),
):
    """Update document metadata (title, etc.)."""
    admin = get_supabase_admin_client()
    update_data = {}
    if body.title is not None:
        update_data["title"] = body.title

    if update_data:
        admin.table("documents").update(update_data).eq("id", document_id).execute()

    return await get_document(document_id, user)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, user=Depends(get_current_user)):
    """Delete a document and all related data."""
    admin = get_supabase_admin_client()
    admin.table("documents").delete().eq("id", document_id).execute()
    return None


@router.put("/{document_id}/sections/{section_id}")
async def update_section(
    document_id: str,
    section_id: str,
    body: SectionUpdateRequest,
    user=Depends(get_current_user),
):
    """Update a single section's content. Sets is_ai_generated to false."""
    admin = get_supabase_admin_client()
    update_data: dict = {"is_ai_generated": False}
    if body.title is not None:
        update_data["title"] = body.title
    if body.content is not None:
        update_data["content"] = body.content

    result = admin.table("document_sections").update(update_data).eq("id", section_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    s = result.data[0]
    return {"id": s["id"], "title": s["title"], "content": s.get("content")}


@router.post("/{document_id}/share")
async def create_share_link(document_id: str, user=Depends(get_current_user)):
    """Generate a shareable link for a document."""
    admin = get_supabase_admin_client()
    token = secrets.token_urlsafe(32)
    admin.table("documents").update({
        "share_token": token,
        "share_enabled": True,
    }).eq("id", document_id).execute()

    from app.config import settings
    base_url = settings.frontend_url
    return {"share_url": f"{base_url}/shared/{token}", "share_token": token}


@router.delete("/{document_id}/share")
async def revoke_share_link(document_id: str, user=Depends(get_current_user)):
    """Revoke a document's shareable link."""
    admin = get_supabase_admin_client()
    admin.table("documents").update({
        "share_enabled": False,
        "share_token": None,
    }).eq("id", document_id).execute()
    return {"message": "共有リンクを無効化しました"}


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    format: str = Query(..., description="Output format: pdf or docx"),
    user=Depends(get_current_user),
):
    """Download a document as PDF or Word."""
    admin = get_supabase_admin_client()
    doc_row = admin.table("documents").select("*").eq("id", document_id).maybe_single().execute()
    if not doc_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    sections_result = (
        admin.table("document_sections")
        .select("*")
        .eq("document_id", document_id)
        .order("section_order")
        .execute()
    )

    document = doc_row.data
    sections = sections_result.data or []

    if format == "pdf":
        content = await file_generator.generate_pdf(document, sections)
        media_type = "application/pdf"
        ext = "pdf"
    elif format == "docx":
        content = await file_generator.generate_docx(document, sections)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format. Use 'pdf' or 'docx'.")

    filename = f"{document.get('title', 'document')}.{ext}"

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
