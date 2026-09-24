-- +goose Up
-- Phase 6 Milestone 6a: every turn also gets a "detected_language" tag —
-- the output of the real langid.LangIDClient capability (Fake for now,
-- Milestone 6b builds the real Python model), distinct from "language"
-- (the manually-selected/ASR-hint language that still drives the LLM
-- prompt and TTS voice) and from "script" (a deterministic Unicode-range
-- check, 0002_add_script.sql). Applied uniformly to both user and
-- assistant turns, typed or spoken, at persist time — same convention as
-- "script". Nullable: a detection failure is non-fatal (ADR-026) and
-- rows written before this migration have no value; neither is
-- backfilled.
ALTER TABLE turns ADD COLUMN detected_language TEXT;

-- +goose Down
ALTER TABLE turns DROP COLUMN detected_language;
