import asyncio
from collections import defaultdict
from typing import Any

from app.config import settings
from app.db import get_client


async def vector_search(
    embedding: list[float],
    candidate_k: int,
) -> list[dict[str, Any]]:
    """Cosine similarity search via pgvector HNSW index."""
    client = await get_client()
    result = await client.rpc(
        "match_chunks_vector",
        {"query_embedding": embedding, "match_count": candidate_k},
    ).execute()
    return result.data


async def bm25_search(
    query: str,
    candidate_k: int,
) -> list[dict[str, Any]]:
    """Full-text search via tsvector GIN index."""
    client = await get_client()
    result = await client.rpc(
        "match_chunks_bm25",
        {"query_text": query, "match_count": candidate_k},
    ).execute()
    return result.data


def rrf_fuse(
    vector_results: list[dict],
    bm25_results: list[dict],
    k: int = 60,
    top_n: int = 10,
) -> list[dict]:
    """
    Reciprocal Rank Fusion: score(d) = Σ 1/(k + rank_i(d))
    Merges two ranked lists keyed by chunk id.
    """
    scores: dict[str, float] = defaultdict(float)
    meta: dict[str, dict] = {}

    for rank, row in enumerate(vector_results, start=1):
        cid = row["id"]
        scores[cid] += 1.0 / (k + rank)
        meta[cid] = row

    for rank, row in enumerate(bm25_results, start=1):
        cid = row["id"]
        scores[cid] += 1.0 / (k + rank)
        meta.setdefault(cid, row)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [{"rrf_score": score, **meta[cid]} for cid, score in ranked]


async def hybrid_search(
    query: str,
    embedding: list[float],
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """Run vector and BM25 searches in parallel, fuse with RRF."""
    candidate_k = settings.retrieval_candidate_k
    vector_results, bm25_results = await asyncio.gather(
        vector_search(embedding, candidate_k),
        bm25_search(query, candidate_k),
    )
    return rrf_fuse(vector_results, bm25_results, k=settings.rrf_k, top_n=top_k)
