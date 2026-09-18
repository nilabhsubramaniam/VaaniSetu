-- +goose Up
-- Phase 3 (Speech-to-Text): every turn gets a "script" tag — which
-- writing system its text is actually in (Devanagari, Latin/romanized,
-- Bengali, ...). Computed deterministically from the text itself
-- (internal/conversation.DetectScript, a Unicode-range check), not a
-- language-identification model — that stays Phase 6's job per
-- docs/ARCHITECTURE.md. Applied uniformly to both user and assistant
-- turns, typed or spoken, going forward. Nullable because rows written
-- before this migration have no value and are not backfilled.
ALTER TABLE turns ADD COLUMN script TEXT;

-- +goose Down
ALTER TABLE turns DROP COLUMN script;
