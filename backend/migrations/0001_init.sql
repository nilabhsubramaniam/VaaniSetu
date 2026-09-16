-- +goose Up
-- Phase 2 schema: a deliberate subset of the turns table docs/ARCHITECTURE.md
-- §3.4 eventually wants (role, language, script, text, audio_ref, latency,
-- timestamps). `script` and `audio_ref` are left out here because nothing in
-- Phase 2 (text-only, no language/script detection yet) produces that data;
-- they arrive as additive migrations in the phases that do. Likewise there
-- is no `users` table yet — no auth exists (see docs/ARCHITECTURE.md §20,
-- "local-only account system", not yet built) — so `sessions` has no owner
-- column either. Phase 2 assumes exactly one implicit session per local
-- install.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    language TEXT NOT NULL,
    text TEXT NOT NULL,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX turns_session_id_created_at_idx ON turns (session_id, created_at);

-- +goose Down
DROP TABLE turns;
DROP TABLE sessions;
