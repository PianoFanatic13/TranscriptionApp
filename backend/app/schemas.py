from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Embed (ingest) ────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    user_id: str
    corrected_transcript: str
    raw_transcript: Optional[str] = None
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    note_id: str
    chunk_count: int
    status: str = "ok"


# ── Query ─────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    top_k: int = Field(default=10, ge=1, le=50)


class SourceChunk(BaseModel):
    chunk_id: str
    note_id: str
    content: str
    rrf_score: float
    chunk_index: int
    user_id: str
    created_at: datetime


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    query: str
