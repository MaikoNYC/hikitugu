from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_role_key: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    slack_client_id: str = ""
    slack_client_secret: str = ""
    slack_redirect_uri: str = ""

    gemini_api_key: str = ""

    encryption_key: str = ""

    frontend_url: str = "http://localhost:3000"

    cors_origins: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    def get_cors_origins(self) -> list[str]:
        if self.cors_origins:
            return [o.strip() for o in self.cors_origins.split(",")]
        return [self.frontend_url]


settings = Settings()
