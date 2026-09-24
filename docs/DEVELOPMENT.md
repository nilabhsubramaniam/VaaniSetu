# DEVELOPMENT.md

Development conventions for VaaniSetu.

The repository currently contains `LICENSE`, `AGENTS.md`, `docs/`,
`frontend/` (Phase 1, done), `backend/` and `proto/` (Phase 2, Milestone
2a), and `ai-services/` (Phase 2, Milestone 2b). Do not invent commands or
tools that are not actually present.

---

## 1. Local development philosophy

- Everything runs on the developer's machine. No hosted dependency is required
  to develop or run VaaniSetu.
- The voice loop must work offline. Network access during development is for
  fetching dependencies and model weights only, never for the runtime voice
  path.
- Prefer the smallest setup that works. Add a service or container only when a
  phase needs it.

Running all three services by hand (three terminals, each workspace's own
`make run`/`npm start`) works but gets old fast, especially when
restarting one that's already running. `scripts/dev.sh` (repo root)
wraps that: `start`/`stop`/`restart`/`status` for all three at once,
freeing each port first so a restart never leaves a stale duplicate
process behind. It doesn't set anything up (Postgres, `.env` files,
downloaded models are still per-workspace `SETUP.md` — see §4.1/§5.1);
it only starts and stops the three processes. Logs land in
`.dev-logs/<service>.log` (git-ignored).

## 2. Repository structure

Current:

```
VaaniSetu/
  LICENSE
  AGENTS.md
  docs/
    PROJECT_GOAL.md
    ARCHITECTURE.md
    ROADMAP.md
    DECISIONS.md
    CURRENT_STATE.md
    DEVELOPMENT.md
    EVALUATION.md
  frontend/                          Angular 22, standalone, real backend
                                      (ConversationService); VoiceSessionService
                                      still mocked
    angular.json, package.json, tsconfig*.json
    eslint.config.js, .prettierrc
    public/fonts/                    self-hosted Noto Sans Devanagari + OFL.txt
    src/
      environments/                  environment.ts / environment.development.ts
      app/
        app.ts / app.html / app.scss     shell: app-header + router-outlet
        app.config.ts, app.routes.ts
        core/
          models/                   turn, voice-state, language
          services/                 ConversationService, VoiceSessionService,
                                     SettingsStore (+ their mock impls)
        assistant/                  conversation route (page + 6 components)
        settings/                   settings route (page + 3 components)
        landing/                    public landing route ("/"): interactive
                                     3D hero + static Phase 1 marketing sections
          landing.page.ts/html/scss
          i18n/                     LandingCopy types + en/hi copy,
                                     LandingI18nService (derives locale from
                                     SettingsStore; no independent state)
          models/                   DemoLanguageNode — hero's decorative demo
                                     set, deliberately separate from the real
                                     LanguageCode/LANGUAGE_OPTIONS
          three/                    Three.js hero + globe runtimes
                                     (scene-manager, core-system, hero-runtime,
                                     language-system, globe-runtime, ...),
                                     lazy-loaded via @defer, never in the
                                     initial bundle
          components/               hero-experience, how-it-works,
                                     text-transform-demo, global-network
        shared/
          components/               app-header, language-selector, status-pill
          styles/                   _tokens.scss, _mixins.scss
  backend/                          Go 1.26+, stdlib net/http, pgx/sqlc
    cmd/api/                        entrypoint
    internal/
      api/                          HTTP handlers, DTOs, CORS
      conversation/                 turn persistence, LLM call, script tagging
      llm/                          LLMClient interface: Fake + HTTP clients
      asr/                          ASRClient interface: Fake + HTTP clients
      tts/                          TTSClient interface: Fake + HTTP clients
      orchestrator/                 Phase 5 turn orchestrator: composes
                                     asr/llm/tts into one voice turn
      config/, db/, logging/
    migrations/                     goose SQL, embedded into the binary
    SETUP.md, Makefile, .env.example
  ai-services/                      Python 3.12+, uv, FastAPI + Uvicorn
    app/
      main.py                      POST /v1/generate, /v1/transcribe, /v1/synthesize, GET /healthz
      config.py, registry.py
      engines/                     LLMEngine + llama_cpp implementation
        asr/                       ASREngine + faster_whisper implementation
        tts/                       TTSEngine + mms_vits/parler_tts/xtts implementations
    scripts/                       download_models.py, benchmark.py, benchmark_asr.py,
                                    benchmark_tts.py, wer.py (shared WER calc),
                                    generate_audio_fixtures.py (macOS-only, ASR fixtures)
    tests/
    eval_data/                     asr_fixtures.yaml (committed manifest, reused as the
                                    TTS benchmark's text prompts too); audio/ (generated,
                                    git-ignored)
    models.yaml                    model registry (docs/ARCHITECTURE.md §3.6)
    benchmark_results/             stored phase-scoped benchmark reports
    Makefile, .env.example, Dockerfile
  proto/                           llm.openapi.yaml, asr.openapi.yaml, tts.openapi.yaml
                                    (Go<->Python contracts)
  docker-compose.yml               postgres + backend + ai-services
  models/                          local weights, git-ignored (not in git)
    llm/                           GGUF files; asr/ and tts/  full repo-snapshot directories
```

