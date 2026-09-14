# CURRENT_STATE.md

Short, always-current snapshot of where the project is. Update this whenever the
project moves between milestones or a phase's status changes.

---

- **Current phase:** Phase 1 complete, transitioning to Phase 2.
- **Current focus:** Awaiting approval to plan Phase 2 - Local LLM.
- **Last updated:** 2026-09-14

## Completed

- Project documentation bootstrap: `AGENTS.md` and the `docs/` set
  (`PROJECT_GOAL`, `ARCHITECTURE`, `ROADMAP`, `DECISIONS`, `CURRENT_STATE`,
  `DEVELOPMENT`, `EVALUATION`).
- Phase 1 - UI Foundation: Angular workspace at `frontend/` with the
  conversation UI (mic button, voice-state indicator, text-input fallback,
  message bubbles, language selector) and a settings screen scaffold, all
  built against mock/local data. No backend, database, or AI service exists
  or is called.
- Decisions recorded: ADR-001 through ADR-012 (see `docs/DECISIONS.md`).
- `docs/DEVELOPMENT.md` frontend rows updated from `TBD` to the concrete
  stack actually used.
- A public landing page was added at `/` (`frontend/src/app/landing/`),
  explaining the product, its planned pipeline, and language direction to a
  new visitor, with a CTA into the existing mock assistant workspace at
  `/assistant`. Still Phase 1: static/presentational only, no service
  injection, no network calls.

## In progress

- Nothing. Phase 1 is done; Phase 2 has not been planned yet.

## Next

- Plan Phase 2 - Local LLM (Python LLM service, Go backend skeleton, chat
  endpoint, PostgreSQL persistence, replacing the frontend's mock
  `ConversationService`/`VoiceSessionService` providers with real ones).
  Requires user approval of a Phase 2 plan before any implementation.

## Not started

- Backend (Go API)
- Local LLM
- Speech-to-Text
- Text-to-Speech
- End-to-end voice loop
- Indian language breadth (beyond Hindi / Hinglish scope)
- RAG
- Dataset pipeline
- Evaluation harness
- LoRA / QLoRA fine-tuning
- Real-time streaming
- Production hardening

## Repository reality

- `AGENTS.md`, `docs/`, `LICENSE`, and `frontend/` (an Angular 22 workspace)
  exist. `backend/`, `ai-services/`, and `proto/` do not exist yet — they are
  introduced in Phase 2.
- `frontend/` builds, lints, and tests clean (`ng build`, `ng lint`, `ng test`,
  `prettier --check`) as of Phase 1 completion.
- No model has been selected for any capability (see ADR-008). All capability
  model choices are still `TBD`.
- `frontend/node_modules/` and `frontend/dist/` are git-ignored (via the
  repository's single root `.gitignore`) and were not committed.
