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


async def insert_note_and_chunks(
    user_id: str,
    raw_transcript: str,
    metadata: dict,
    chunks: list[str],
    embeddings: list[list[float]],
) -> str:
    client = await get_client()

    note_result = await client.table("notes").insert({
        "user_id": user_id,
        "raw_transcript": raw_transcript,
        "metadata": metadata,
    }).execute()

    note_id = note_result.data[0]["id"]

    chunk_rows = [
        {
            "note_id": note_id,
            "chunk_index": i,
            "content": chunk,
            "embedding": embedding,
            "user_id": user_id,
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    await client.table("chunks").insert(chunk_rows).execute()

    return note_id
