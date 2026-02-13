from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.dependencies import get_current_user
from app.models.template import TemplateResponse, TemplateUploadResponse, TemplatePreviewResponse
from app.models.common import PaginatedResponse

router = APIRouter()


@router.get("/", response_model=PaginatedResponse)
async def list_templates(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _user=Depends(get_current_user),
):
    """List all templates in the current tenant."""
    # TODO: Query templates table with RLS
    return PaginatedResponse(items=[], total_count=0, page=page, per_page=per_page)


@router.post("/", response_model=TemplateUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(default=""),
    _user=Depends(get_current_user),
):
    """Upload a template file (.docx or .pdf) for parsing."""
    # TODO: Upload to Supabase Storage, create template record, trigger parse-template
    return TemplateUploadResponse(
        id="stub",
        name=name,
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, _user=Depends(get_current_user)):
    """Get template details including parsed structure."""
    # TODO: Fetch template from database
    return TemplateResponse(
        id=template_id,
        name="",
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: str, _user=Depends(get_current_user)):
    """Delete a template and its stored file."""
    # TODO: Delete from Storage and database
    return None


@router.get("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(template_id: str, _user=Depends(get_current_user)):
    """Preview a template's parsed section structure."""
    # TODO: Fetch template and return preview
    return TemplatePreviewResponse(
        id=template_id,
        name="",
    )
