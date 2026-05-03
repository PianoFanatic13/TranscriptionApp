import asyncio
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import settings


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(settings.embedding_model)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings. Runs inference in a thread pool to avoid blocking."""
    model = _get_model()
    embeddings = await asyncio.to_thread(
        model.encode,
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return embeddings.tolist()


async def embed_query(text: str) -> list[float]:
    results = await embed_batch([text])
    return results[0]
