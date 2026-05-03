from fastapi import APIRouter, HTTPException

from app.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse

router = APIRouter()


@router.post("/embed", response_model=IngestResponse)
async def embed_transcript(payload: IngestRequest) -> IngestResponse:
    """Chunk, embed, and store a corrected transcript."""
    # TODO: chunks = chunker.chunk_text(payload.corrected_transcript)
    # TODO: embeddings = await embeddings_service.embed_batch(chunks)
    # TODO: note_id = await db.insert_note_and_chunks(payload, chunks, embeddings)
    # TODO: return IngestResponse(note_id=note_id, chunk_count=len(chunks))
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/query", response_model=QueryResponse)
async def query_notes(payload: QueryRequest) -> QueryResponse:
    """Embed query, run hybrid retrieval, synthesise answer via Groq."""
    # TODO: query_embedding = await embeddings_service.embed_query(payload.query)
    # TODO: chunks = await retrieval.hybrid_search(payload.query, query_embedding, payload.top_k)
    # TODO: answer = await synthesis.synthesise(payload.query, chunks)
    # TODO: return QueryResponse(answer=answer, sources=[...], query=payload.query)
    raise HTTPException(status_code=501, detail="Not implemented yet")
