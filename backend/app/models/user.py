from pydantic import BaseModel


class TenantInfo(BaseModel):
    id: str
    name: str
    slug: str
    plan: str = "free"


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    role: str = "member"
    avatar_url: str | None = None
    tenant: TenantInfo | None = None


class AuthStatus(BaseModel):
    google: dict = {}
    slack: dict = {}


class OAuthProvider:
    GOOGLE = "google"
    SLACK = "slack"