`docker/` (a directory of standalone Dockerfiles) was superseded in practice
by one `Dockerfile` per workspace (`backend/Dockerfile`,
`ai-services/Dockerfile`) plus one root `docker-compose.yml` — simpler for
two services with no shared base image need. Update this note if that
stops being true.

## 3. Frontend conventions (Angular + TypeScript + SCSS)

- Framework: Angular 22 (latest stable at Phase 1 implementation time),
  TypeScript ~6.0.x, SCSS. Tooling: Angular CLI 22, resolved via
  `npx @angular/cli@latest` so the pinned version stays current at each new
  workspace creation (see ADR-011).
- Standalone components only, zoneless change detection (Angular 22 default —
  no `zone.js`), signals for reactive state, `@if`/`@for`/`@switch` template
  control flow. No `NgModule` anywhere.
- Every component sets `changeDetection: ChangeDetectionStrategy.OnPush`
  explicitly.
- Components small and focused; feature folders under `src/app/`
  (`assistant/`, `settings/`, `shared/`, `core/`) rather than Angular
  modules.
- Styling in SCSS, component-scoped; shared tokens (color, spacing, typography)
  live in `src/app/shared/styles/_tokens.scss` and `_mixins.scss`, imported via
  `@use`. Only Hindi (Devanagari) is self-hosted so far
  (`public/fonts/NotoSansDevanagari-Regular.woff2`, SIL OFL 1.1 licensed, see
  `public/fonts/OFL.txt`); Latin/Hinglish text uses the system font stack. The
  other nine long-term scripts are added when Phase 6 activates each language.
- No UI component framework (Angular Material, PrimeNG, Bootstrap, Tailwind)
  and no icon library — a lightweight custom design system only (ADR-011).
  Icons are hand-authored inline SVG.
- All data access goes through an abstract-class interface + DI token
  (`ConversationService`, `VoiceSessionService` in `core/services/`). Only
  the two `useClass` lines in `app.config.ts` ever change between
  milestones (ADR-009); UI components never call `fetch` / `HttpClient`
  directly. As of Milestone 2b's frontend integration, `ConversationService`
  is wired to `ConversationRealService` (`conversation.real.service.ts`),
  which calls the Go backend over `HttpClient`; `VoiceSessionService` is
  still `VoiceSessionMockService` — it has no backend counterpart yet.
  `*.mock.service.ts` implementations remain in the tree and are still used
  in tests.
- State: no state-management library. Two services hold all state as signals
  (`ConversationRealService.turns`, `VoiceSessionMockService.state`), plus
  `SettingsStore` for the one persisted preference (ADR-011).
- `src/environments/environment.ts` / `environment.development.ts` hold an
  `apiBaseUrl` value (`/api` in production, `http://localhost:8080/api` in
  development). `ConversationRealService` reads it for both endpoints;
  never hardcode a host in a service.
- Accessibility: keyboard-usable, labelled controls, visible focus rings, an
  `aria-live` region announcing voice-state changes, `prefers-reduced-motion`
  respected for state animations.

### 3.1 Frontend commands

Run from `frontend/`:

| Command | Purpose |
|---|---|
| `npm start` (`ng serve`) | Dev server with live reload, calls the real backend at `apiBaseUrl` (needs `make run` in `backend/` alongside it) |
| `npm run build` (`ng build`) | Production build to `frontend/dist/` |
| `npm test` (`ng test`) | Vitest unit/component tests, single run |
| `npm run lint` (`ng lint`) | ESLint |
| `npx prettier --check "src/**/*.{ts,html,scss}"` | Formatting check (`--write` to fix) |

