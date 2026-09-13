# DEVELOPMENT.md

Development conventions for VaaniSetu.

The repository currently contains `LICENSE`, `AGENTS.md`, `docs/`, and
`frontend/` (Phase 1, done). `backend/` and `ai-services/` do not exist yet —
their conventions stay **TBD** until Phase 2 introduces them. Do not invent
commands or tools that are not actually present.

---

## 1. Local development philosophy

- Everything runs on the developer's machine. No hosted dependency is required
  to develop or run VaaniSetu.
- The voice loop must work offline. Network access during development is for
  fetching dependencies and model weights only, never for the runtime voice
  path.
- Prefer the smallest setup that works. Add a service or container only when a
  phase needs it.

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
  frontend/                          Angular 22, standalone, mock data only
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
        shared/
          components/               app-header, language-selector, status-pill
          styles/                   _tokens.scss, _mixins.scss
```

Target (created incrementally by the phases that need each part):

```
VaaniSetu/
  frontend/        Angular + TypeScript + SCSS        (Phase 1 — done)
  backend/         Go API, orchestrator, migrations   (Phase 2)
  ai-services/     Python inference + offline jobs    (Phase 2+)
  proto/           shared service contracts           (Phase 2)
  docker/          Dockerfiles, compose files         (Phase 2)
  docs/            persistent documentation           (exists)
  models/          local weights, git-ignored         (Phase 2+)
```

Exact sub-layout of `backend/` and `ai-services/` is **TBD**, decided in
Phase 2 and documented here at that time.

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
  (`ConversationService`, `VoiceSessionService` in `core/services/`). Phase 1
  provides only the mock implementations (`*.mock.service.ts`), wired in
  `app.config.ts`. UI components never call `fetch` / `HttpClient` directly;
  when Phase 2 adds a real backend client, only the two `useClass` lines in
  `app.config.ts` change.
- State: no state-management library. Two services hold all state as signals
  (`ConversationMockService.turns`, `VoiceSessionMockService.state`), plus
  `SettingsStore` for the one persisted preference (ADR-011).
- `src/environments/environment.ts` / `environment.development.ts` hold an
  `apiBaseUrl` placeholder and a `useMockData` flag for Phase 2; nothing reads
  `apiBaseUrl` yet.
- Accessibility: keyboard-usable, labelled controls, visible focus rings, an
  `aria-live` region announcing voice-state changes, `prefers-reduced-motion`
  respected for state animations.

### 3.1 Frontend commands

Run from `frontend/`:

| Command | Purpose |
|---|---|
| `npm start` (`ng serve`) | Dev server with live reload, mock data only |
| `npm run build` (`ng build`) | Production build to `frontend/dist/` |
| `npm test` (`ng test`) | Vitest unit/component tests, single run |
| `npm run lint` (`ng lint`) | ESLint |
| `npx prettier --check "src/**/*.{ts,html,scss}"` | Formatting check (`--write` to fix) |

## 4. Backend conventions (Go)

- Language: Go. Version and module path: **TBD** (Phase 2).
- Layout: `cmd/` for entrypoints, `internal/` for packages not meant for import,
  `pkg/` only for genuinely reusable helpers.
- The backend runs no inference and imports no model. It calls the Python AI
  service over the `proto/` contracts.
- Errors are returned and wrapped with context, not panicked, outside `main`.
- Database access through a single data layer; SQL migrations are versioned
  files (tool **TBD**, Phase 2).
- HTTP handlers thin; logic in packages that are unit-testable without a server.

## 5. Python / AI conventions

- Language: Python. Version: **TBD** (Phase 2), pin exactly - ML dependencies
  are version-sensitive.
- Dependency management: **TBD** (candidate: `uv` or `poetry`), decided in
  Phase 2 and pinned with a lockfile.
- One module per capability (`vad`, `asr`, `langid`, `llm`, `tts`, `rag`), each
  exposing its service contract and wrapping a model engine behind an interface.
- Model identity and parameters come from a model-registry config file, never
  hardcoded. Application code references a capability, not a model name.
- Offline jobs (dataset prep, evaluation, fine-tuning) live in separate modules,
  never imported by the request path.
- Audio utilities (resampling, framing) live in one shared module.

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
- Backend: table-driven unit tests; integration tests against a real PostgreSQL
  (containerized) for the data layer; contract tests against mocked AI services.
- Python: `pytest`; golden-file tests for text / audio processing; metric
  calculations unit-tested; model-quality checks run as evaluation, not as unit
  tests.
- A change is not done while its tests fail. Report failures with output.
- Evaluation requirements for a phase (see `docs/EVALUATION.md`) must be run and
  recorded before that phase is done.

## 9. Linting

- Frontend: ESLint via `@angular-eslint/schematics` (its `22.x` line, matching
  Angular 22), configured in `frontend/eslint.config.js`. Run via `ng lint`.
- Backend: `gofmt` plus a linter aggregator (candidate: `golangci-lint`),
  **TBD** (Phase 2).
- Python: a linter (candidate: `ruff`), **TBD** (Phase 2).
- Lint must pass for the affected workspace before a task is done.

## 10. Formatting

- Frontend: Prettier, using the `.prettierrc` the Angular CLI scaffolds by
  default. Run via `npx prettier --check "src/**/*.{ts,html,scss}"` (or
  `--write` to fix); not yet wired into an `npm` script.
- Backend: `gofmt` / `goimports`.
- Python: an autoformatter (candidate: `ruff format` or `black`), **TBD**.
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
