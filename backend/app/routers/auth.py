import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse

from app.config import settings
from app.db.client import get_supabase_client, get_supabase_admin_client
from app.dependencies import get_current_user
from app.models.user import AuthStatus, UserResponse, TenantInfo
from app.services.auth import AuthService

router = APIRouter()

_auth_service = AuthService()


def _get_user_from_token(request: Request, token: str | None = Query(default=None)):
    """Try Authorization header first, then fall back to query param token."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        jwt = auth_header.removeprefix("Bearer ")
    elif token:
        jwt = token
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization required",
        )
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        resp = client.auth.get_user(jwt)
        if resp is None or resp.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return resp.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/google")
async def google_login(request: Request):
    """Start Google OAuth 2.0 flow."""
    state = secrets.token_urlsafe(32)
    url = _auth_service.get_google_auth_url(state=state)
    response = RedirectResponse(url=url, status_code=302)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        max_age=600,
        secure=False,
    )
    return response


@router.get("/google/callback")
async def google_callback(request: Request, code: str = "", state: str = ""):
    """Handle Google OAuth callback."""
    # Verify CSRF state
    cookie_state = request.cookies.get("oauth_state", "")
    if not state or not cookie_state or state != cookie_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    try:
        session = await _auth_service.handle_google_callback(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth callback failed: {str(e)}")

    # Build redirect URL with tokens in hash fragment
    params = urlencode(
        {
            "access_token": session["access_token"],
            "refresh_token": session["refresh_token"],
            "expires_in": session.get("expires_in", 3600),
            "token_type": "bearer",
        }
    )
    redirect_url = f"{settings.frontend_url}/auth/callback#{params}"

    response = RedirectResponse(url=redirect_url, status_code=302)
    response.delete_cookie("oauth_state")
    return response


@router.get("/slack")
async def slack_login(request: Request, token: str | None = Query(default=None)):
    """Start Slack OAuth 2.0 flow. Requires authenticated user."""
    user = _get_user_from_token(request, token)

    # Get user_id from users table
    admin = get_supabase_admin_client()
    user_row = (
        admin.table("users")
        .select("id")
        .eq("supabase_auth_id", str(user.id))
        .single()
        .execute()
    )
    user_id = user_row.data["id"]

    state = secrets.token_urlsafe(32)

    url = _auth_service.get_slack_auth_url(state=state)
    response = RedirectResponse(url=url, status_code=302)
    response.set_cookie(
        key="slack_oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        max_age=600,
        secure=False,
    )
    response.set_cookie(
        key="slack_user_id",
        value=user_id,
        httponly=True,
        samesite="lax",
        max_age=600,
        secure=False,
    )
    return response


@router.get("/slack/callback")
async def slack_callback(request: Request, code: str = "", state: str = ""):
    """Handle Slack OAuth callback."""
    cookie_state = request.cookies.get("slack_oauth_state", "")
    if not state or not cookie_state or state != cookie_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    user_id = request.cookies.get("slack_user_id", "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User context lost")

    try:
        await _auth_service.handle_slack_callback(code, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Slack OAuth failed: {str(e)}")

    response = RedirectResponse(url=f"{settings.frontend_url}/settings", status_code=302)
    response.delete_cookie("slack_oauth_state")
    response.delete_cookie("slack_user_id")
    return response


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user=Depends(get_current_user)):
    """Get the currently authenticated user's information."""
    admin = get_supabase_admin_client()
    result = (
        admin.table("users")
        .select("*, tenants(*)")
        .eq("supabase_auth_id", str(user.id))
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    data = result.data
    tenant_data = data.get("tenants")
    tenant = None
    if tenant_data:
        tenant = TenantInfo(
            id=tenant_data["id"],
            name=tenant_data["name"],
            slug=tenant_data["slug"],
            plan=tenant_data.get("plan", "free"),
        )

    return UserResponse(
        id=data["id"],
        email=data["email"],
        display_name=data.get("display_name"),
        role=data.get("role", "member"),
        avatar_url=data.get("avatar_url"),
        tenant=tenant,
    )


@router.post("/logout")
async def logout(user=Depends(get_current_user)):
    """Log out and invalidate the current session."""
    # Client-side supabase.auth.signOut() handles session cleanup.
    # Server-side we just acknowledge the request.
    return {"message": "ログアウトしました"}


@router.get("/status", response_model=AuthStatus)
async def auth_status(user=Depends(get_current_user)):
    """Check connection status for each external service."""
    admin = get_supabase_admin_client()

    # Get user_id
    user_row = (
        admin.table("users")
        .select("id")
        .eq("supabase_auth_id", str(user.id))
        .maybe_single()
        .execute()
    )

    if not user_row.data:
        return AuthStatus(
            google={"connected": False},
            slack={"connected": False},
        )

    user_id = user_row.data["id"]

    # Query oauth_tokens
    tokens = (
        admin.table("oauth_tokens")
        .select("provider, scopes, metadata, token_expires_at")
        .eq("user_id", user_id)
        .execute()
    )

    google_status: dict = {"connected": False}
    slack_status: dict = {"connected": False}

    for t in tokens.data or []:
        if t["provider"] == "google":
            google_status = {
                "connected": True,
                "email": (t.get("metadata") or {}).get("email", ""),
                "scopes": t.get("scopes", []),
                "expires_at": t.get("token_expires_at"),
            }
        elif t["provider"] == "slack":
            slack_status = {
                "connected": True,
                "workspace_name": (t.get("metadata") or {}).get("workspace_name", ""),
                "scopes": t.get("scopes", []),
            }

    return AuthStatus(google=google_status, slack=slack_status)
