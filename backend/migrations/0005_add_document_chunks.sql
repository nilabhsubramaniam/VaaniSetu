-- +goose Up
-- Phase 7 Milestone 7c: the first schema this project's pgvector
-- extension actually uses. `vector(768)` is a fixed dimension --
-- intfloat/multilingual-e5-base's real, benchmarked output size
-- (docs/DECISIONS.md ADR-037), not a guess (ADR-036 deferred this exact
-- column for that reason). Swapping to a different-dimension embedding
-- model later needs a fresh migration plus a backfill of every existing
-- row -- an accepted, inherent limitation of pgvector's fixed-width
-- column type, not one this migration works around.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

-- Cosine distance, matching scripts/benchmark_embedding.py's own metric
-- and multilingual-e5-base's recommended similarity measure. HNSW is
-- docs/ARCHITECTURE.md §3.5's named choice ("Approximate index (HNSW) on
-- the embedding column, tuned when RAG is built (Phase 7)").
CREATE INDEX document_chunks_embedding_idx ON document_chunks
USING hnsw (embedding vector_cosine_ops);

-- +goose Down
DROP TABLE document_chunks;
