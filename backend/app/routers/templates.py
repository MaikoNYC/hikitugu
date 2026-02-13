from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.db.client import get_supabase_admin_client
from app.dependencies import get_current_user
from app.models.template import TemplateResponse, TemplateUploadResponse, TemplatePreviewResponse
from app.models.common import PaginatedResponse
from app.services.storage import StorageService
from app.services.template_parser import TemplateParserService

router = APIRouter()

storage_service = StorageService()
parser_service = TemplateParserService()


async def _get_tenant_id(user) -> str:
    admin = get_supabase_admin_client()
    if not admin:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not configured")
    row = admin.table("users").select("tenant_id").eq("supabase_auth_id", user.id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return row.data["tenant_id"]


async def _get_user_id(user) -> str:
    admin = get_supabase_admin_client()
    row = admin.table("users").select("id").eq("supabase_auth_id", user.id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return row.data["id"]


@router.get("/", response_model=PaginatedResponse)
async def list_templates(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    """List all templates in the current tenant."""
    admin = get_supabase_admin_client()
    tenant_id = await _get_tenant_id(user)

    offset = (page - 1) * per_page
    result = (
        admin.table("templates")
        .select("*", count="exact")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return PaginatedResponse(
        items=result.data or [],
        total_count=result.count or 0,
        page=page,
        per_page=per_page,
    )


@router.post("/", response_model=TemplateUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(default=""),
    user=Depends(get_current_user),
):
    """Upload a template file (.docx or .pdf) for parsing."""
    admin = get_supabase_admin_client()
    tenant_id = await _get_tenant_id(user)
    user_id = await _get_user_id(user)

    filename = file.filename or "template"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("docx", "pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .docx and .pdf files are supported")

    file_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"

    import uuid
    storage_name = f"{uuid.uuid4().hex}_{filename}"
    storage_path = await storage_service.upload_template(file_bytes, storage_name, content_type)

    record = admin.table("templates").insert({
        "tenant_id": tenant_id,
        "uploaded_by": user_id,
        "name": name,
        "description": description,
        "file_path": storage_path,
        "file_type": ext,
        "file_size_bytes": len(file_bytes),
        "status": "processing",
    }).execute()
    template_id = record.data[0]["id"]

    try:
        parsed = await parser_service.parse(storage_path, ext)
        admin.table("templates").update({
            "parsed_structure": parsed,
            "status": "ready",
        }).eq("id", template_id).execute()
    except Exception:
        admin.table("templates").update({"status": "error"}).eq("id", template_id).execute()

    return TemplateUploadResponse(id=template_id, name=name)


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, user=Depends(get_current_user)):
    """Get template details including parsed structure."""
    admin = get_supabase_admin_client()
    row = admin.table("templates").select("*").eq("id", template_id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    t = row.data
    return TemplateResponse(
        id=t["id"],
        name=t["name"],
        description=t.get("description"),
        file_type=t.get("file_type"),
        file_size_bytes=t.get("file_size_bytes"),
        status=t.get("status", "processing"),
        parsed_structure=t.get("parsed_structure"),
        created_at=t.get("created_at"),
        updated_at=t.get("updated_at"),
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: str, user=Depends(get_current_user)):
    """Delete a template and its stored file."""
    admin = get_supabase_admin_client()
    row = admin.table("templates").select("file_path").eq("id", template_id).maybe_single().execute()
    if row.data and row.data.get("file_path"):
        file_path = row.data["file_path"]
        parts = file_path.split("/", 1)
        bucket = parts[0]
        path = parts[1] if len(parts) > 1 else parts[0]
        try:
            await storage_service.delete_file(bucket, path)
        except Exception:
            pass

    admin.table("templates").delete().eq("id", template_id).execute()
    return None


@router.get("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(template_id: str, user=Depends(get_current_user)):
    """Preview a template's parsed section structure."""
    admin = get_supabase_admin_client()
    row = admin.table("templates").select("*").eq("id", template_id).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    t = row.data
    parsed = t.get("parsed_structure") or {}
    return TemplatePreviewResponse(
        id=t["id"],
        name=t["name"],
        preview_sections=parsed.get("sections", []),
    )
