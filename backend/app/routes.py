from fastapi import APIRouter, HTTPException

import app.db as db
from app.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse
from app.services import chunker
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
    )
    return IngestResponse(note_id=note_id, chunk_count=len(chunks))


@router.post("/query", response_model=QueryResponse)
async def query_notes(payload: QueryRequest) -> QueryResponse:
    """Embed query, run hybrid retrieval, synthesise answer via Groq."""
    # TODO: query_embedding = await embeddings_service.embed_query(payload.query)
    # TODO: chunks = await retrieval.hybrid_search(payload.query, query_embedding, payload.top_k)
    # TODO: answer = await synthesis.synthesise(payload.query, chunks)
    # TODO: return QueryResponse(answer=answer, sources=[...], query=payload.query)
    raise HTTPException(status_code=501, detail="Not implemented yet")
