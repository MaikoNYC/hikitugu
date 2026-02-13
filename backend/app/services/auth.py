"""Authentication and OAuth service."""

from app.config import settings


class AuthService:
    """Handles OAuth flows and session management."""

    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    GOOGLE_SCOPES = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]

    SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize"
    SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"
    SLACK_SCOPES = ["channels:read", "channels:history", "users:read"]

    def get_google_auth_url(self, state: str = "") -> str:
        """Build the Google OAuth consent URL."""
        # TODO: Construct URL with client_id, redirect_uri, scopes, state
        return ""

    async def handle_google_callback(self, code: str) -> dict:
        """Exchange authorization code for tokens and create/login user."""
        # TODO: Exchange code, fetch user info, create Supabase user, store tokens
        return {}

    def get_slack_auth_url(self, state: str = "") -> str:
        """Build the Slack OAuth consent URL."""
        # TODO: Construct URL with client_id, redirect_uri, scopes, state
        return ""

    async def handle_slack_callback(self, code: str, user_id: str) -> dict:
        """Exchange Slack authorization code and store tokens."""
        # TODO: Exchange code, store encrypted tokens
        return {}

    async def get_current_user(self, token: str) -> dict | None:
        """Validate a Supabase JWT and return the user profile."""
        # TODO: Validate token, query users table
        return None

    async def refresh_token(self, user_id: str, provider: str) -> str | None:
        """Refresh an expired OAuth access token.

        Returns the new access token or None if refresh fails.
        """
        # TODO: Decrypt refresh token, call provider token endpoint, encrypt and store new tokens
        return None
