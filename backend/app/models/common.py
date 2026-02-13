from typing import Any

from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Generic API response wrapper."""
    data: Any = None
    message: str | None = None


class PaginatedResponse(BaseModel):
    """Paginated list response."""
    items: list[Any] = []
    total_count: int = 0
    page: int = 1
    per_page: int = 20


class ErrorResponse(BaseModel):
    """Error response body."""
    detail: str
