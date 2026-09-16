# CURRENT_STATE.md

Short, always-current snapshot of where the project is. Update this whenever the
project moves between milestones or a phase's status changes.

---

- **Current phase:** Phase 2 - Local LLM, **DONE**. Milestones 2a and 2b are
  both complete; Phase 2's Definition of Done (`docs/ROADMAP.md`) is met.
- **Current focus:** none active — awaiting the user's decision on the next
  phase (`docs/ROADMAP.md` Phase 3, Speech-to-Text, is next in order; see
  `AGENTS.md` §5, "never advance to the next milestone automatically").
- **Last updated:** 2026-09-16 (Milestone 2b: Python `llm` service built,
  benchmarked, wired to the backend, and verified live end to end)

## Completed

- Project documentation bootstrap: `AGENTS.md` and the `docs/` set
  (`PROJECT_GOAL`, `ARCHITECTURE`, `ROADMAP`, `DECISIONS`, `CURRENT_STATE`,
  `DEVELOPMENT`, `EVALUATION`).
- Phase 1 - UI Foundation: Angular workspace at `frontend/`, including a
  public landing page at `/`, a full assistant workspace at `/assistant`,
  and a settings scaffold — all still against mock/local data, no network
  calls.
- Decisions recorded: ADR-001 through ADR-014 (see `docs/DECISIONS.md`).
- **Phase 2, Milestone 2a - Go backend against a fake LLM client:**
  - `backend/` (Go 1.26, module `github.com/nilabhsubramaniam/VaaniSetu/backend`):
    `cmd/api`, `internal/{api,conversation,llm,config,db,logging}`.
  - `POST /api/v1/chat` and `GET /api/v1/chat/history`, per
    `docs/openapi/chat.yaml`, matching the frontend's existing `Turn`/
    `ConversationService` shapes exactly (no frontend interface change
    needed when Milestone 2b wires it up, per ADR-009).
  - PostgreSQL schema (`sessions`, `turns`) via `goose` migrations, embedded
    into the binary and applied automatically at startup.
  - `internal/llm.LLMClient` interface with `FakeLLMClient` (in use now, no
    network) and `HTTPLLMClient` (built, not yet wired to a real service —
    that's Milestone 2b) implementing it.
  - The Go<->Python `llm` contract (`proto/llm.openapi.yaml`, HTTP+JSON —
    ADR-014).
  - `docker-compose.yml` (postgres + backend) and `backend/Dockerfile`.
  - Tests: unit tests for `config`, `llm` (both clients), `logging`
    (verifies the no-transcript-at-info-level redaction actually redacts),
    and `api` handlers (via an in-memory fake `ConversationService`);
    integration tests for `conversation.Service` against a real,
    `testcontainers-go`-managed Postgres.
  - `go build`, `go vet`, `go test`, `gofmt`, and `golangci-lint` all clean.
  - **Verified live, end to end, against a real (native, non-Docker)
    PostgreSQL:** the backend starts, applies its migrations automatically,
    and both `POST /api/v1/chat` and `GET /api/v1/chat/history` return
    correct data — not just unit-tested, actually run and curled.
  - Local setup is documented in `backend/SETUP.md` (Prerequisites through
    Troubleshooting, including the exact `VAANISETU_DATABASE_URL` value)
    and `backend/.env.example`; a thin `backend/Makefile`
    (`run`/`build`/`vet`/`test`/`fmt`/`lint`/`check`) mirrors the
    frontend's `npm run` scripts.
- `docs/DEVELOPMENT.md` §4/§8 updated from `TBD` to the concrete backend
  stack actually used; §4.1 added, pointing at `backend/SETUP.md`.
- **Frontend↔backend integration:** the Angular app now talks to the real Go
  backend over HTTP instead of an in-memory mock.
  - Backend: minimal, hand-written CORS middleware in `internal/api` allows
    exactly one configured origin (`config.Config.AllowedOrigin`, default
    `http://localhost:4200`) — never a `*` wildcard; verified to never
    reflect an arbitrary request `Origin` back. `Routes()` now returns
    `http.Handler` (was `*http.ServeMux`) to wrap it.
  - Frontend: `ConversationRealService` (`core/services/conversation.real.service.ts`)
    implements `ConversationService` with Angular's `HttpClient`
    (`provideHttpClient()` added to `app.config.ts`), calling
    `POST {apiBaseUrl}/v1/chat` and `GET {apiBaseUrl}/v1/chat/history` via
    `environment.apiBaseUrl` (never a hardcoded host). Preserves the mock's
    optimistic-update pacing and stale-response handling (sequence counter
    plus real `Subscription.unsubscribe()` cancellation), and reuses
    `VoiceSessionService`'s existing `error` state for network failures,
    4xx, and 5xx — no new error-handling pattern introduced.
  - `app.config.ts`'s `ConversationService` provider now points at
    `ConversationRealService` (`VoiceSessionService` stays on its mock, per
    ADR-009 — only these two `useClass` lines were expected to change, and
    only one did).
  - `docs/openapi/chat.yaml` gained request/response `example:` blocks
    (real Hindi text and IDs observed during live verification) and a CORS
    note in its top-level description.
  - Verified live: real preflight (`OPTIONS`) and POST round trips against
    a running backend, correct CORS headers, non-reflection of an
    arbitrary `Origin`, and the Angular dev build's compiled bundle
    referencing the real `v1/chat` endpoint path. 75 frontend tests
    (66 previous + 9 new) and all backend tests pass; `ng lint`,
    `golangci-lint`, `gofmt`, and `prettier` all clean.
- **Phase 2, Milestone 2b - Python `llm` service, benchmark, and real
  wiring:**
  - `ai-services/` (Python 3.12+, `uv`, FastAPI + Uvicorn — ADR-015):
    `app/main.py` implements `proto/llm.openapi.yaml` exactly
    (`POST /v1/generate`) plus an unversioned `/healthz`. `app/engines`
    holds the `LLMEngine` capability interface and its one implementation,
    `LlamaCppEngine` (`llama-cpp-python`, local GGUF weights, no network
    call at generation time).
  - Model registry at `ai-services/models.yaml` (docs/ARCHITECTURE.md
    §3.6): three candidates listed, `selected: llama-3.2-3b-instruct`.
  - Lightweight, phase-scoped benchmark (`ai-services/scripts/benchmark.py`,
    seeded/reproducible, isolates each candidate in its own subprocess for
    accurate memory measurement) run on this machine (Apple M5 Pro, 24GB
    RAM) against Qwen2.5-3B-Instruct, Llama-3.2-3B-Instruct, and
    Gemma-2-2B-it on a fixed Hindi/Hinglish prompt set. Full input/output/
    timing recorded in `ai-services/benchmark_results/llm_milestone_2b.json`.
    Llama-3.2-3B-Instruct selected — see `docs/DECISIONS.md` ADR-016 for the
    evidence and reasoning (Qwen produced less fluent/precise Hindi output
    in this benchmark despite its more permissive license; Gemma violated
    the no-emoji system-prompt instruction once, Llama never did).
  - `HTTPLLMClient` (already built in Milestone 2a) is now wired to a real
    service: setting `VAANISETU_LLM_SERVICE_URL` on the backend switches it
    from `FakeLLMClient` with no code change, per ADR-006/the Milestone 2a
    design.
  - `docker-compose.yml` gained an `ai-services` entry (bind-mounts
    `./models/llm` read-only, per docs/ARCHITECTURE.md §6 — weights are
    never baked into the image); `backend`'s `VAANISETU_LLM_SERVICE_URL`
    now points at it.
  - Tests: 13 Python tests (contract tests for `/v1/generate` and
    `/healthz` via a fake `LLMEngine`, registry-loading tests, and
    chat-template-fallback tests for models with no system role) — all
    pass, no real model file needed. `ruff check`/`ruff format --check`
    clean.
  - **Verified live, end to end:** the Python service loads the selected
    model and reports ready; a direct `POST /v1/generate` call returns a
    real, freshly generated Hindi reply; with the Go backend pointed at it
    (`usesFakeLLM:false` in its startup log), a real `POST /api/v1/chat`
    request produces a genuine, fluent, on-topic Hindi story (not a canned
    reply), persisted to PostgreSQL and returned correctly through
    `GET /api/v1/chat/history` — the full Angular-contract-compatible
    chain, actually run, not just unit-tested.
  - `docs/DEVELOPMENT.md` §5/§9/§10 updated from `TBD` to the concrete
    Python stack actually used; §5.1 added, pointing at
    `ai-services/SETUP.md`; repository-structure tree corrected to match
    reality (previously still described a pre-Phase-2 layout).
  - Docker Compose itself (postgres + backend + ai-services all together)
    has not been run end to end — Docker remains unavailable in this
    development environment; each piece has instead been run and verified
    natively. Verify the Compose stack on a machine with Docker before
    treating it as proven.

## Next

- No milestone is currently approved to start. `docs/ROADMAP.md` names
  Phase 3 (Speech-to-Text) as next in order; per `AGENTS.md` §5, work does
  not begin on it until the user decides to move the project there.

## Not started

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

- `AGENTS.md`, `docs/`, `LICENSE`, `frontend/`, `backend/`, `proto/`, and
  now `ai-services/` all exist.
- `frontend/` builds, lints, and tests clean. Its `ConversationService` now
  runs against the real backend (`ConversationRealService`); only
  `VoiceSessionService` still uses a mock (see above).
- `backend/` builds, vets, lints (`golangci-lint`), and tests clean, and has
  now been run for real against a live, native PostgreSQL and a live,
  native `ai-services` instance (see above) — a developer following
  `backend/SETUP.md` and `ai-services/SETUP.md` on this machine can
  reproduce both. Its `testcontainers-go`-based Postgres integration tests
  specifically still require a Docker daemon, which remains unavailable in
  this environment — they skip themselves cleanly rather than failing, and
  have not been run for real against a container.
- `ai-services/` builds its dependencies (`uv sync`, including compiling
  `llama-cpp-python`), tests, lints, and formats clean. Its own tests never
  load a real model (a fake `LLMEngine` is dependency-injected); the model
  actually running has been verified separately, live, per above.
- The `docker-compose.yml` stack (postgres + backend + ai-services) has not
  been run for real — Docker remains unavailable in this environment. Each
  service has instead been verified running natively. `backend/Dockerfile`
  and `ai-services/Dockerfile` have not been built. Worth doing on a
  machine with Docker before either milestone is treated as fully verified
  in every respect.
- The `llm` capability's model is selected (`llama-3.2-3b-instruct`,
  ADR-016). Every other capability's model choice is still `TBD` (see
  ADR-008).
- `frontend/node_modules/`, `frontend/dist/`, `ai-services/.venv/`, local
  Postgres data, and `/models/` (downloaded GGUF weights) are all
  git-ignored via the repository's single root `.gitignore`.
