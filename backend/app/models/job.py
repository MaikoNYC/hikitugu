from pydantic import BaseModel


class JobStatusResponse(BaseModel):
    id: str
    document_id: str | None = None
    status: str = "pending"
    progress: int = 0
    current_step: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    error_message: str | None = None
