"""Authentication and OAuth service."""

import secrets
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.db.client import get_supabase_admin_client
from app.services.encryption import EncryptionService


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

    def __init__(self):
        self._http = httpx.AsyncClient(timeout=30)
        self._encryption = EncryptionService()
        self._admin = get_supabase_admin_client()

    # ---- Google OAuth ----

    def get_google_auth_url(self, state: str = "") -> str:
        """Build the Google OAuth consent URL."""
        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{self.GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def handle_google_callback(self, code: str) -> dict:
        """Exchange authorization code for tokens and create/login user.

        Returns dict with access_token and refresh_token for the Supabase session.
        """
        # 1. Exchange code for Google tokens
        token_resp = await self._http.post(
            self.GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()

        google_access_token = tokens["access_token"]
        google_refresh_token = tokens.get("refresh_token", "")

        # 2. Fetch Google user info
        userinfo_resp = await self._http.get(
            self.GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()

        email = userinfo["email"]
        display_name = userinfo.get("name", "")
        avatar_url = userinfo.get("picture", "")

        # 3. Create or get Supabase auth user (admin API)
        supabase_user = None
        try:
            # Try to create a new auth user
            create_resp = self._admin.auth.admin.create_user(
                {
                    "email": email,
                    "email_confirm": True,
                    "user_metadata": {
                        "display_name": display_name,
                        "avatar_url": avatar_url,
                    },
                }
            )
            supabase_user = create_resp.user
        except Exception:
            # User already exists — find them by listing
            users_list = self._admin.auth.admin.list_users()
            for u in users_list:
                if u.email == email:
                    supabase_user = u
                    break

        if supabase_user is None:
            raise ValueError("Failed to create or find Supabase auth user")

        auth_id = supabase_user.id

        # 4. Upsert into users table + auto-create tenant
        existing_user = (
            self._admin.table("users")
            .select("*, tenants(*)")
            .eq("supabase_auth_id", str(auth_id))
            .maybe_single()
            .execute()
        )

        if existing_user.data is None:
            # Create tenant first
            slug = email.split("@")[0] + "-" + secrets.token_hex(4)
            tenant_resp = (
                self._admin.table("tenants")
                .insert({"name": display_name or email, "slug": slug, "plan": "free"})
                .execute()
            )
            tenant_id = tenant_resp.data[0]["id"]

            # Create user record
            self._admin.table("users").insert(
                {
                    "tenant_id": tenant_id,
                    "supabase_auth_id": str(auth_id),
                    "email": email,
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                    "role": "owner",
                }
            ).execute()
        else:
            # Update existing user info
            self._admin.table("users").update(
                {
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                }
            ).eq("supabase_auth_id", str(auth_id)).execute()

        # 5. Get user_id for oauth_tokens
        user_row = (
            self._admin.table("users")
            .select("id")
            .eq("supabase_auth_id", str(auth_id))
            .single()
            .execute()
        )
        user_id = user_row.data["id"]

        # 6. Encrypt and store Google OAuth tokens
        encrypted_access = self._encryption.encrypt(google_access_token)
        encrypted_refresh = self._encryption.encrypt(google_refresh_token) if google_refresh_token else None

        # Upsert oauth_tokens (provider=google)
        existing_token = (
            self._admin.table("oauth_tokens")
            .select("id")
            .eq("user_id", user_id)
            .eq("provider", "google")
            .maybe_single()
            .execute()
        )

        token_data = {
            "user_id": user_id,
            "provider": "google",
            "encrypted_access_token": encrypted_access,
            "encrypted_refresh_token": encrypted_refresh,
            "scopes": self.GOOGLE_SCOPES,
            "metadata": {"email": email},
        }

        if tokens.get("expires_in"):
            from datetime import datetime, timedelta, timezone

            expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
            token_data["token_expires_at"] = expires_at.isoformat()

        if existing_token.data:
            self._admin.table("oauth_tokens").update(token_data).eq("id", existing_token.data["id"]).execute()
        else:
            self._admin.table("oauth_tokens").insert(token_data).execute()

        # 7. Generate Supabase session via magic link + verify
        link_resp = self._admin.auth.admin.generate_link(
            {
                "type": "magiclink",
                "email": email,
            }
        )

        # Extract the token_hash and type from the link
        action_link = link_resp.properties.action_link
        # Parse the verification URL to extract token_hash
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(action_link)
        qs = parse_qs(parsed.query)
        token_hash = qs.get("token", [None])[0]
        link_type = qs.get("type", ["magiclink"])[0]

        # Call /auth/v1/verify to get session tokens
        verify_resp = await self._http.post(
            f"{settings.supabase_url}/auth/v1/verify",
            json={
                "token_hash": token_hash,
                "type": link_type,
            },
            headers={
                "apikey": settings.supabase_key,
                "Content-Type": "application/json",
            },
        )
        verify_resp.raise_for_status()
        session = verify_resp.json()

        return {
            "access_token": session.get("access_token", ""),
            "refresh_token": session.get("refresh_token", ""),
            "expires_in": session.get("expires_in", 3600),
            "token_type": "bearer",
        }

    # ---- Slack OAuth ----

    def get_slack_auth_url(self, state: str = "") -> str:
        """Build the Slack OAuth consent URL."""
        params = {
            "client_id": settings.slack_client_id,
            "redirect_uri": settings.slack_redirect_uri,
            "scope": ",".join(self.SLACK_SCOPES),
            "state": state,
        }
        return f"{self.SLACK_AUTH_URL}?{urlencode(params)}"

    async def handle_slack_callback(self, code: str, user_id: str) -> dict:
        """Exchange Slack authorization code and store tokens."""
        # Exchange code for Slack tokens
        token_resp = await self._http.post(
            self.SLACK_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.slack_client_id,
                "client_secret": settings.slack_client_secret,
                "redirect_uri": settings.slack_redirect_uri,
            },
        )
        token_resp.raise_for_status()
        data = token_resp.json()

        if not data.get("ok"):
            raise ValueError(f"Slack OAuth error: {data.get('error', 'unknown')}")

        slack_access_token = data.get("access_token", "")
        team_name = data.get("team", {}).get("name", "")

        # Encrypt and store Slack tokens
        encrypted_access = self._encryption.encrypt(slack_access_token)

        existing_token = (
            self._admin.table("oauth_tokens")
            .select("id")
            .eq("user_id", user_id)
            .eq("provider", "slack")
            .maybe_single()
            .execute()
        )

        token_data = {
            "user_id": user_id,
            "provider": "slack",
            "encrypted_access_token": encrypted_access,
            "encrypted_refresh_token": None,
            "scopes": self.SLACK_SCOPES,
            "metadata": {"workspace_name": team_name},
        }

        if existing_token.data:
            self._admin.table("oauth_tokens").update(token_data).eq("id", existing_token.data["id"]).execute()
        else:
            self._admin.table("oauth_tokens").insert(token_data).execute()

        return {"provider": "slack", "workspace": team_name}

    # ---- Token Refresh ----

    async def refresh_token(self, user_id: str, provider: str) -> str | None:
        """Refresh an expired OAuth access token.

        Returns the new access token or None if refresh fails.
        """
        # Get the stored token
        token_row = (
            self._admin.table("oauth_tokens")
            .select("*")
            .eq("user_id", user_id)
            .eq("provider", provider)
            .maybe_single()
            .execute()
        )

        if not token_row.data or not token_row.data.get("encrypted_refresh_token"):
            return None

        refresh_token = self._encryption.decrypt(token_row.data["encrypted_refresh_token"])

        if provider == "google":
            resp = await self._http.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            new_tokens = resp.json()

            new_access = new_tokens["access_token"]
            encrypted_access = self._encryption.encrypt(new_access)

            update_data: dict = {"encrypted_access_token": encrypted_access}
            if new_tokens.get("expires_in"):
                from datetime import datetime, timedelta, timezone

                expires_at = datetime.now(timezone.utc) + timedelta(seconds=new_tokens["expires_in"])
                update_data["token_expires_at"] = expires_at.isoformat()

            self._admin.table("oauth_tokens").update(update_data).eq("id", token_row.data["id"]).execute()
            return new_access

        return None
