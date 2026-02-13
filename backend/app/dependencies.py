from fastapi import Depends, Header, HTTPException, status

from app.db.client import get_supabase_client


async def get_current_user(authorization: str = Header(default="")):
    """Extract and validate the Supabase JWT from the Authorization header.

    Returns the authenticated user dict or raises 401.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must start with 'Bearer '",
        )

    token = authorization.removeprefix("Bearer ")
    client = get_supabase_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client not configured",
        )

    try:
        user_response = client.auth.get_user(token)
        if user_response is None or user_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return user_response.user
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user_id(user=Depends(get_current_user)) -> str:
    """Return the authenticated user's Supabase auth ID."""
    return user.id
