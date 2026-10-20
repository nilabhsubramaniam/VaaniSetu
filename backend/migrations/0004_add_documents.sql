-- +goose Up
-- Phase 7 Milestone 7a: the document-upload boundary, with no embedding
-- data yet. `content` holds the raw uploaded text directly (plain-text
-- upload only this milestone — file-format parsing is explicitly
-- deferred, see docs/DECISIONS.md); there is deliberately no `vector`
-- column and no `CREATE EXTENSION vector` here, even though the
-- `pgvector/pgvector` Postgres image already supports it — the real
-- embedding dimension is not known until Milestone 7b benchmarks and
-- selects a model, and guessing a dimension now would mean a disruptive
-- column-type migration later for no benefit today. `status` tracks
-- whether the (not-yet-built) chunking/embedding job has run;
-- Milestone 7a always writes "pending" and never transitions it —
-- Milestone 7b owns the transition to "ready"/"failed" once that job
-- exists.
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_created_at_idx ON documents (created_at);

-- +goose Down
DROP TABLE documents;