## 4. Backend conventions (Go)

- Language: Go 1.26 (`backend/go.mod`, matching the toolchain actually used).
  Module path: `github.com/nilabhsubramaniam/VaaniSetu/backend`, matching the
  repository's real remote.
- Layout: `cmd/api/` the entrypoint; `internal/{api,asr,conversation,llm,
  config,db,logging}` (asr added Phase 3); `pkg/` still unused — nothing
  has qualified as a genuinely reusable helper yet. `internal/gateway/`,
  `internal/orchestrator/`, `internal/auth/`, `internal/documents/` are
  deliberately not created — they belong to later phases (voice loop,
  deferred auth, RAG).
- The backend runs no inference and imports no model. `internal/llm.LLMClient`
  is the capability interface; `FakeLLMClient` (no network) and
  `HTTPLLMClient` (calls the Python `llm` service per `proto/llm.openapi.yaml`)
  both implement it, selected by one config value
  (`config.Config.UsesFakeLLM`), never a code change.
  `internal/asr.ASRClient` (Phase 3) follows the identical shape —
  `FakeASRClient`/`HTTPASRClient`, selected by `config.Config.UsesFakeASR`.
- HTTP router: standard library `net/http`, using Go 1.22+'s method+path
  `ServeMux` patterns. No chi/gin — see ADR-013.
