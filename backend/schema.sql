-- Run this in the Supabase SQL editor before first use.
-- The file is idempotent: safe to re-run.

-- ── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists notes (
    id                   uuid        primary key default gen_random_uuid(),
    user_id              text        not null,
    raw_transcript       text,
    corrected_transcript text        not null,
    metadata             jsonb       not null default '{}',
    created_at           timestamptz not null default now()
);

create table if not exists chunks (
    id          uuid        primary key default gen_random_uuid(),
    note_id     uuid        not null references notes(id) on delete cascade,
    chunk_index integer     not null,
    content     text        not null,
    -- BGE-base-en-v1.5 produces 768-dimensional L2-normalised vectors
    embedding   vector(768),
    -- Generated column — updated automatically whenever content changes
    ts_content  tsvector    generated always as (to_tsvector('english', content)) stored,
    user_id     text        not null,
    created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- HNSW for approximate nearest-neighbour vector search (cosine distance)
create index if not exists chunks_embedding_hnsw_idx
    on chunks using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);

-- GIN for full-text search
create index if not exists chunks_ts_content_gin_idx
    on chunks using gin (ts_content);

-- B-tree indexes for filtering
create index if not exists chunks_user_id_idx  on chunks (user_id);
create index if not exists chunks_note_id_idx  on chunks (note_id);

-- ── RPC helper functions ──────────────────────────────────────────────────────
-- Called by services/retrieval.py via supabase.rpc(...)

create or replace function match_chunks_vector(
    query_embedding vector(768),
    match_count     int default 50
)
returns table (
    id          uuid,
    note_id     uuid,
    chunk_index integer,
    content     text,
    user_id     text,
    created_at  timestamptz,
    similarity  float
)
language sql stable
as $$
    select
        id,
        note_id,
        chunk_index,
        content,
        user_id,
        created_at,
        1 - (embedding <=> query_embedding) as similarity
    from chunks
    order by embedding <=> query_embedding
    limit match_count;
$$;


create or replace function match_chunks_bm25(
    query_text  text,
    match_count int default 50
)
returns table (
    id          uuid,
    note_id     uuid,
    chunk_index integer,
    content     text,
    user_id     text,
    created_at  timestamptz,
    rank        float
)
language sql stable
as $$
    select
        id,
        note_id,
        chunk_index,
        content,
        user_id,
        created_at,
        ts_rank(ts_content, websearch_to_tsquery('english', query_text)) as rank
    from chunks
    where ts_content @@ websearch_to_tsquery('english', query_text)
    order by rank desc
    limit match_count;
$$;
