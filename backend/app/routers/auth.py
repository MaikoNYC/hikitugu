from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from app.dependencies import get_current_user
from app.models.user import UserResponse, AuthStatus

router = APIRouter()


@router.get("/google")
async def google_login(redirect_uri: str | None = None):
    """Start Google OAuth 2.0 flow."""
    # TODO: Generate Google OAuth URL and redirect
    return RedirectResponse(url="/")


@router.get("/google/callback")
async def google_callback(code: str = "", state: str = ""):
    """Handle Google OAuth callback."""
    # TODO: Exchange code for tokens, create/login user, store encrypted tokens
    return RedirectResponse(url="/dashboard")


@router.get("/slack")
async def slack_login(
    redirect_uri: str | None = None,
    _user=Depends(get_current_user),
):
    """Start Slack OAuth 2.0 flow. Requires authenticated user."""
    # TODO: Generate Slack OAuth URL and redirect
    return RedirectResponse(url="/")


@router.get("/slack/callback")
async def slack_callback(code: str = "", state: str = ""):
    """Handle Slack OAuth callback."""
    # TODO: Exchange code for tokens, store encrypted tokens
    return RedirectResponse(url="/settings")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user=Depends(get_current_user)):
    """Get the currently authenticated user's information."""
    # TODO: Fetch full user profile from database
    return UserResponse(
        id=str(user.id),
        email=user.email or "",
    )


@router.post("/logout")
async def logout(user=Depends(get_current_user)):
    """Log out and invalidate the current session."""
    # TODO: Invalidate Supabase session
    return {"message": "ログアウトしました"}


@router.get("/status", response_model=AuthStatus)
async def auth_status(user=Depends(get_current_user)):
    """Check connection status for each external service."""
    # TODO: Query oauth_tokens to check connection status
    return AuthStatus(
        google={"connected": False},
        slack={"connected": False},
    )
