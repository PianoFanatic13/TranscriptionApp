from fastapi import APIRouter

import app.db as db
from app.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse, SourceChunk
from app.services import chunker, retrieval, synthesis
from app.services import embeddings as embeddings_service

router = APIRouter()


@router.post("/embed", response_model=IngestResponse)
async def embed_transcript(payload: IngestRequest) -> IngestResponse:
    chunks = chunker.chunk_text(payload.raw_transcript)
    vectors = await embeddings_service.embed_batch(chunks)
    note_id = await db.insert_note_and_chunks(
        user_id=payload.user_id,
        raw_transcript=payload.raw_transcript,
        metadata=payload.metadata or {},
        chunks=chunks,
        embeddings=vectors,
        observation_time=payload.observation_time,
    )
    return IngestResponse(note_id=note_id, chunk_count=len(chunks))


@router.post("/query", response_model=QueryResponse)
async def query_notes(payload: QueryRequest) -> QueryResponse:
    query_embedding = await embeddings_service.embed_query(payload.query)
    chunks = await retrieval.hybrid_search(payload.query, query_embedding, payload.top_k, payload.user_id)
    answer = await synthesis.synthesise(payload.query, chunks)
    sources = [
        SourceChunk(
            chunk_id=c["id"],
            note_id=c["note_id"],
            content=c["content"],
            rrf_score=c["rrf_score"],
            chunk_index=c["chunk_index"],
            user_id=c["user_id"],
            created_at=c["created_at"],
            observation_time=c.get("observation_time"),
        )
        for c in chunks
    ]
    return QueryResponse(answer=answer, sources=sources, query=payload.query)
