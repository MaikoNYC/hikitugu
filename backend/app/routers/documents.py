from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_user
from app.models.document import (
    DocumentResponse,
    DocumentUpdateRequest,
    SectionUpdateRequest,
    GenerateRequest,
    ProposeRequest,
    ApproveProposalRequest,
    GenerationResponse,
    ProposalResponse,
)
from app.models.job import JobStatusResponse
from app.models.common import PaginatedResponse

router = APIRouter()


# --- Generation endpoints ---


@router.post("/generate", response_model=GenerationResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_document(body: GenerateRequest, _user=Depends(get_current_user)):
    """Start asynchronous document generation using a template."""
    # TODO: Create document + generation_job, trigger Edge Function
    return GenerationResponse(
        document_id="stub",
        job_id="stub",
        status="pending",
        message="資料生成を開始しました",
    )


@router.post("/propose", response_model=ProposalResponse)
async def propose_document(body: ProposeRequest, _user=Depends(get_current_user)):
    """Generate an AI-proposed section structure for review."""
    # TODO: Create document, call Gemini API for structure proposal
    return ProposalResponse(
        document_id="stub",
        proposal_id="stub",
        proposed_structure=[],
    )


@router.post("/{document_id}/approve-proposal", response_model=GenerationResponse, status_code=status.HTTP_202_ACCEPTED)
async def approve_proposal(
    document_id: str,
    body: ApproveProposalRequest,
    _user=Depends(get_current_user),
):
    """Approve a proposal and start full document generation."""
    # TODO: Update proposal status, create generation_job, trigger Edge Function
    return GenerationResponse(
        document_id=document_id,
        job_id="stub",
        status="pending",
        message="提案を承認しました。資料生成を開始します",
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, _user=Depends(get_current_user)):
    """Poll the status of an async generation job."""
    # TODO: Fetch job from generation_jobs table
    return JobStatusResponse(
        id=job_id,
        status="pending",
        progress=0,
    )


# --- Document management endpoints ---


@router.get("/", response_model=PaginatedResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    document_status: str | None = Query(None, alias="status"),
    q: str | None = None,
    _user=Depends(get_current_user),
):
    """List all documents in the current tenant."""
    # TODO: Query documents table with RLS
    return PaginatedResponse(items=[], total_count=0, page=page, per_page=per_page)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, _user=Depends(get_current_user)):
    """Get a document with its sections."""
    # TODO: Fetch document and sections
    return DocumentResponse(
        id=document_id,
        title="",
        generation_mode="template",
    )


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    body: DocumentUpdateRequest,
    _user=Depends(get_current_user),
):
    """Update document metadata (title, etc.)."""
    # TODO: Update document in database
    return DocumentResponse(
        id=document_id,
        title=body.title or "",
        generation_mode="template",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, _user=Depends(get_current_user)):
    """Delete a document and all related data."""
    # TODO: Delete document (CASCADE handles sections, jobs, proposals)
    return None


@router.put("/{document_id}/sections/{section_id}")
async def update_section(
    document_id: str,
    section_id: str,
    body: SectionUpdateRequest,
    _user=Depends(get_current_user),
):
    """Update a single section's content. Sets is_ai_generated to false."""
    # TODO: Update section, set is_ai_generated = false
    return {"id": section_id, "title": body.title, "content": body.content}


@router.post("/{document_id}/share")
async def create_share_link(document_id: str, _user=Depends(get_current_user)):
    """Generate a shareable link for a document."""
    # TODO: Generate share_token, enable sharing
    return {"share_url": f"https://hikitugu.vercel.app/shared/stub-token", "share_token": "stub-token"}


@router.delete("/{document_id}/share")
async def revoke_share_link(document_id: str, _user=Depends(get_current_user)):
    """Revoke a document's shareable link."""
    # TODO: Disable sharing, clear share_token
    return {"message": "共有リンクを無効化しました"}


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    format: str = Query(..., description="Output format: pdf or docx"),
    _user=Depends(get_current_user),
):
    """Download a document as PDF or Word."""
    # TODO: Use FileGeneratorService to create the file
    media_type = (
        "application/pdf"
        if format == "pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return StreamingResponse(
        iter([b""]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=document.{format}"},
    )
