from pydantic import BaseModel


class DocumentSectionResponse(BaseModel):
    id: str
    section_order: int
    title: str
    content: str | None = None
    source_tags: list[str] = []
    source_references: list[dict] = []
    is_ai_generated: bool = True


class DocumentResponse(BaseModel):
    id: str
    title: str
    target_user_email: str | None = None
    generation_mode: str
    template_id: str | None = None
    date_range_start: str | None = None
    date_range_end: str | None = None
    data_sources: list[str] = []
    status: str = "draft"
    share_enabled: bool = False
    share_token: str | None = None
    metadata: dict = {}
    sections: list[DocumentSectionResponse] = []
    created_at: str | None = None
    updated_at: str | None = None


class DocumentUpdateRequest(BaseModel):
    title: str | None = None


class SectionUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None


class GenerateRequest(BaseModel):
    title: str
    target_user_email: str | None = None
    template_id: str
    date_range_start: str
    date_range_end: str
    data_sources: list[str] = []
    slack_channel_ids: list[str] = []
    spreadsheet_ids: list[str] = []


class ProposeRequest(BaseModel):
    title: str
    target_user_email: str | None = None
    date_range_start: str
    date_range_end: str
    data_sources: list[str] = []
    slack_channel_ids: list[str] = []
    spreadsheet_ids: list[str] = []


class ApproveProposalRequest(BaseModel):
    proposal_id: str
    feedback: str | None = None
    approved_structure: list[dict] | None = None


class ProposalResponse(BaseModel):
    document_id: str
    proposal_id: str
    proposed_structure: list[dict] = []


class GenerationResponse(BaseModel):
    document_id: str
    job_id: str
    status: str = "pending"
    message: str = ""
