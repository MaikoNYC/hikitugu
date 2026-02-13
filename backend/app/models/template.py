from pydantic import BaseModel


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    file_type: str | None = None
    file_size_bytes: int | None = None
    status: str = "processing"
    parsed_structure: dict | None = None
    created_at: str | None = None
    updated_at: str | None = None


class TemplateUploadResponse(BaseModel):
    id: str
    name: str
    status: str = "processing"
    message: str = "テンプレートをアップロードしました。解析中です"


class TemplatePreviewResponse(BaseModel):
    id: str
    name: str
    preview_sections: list[dict] = []
