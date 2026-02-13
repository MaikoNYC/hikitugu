from app.config import settings


def get_supabase_client():
    """Return an initialized Supabase client.

    Requires supabase_url and supabase_key to be configured in settings.
    """
    if not settings.supabase_url or not settings.supabase_key:
        return None

    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_key)


def get_supabase_admin_client():
    """Return a Supabase client using the service role key for admin operations."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_role_key)