- CORS: a small hand-written middleware in `internal/api` (`Server.withCORS`),
  not a library. Allows exactly one configured origin
  (`config.Config.AllowedOrigin`, env `VAANISETU_ALLOWED_ORIGIN`, default
  `http://localhost:4200` for Angular's dev server) — never a `*` wildcard,
  and the allowed origin is never derived from the request.
- Config: hand-rolled `internal/config.Load()` reading `os.Getenv`, no
  library.
- Structured logging: standard library `log/slog`
  (`internal/logging.New`). The "never log transcript/document content at
  info level" rule (§12) is enforced in code, not just by convention: see
  `internal/logging.RedactedText`.
- Errors are returned and wrapped with context, not panicked, outside `main`.
- Database access: `pgx/v5` + `sqlc`-generated queries
  (`internal/db/queries/*.sql` -> `sqlc generate` -> `internal/db/*.go`, never
  hand-edited). See ADR-013.
- Migrations: `goose`, one file per version with `-- +goose Up`/`Down`
  annotations, embedded into the compiled binary
  (`backend/migrations/embed.go`) and applied automatically by
  `db.Migrate` at startup — see ADR-013.
- Linting: `golangci-lint` (v2 config format, `backend/.golangci.yml`), its
  own `standard` set plus `errcheck`/`staticcheck`/`unused`/`ineffassign`.
  Run via `golangci-lint run ./...` from `backend/`.
- API documentation: hand-maintained OpenAPI at `docs/openapi/chat.yaml`
  (frontend-facing) and `proto/llm.openapi.yaml` (the Go<->Python `llm`
  contract) — not swaggo-generated. See ADR-013.
- HTTP handlers thin; logic in packages that are unit-testable without a
  server (`internal/api` depends on the `ConversationService` interface,
  not the concrete `conversation.Service`, so handler tests use an
  in-memory fake rather than a real database).
- Commands: `go build ./...`, `go vet ./...`, `go test ./...`, `gofmt -l .`,
  `golangci-lint run ./...`, all run from `backend/` (or `make check` — see
  `backend/Makefile`).

### 4.1 Backend local setup and commands

Full walkthrough (Postgres install/start, role/database creation, the
exact `VAANISETU_DATABASE_URL` value, migrations, running, verifying, and
troubleshooting the "VAANISETU_DATABASE_URL is required" error): see
[`backend/SETUP.md`](../backend/SETUP.md). Copy `backend/.env.example` to
get the required/optional variables. Summary:

| Command | Purpose |
|---|---|
| `go run ./cmd/api` (or `make run`) | Start the backend; applies migrations automatically |
| `go build ./...` (or `make build`) | Compile |
| `go vet ./...` (or `make vet`) | Static analysis |
| `go test ./...` (or `make test`) | Unit tests always run; Postgres integration tests skip themselves without Docker |
| `gofmt -l .` (or `make fmt`) | Formatting check |
| `golangci-lint run ./...` (or `make lint`) | Lint |
| `make check` | All of the above, in order |

Docker (`docker compose up`) is optional — the backend runs natively
against any reachable PostgreSQL, as `backend/SETUP.md` demonstrates.

## 5. Python / AI conventions

- Language: Python 3.12+ (`ai-services/pyproject.toml`'s `requires-python`);
  pinned exactly via `ai-services/uv.lock`. See ADR-015.
- Dependency management: `uv`, with `pyproject.toml` + `uv.lock`. Run
  `uv sync` from `ai-services/` once per checkout/dependency change.
- One module per capability (`vad`, `asr`, `langid`, `llm`, `tts`, `rag`), each
  exposing its service contract and wrapping a model engine behind an interface.
  Two exist so far: `app.engines` for `llm` (Milestone 2b —
  `app/engines/base.py`'s `LLMEngine` interface,
  `app/engines/llama_cpp_engine.py`'s implementation) and
  `app.engines.asr` for `asr` (Milestone 3b — `app/engines/asr/base.py`'s
  `ASREngine` interface, `app/engines/asr/faster_whisper_engine.py`'s
  implementation). Both are hosted in the same FastAPI process
  (docs/DECISIONS.md ADR-017) — "one module per capability" is a
  code-organization convention here, not a one-process-per-capability
  deployment rule.
- Web framework: FastAPI + Uvicorn (ADR-015), exposing exactly the routes
  each capability's contract in `proto/` defines — `POST /v1/generate` for
  `llm`, `POST /v1/transcribe` for `asr` — plus one unversioned `/healthz`
  for the "model warm/ready" check `docs/ARCHITECTURE.md` §3.3 asks for.
- Inference engines: `llama-cpp-python` (GGUF weights) for `llm`,
  `faster-whisper`/CTranslate2 for `asr`. Both chosen over an
  Apple-Silicon-only engine specifically so the service still runs inside
  the project's actual Linux-container deployment target — see
  ADR-015/ADR-018.
- Model identity and parameters come from a model-registry config file
  (`ai-services/models.yaml`, one top-level key per capability), never
  hardcoded. Application code references a capability, not a model name.
  Download registry-listed weights with
  `ai-services/scripts/download_models.py` into the git-ignored
  `models/<capability>/` directory before starting the service.
- Offline jobs (dataset prep, evaluation, fine-tuning) live in separate modules,
  never imported by the request path. Phase-scoped benchmarking scripts
  (`ai-services/scripts/benchmark.py` for `llm`,
  `ai-services/scripts/benchmark_asr.py` for `asr`) are one such offline job.
- Audio utilities (resampling, framing) live in one shared module — for
  now, `app/engines/asr/faster_whisper_engine.py` handles this directly
  (faster-whisper decodes containers itself via `av`); split it out into
  a shared module if a second capability needs the same logic.

### 5.1 AI-services setup and commands

Full walkthrough (installing `uv`, downloading models, running the
service, wiring it into the backend, troubleshooting): see
[`ai-services/SETUP.md`](../ai-services/SETUP.md). Summary — run from
`ai-services/`:

| Command | Purpose |
|---|---|
| `uv sync` (or `make sync`) | Install/update dependencies into `.venv` |
| `uv run uvicorn app.main:app --port 8090` (or `make run`) | Start the service |
| `uv run scripts/download_models.py` (or `make download-models`) | Download every registry-listed model into `models/<capability>/` (`--capability llm\|asr` to filter) |
| `uv run scripts/benchmark.py` (or `make benchmark`) | Run the `llm` phase-scoped latency/memory/quality benchmark |
| `uv run scripts/generate_audio_fixtures.py` | macOS-only: synthesize `eval_data/asr_fixtures.yaml`'s text into test WAV files |
| `uv run scripts/benchmark_asr.py` | Run the `asr` phase-scoped WER/latency/memory benchmark |
| `uv run pytest` (or `make test`) | Unit + contract tests |
| `uv run ruff check .` (or `make lint`) | Lint |
| `uv run ruff format --check .` (or `make fmt-check`) | Formatting check (`make fmt` to fix) |
| `make check` | test + fmt-check + lint |

## 6. Environment configuration

- All configuration comes from environment variables (and a git-ignored local
  `.env` for development). No secrets or environment-specific values in code.
- Each workspace documents its variables in a checked-in `.env.example` with
  safe placeholder values (added per phase).
- The model-registry file path, database URL, and service addresses are
  environment-provided.

## 7. Dependency management

- Pin exact versions everywhere (lockfiles committed).
- Add a dependency only when the approved task needs it; justify anything
  non-obvious in the task report.
- No dependency whose license conflicts with the project's distribution intent
  without an ADR.

## 8. Testing

- Frontend: Vitest, Angular 22's built-in unit-test builder
  (`@angular/build:unit-test`, run via `ng test`), with jsdom. Globals
  (`describe`/`it`/`expect`/`vi`) are enabled via `vitest/globals` in
  `tsconfig.spec.json` — no explicit import needed in spec files.
- Backend: table-driven unit tests; integration tests against a real
  PostgreSQL via `testcontainers-go` for the data layer — these skip
  themselves with a clear message when no Docker daemon is available rather
  than failing the suite; contract tests against mocked AI services
  (`internal/api`'s handler tests use an in-memory fake `ConversationService`).
- Python: `pytest`; golden-file tests for text / audio processing; metric
  calculations unit-tested; model-quality checks run as evaluation, not as unit
  tests.
- A change is not done while its tests fail. Report failures with output.
- Evaluation requirements for a phase (see `docs/EVALUATION.md`) must be run and
  recorded before that phase is done.

## 9. Linting

- Frontend: ESLint via `@angular-eslint/schematics` (its `22.x` line, matching
  Angular 22), configured in `frontend/eslint.config.js`. Run via `ng lint`.
- Backend: `gofmt` plus `golangci-lint` (§4).
- Python: `ruff check .` (§5).
- Lint must pass for the affected workspace before a task is done.

## 10. Formatting

- Frontend: Prettier, using the `.prettierrc` the Angular CLI scaffolds by
  default. Run via `npx prettier --check "src/**/*.{ts,html,scss}"` (or
  `--write` to fix); not yet wired into an `npm` script.
- Backend: `gofmt` / `goimports`.
- Python: `ruff format` (§5).
- Formatting is enforced, not debated. CI checks it once CI exists.

## 11. Error handling

- Fail loudly in development, degrade safely in the user-facing path.
- Never swallow an error silently. Log it or return it with context.
- User-facing errors are localized and do not leak internal detail or private
  content.
- The voice loop handles a failed stage gracefully (for example: ASR failure
  produces a spoken "I didn't catch that", not a crash) - specifics per phase.

## 12. Logging

- Structured logging in each service. Format / library **TBD** per workspace.
- **Never log user transcript or document content at info level.** Content may
  appear only in explicit, local, opt-in debug traces.
- No third-party log sinks. Logs are local.
- Log levels: error for failures needing attention, warn for recoverable
  anomalies, info for lifecycle events, debug for development detail.

## 13. Git practices

- Do not commit or push unless the user asks.
- If asked to commit on the default branch, create a branch first.
- One logical change per commit; message explains why.
- No AI attribution or co-author trailers in commits or PRs.
- Keep diffs minimal and scoped to the approved task; no drive-by refactors.

## 14. Secret management

- No secrets, credentials, or API keys in the repository, ever.
- Local secrets live in a git-ignored `.env`. `.gitignore` must cover `.env`,
  `.env.*` (except `.env.example`), and credential files from the first commit
  of each workspace.
- If a secret is committed by accident, treat it as compromised: rotate it,
  then scrub history.

## 15. Model file handling

- Model weights are **never** committed. `.gitignore` covers the `models/`
  directory and weight extensions (`*.gguf`, `*.pt`, `*.pth`, `*.bin`,
  `*.safetensors`, `*.onnx`, `*.ckpt`) from the first AI phase.
- Weights are downloaded into a local, git-ignored directory (later, a
  host-mounted Docker volume), verified by checksum against the model registry.
- Weights are never baked into container images.
- Datasets and fine-tuned adapters are versioned outside the main git repo
  (mechanism **TBD**, Phase 8 / 10).

## 16. Documentation expectations

- The eight files in `AGENTS.md` section 3 are the documentation set. Do not add
  more files to restate what they cover.
- Update documentation in the same task as the change:
  - Architectural decision -> `docs/DECISIONS.md`.
  - Milestone boundary -> `docs/CURRENT_STATE.md` and `docs/ROADMAP.md` status.
  - New convention / command / tool -> this file (replace the relevant `TBD`).
  - New or changed metric -> `docs/EVALUATION.md`.
- When a `TBD` here is resolved, replace it with the concrete choice and, if it
  was an architectural choice, add an ADR.
