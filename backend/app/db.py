from supabase import AsyncClient, acreate_client

from app.config import settings

_client: AsyncClient | None = None


async def get_client() -> AsyncClient:
    """Return a singleton async Supabase client."""
    global _client
    if _client is None:
        _client = await acreate_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _client
