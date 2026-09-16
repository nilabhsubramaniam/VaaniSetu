# DECISIONS.md

Architecture Decision Records for VaaniSetu.

Record a decision here when it shapes the architecture, the technology set, the
development process, or the AI/ML approach. Do **not** record trivial
implementation details.

Each ADR uses: **Decision / Reason / Alternatives considered / Impact /
Status**.

**Status values:** `Accepted` | `Superseded by ADR-NNN` | `Deprecated`

---

## ADR-001 - Local-first, privacy-first architecture

- **Decision:** Every component in the critical voice loop (VAD, ASR, language
  detection, LLM, RAG, TTS, database) runs on the user's own hardware by
  default. No audio or transcript is required to leave the device for the
  assistant to function. Any cloud model is an explicit, per-user opt-in
  override, never a silent fallback.
- **Reason:** Privacy is the product's core promise and its main differentiator
  from mainstream cloud assistants. It must be an architectural guarantee, not a
  configuration option that can quietly degrade.
- **Alternatives considered:**
  - Cloud-first with a local fallback - rejected: breaks the privacy promise and
    the offline guarantee.
  - Hybrid with automatic cloud offload under load - rejected: "silent
    fallback" is exactly the failure mode this project exists to avoid.
- **Impact:** Model sizes are bounded by consumer hardware. Requires CPU-capable
  model choices and quantization. Shapes deployment (local install, not a hosted
  service) and security rules (no egress in the voice path).
- **Status:** Accepted.

---

## ADR-002 - Separate Angular, Go, and Python responsibilities

- **Decision:** Three-tier separation. Angular renders the UI and handles audio
  in the browser. Go owns sessions, auth, orchestration, and persistence, and
  runs no inference. Python runs all inference behind versioned service
  contracts. Angular talks only to Go; Go talks to Python over defined
  contracts.
- **Reason:** Each language is used where it is strongest - Angular for a rich
  client, Go for concurrent orchestration and I/O, Python for the ML ecosystem.
  Hard boundaries keep inference swappable and keep the orchestration logic in
  one place.
- **Alternatives considered:**
  - Single Python full-stack service - rejected: weaker concurrency story for
    the turn orchestrator, and couples the app lifecycle to the ML runtime.
  - Go calling models directly via bindings - rejected: cuts the project off
    from the Python ML ecosystem and makes model swaps a rebuild.
- **Impact:** Requires a shared contract layer (`proto/` or equivalent) and
  cross-service integration tests. Adds process boundaries to run locally
  (handled by Docker Compose).
- **Status:** Accepted.

---

## ADR-003 - Use pretrained open-source models, not foundation training

- **Decision:** VaaniSetu composes existing pretrained open-source models for
  ASR, LLM, TTS, embeddings, VAD, and language ID. It does not train foundation
  models from scratch.
- **Reason:** Foundation training is out of scope in cost, data, and time, and
  strong open-source Indian-language models already exist. The project's value
  is in integration, privacy, and evaluation, not pretraining.
- **Alternatives considered:**
  - Train a small in-house model - rejected: enormous effort for a likely
    worse result than existing open models.
- **Impact:** Effort goes into selection, benchmarking, integration, and
  optional adapter fine-tuning. License review per model becomes mandatory.
- **Status:** Accepted.

---

## ADR-004 - Establish a pretrained baseline before any fine-tuning

- **Decision:** For each AI capability, a pretrained model is deployed and
  evaluated against `docs/EVALUATION.md` targets before any fine-tuning is
  considered. Fine-tuning is only undertaken to close a specific,
  evaluation-proven gap.
- **Reason:** Fine-tuning against an unmeasured "this feels weak" wastes effort
  on the wrong target. A baseline tells you which language or domain actually
  needs work.
- **Alternatives considered:**
  - Fine-tune early for Hinglish quality - rejected: premature; open models may
    already meet targets, and there is no data pipeline yet.
- **Impact:** Fine-tuning (Phase 10) is gated on the dataset pipeline (Phase 8)
  and the evaluation harness (Phase 9).
- **Status:** Accepted.

---

## ADR-005 - RAG for knowledge, fine-tuning for behavior

- **Decision:** Knowledge retrieval problems are solved with RAG (retrieval over
  a `pgvector` index). Fine-tuning is reserved for behavior, language
  adaptation, output formatting, and domain adaptation, and only when evaluation
  shows it is needed.
- **Reason:** Baking knowledge into weights is expensive, hard to update, and
  prone to hallucination. RAG keeps knowledge current, inspectable, and
  per-user.
- **Alternatives considered:**
  - Fine-tune documents into the model - rejected: stale, costly, and leaks
    private data into weights.
- **Impact:** Requires the RAG subsystem (Phase 7): chunking, embeddings,
  `pgvector`, reranking, grounded prompting.
- **Status:** Accepted.

---

## ADR-006 - Keep AI models replaceable

- **Decision:** Every model sits behind a capability interface (`asr`, `llm`,
  `tts`, `embeddings`, ...). Callers depend on the interface. Model identity and
  runtime parameters live in a configuration registry, not in code. A model swap
  must not require changes outside the Python service and its config.
- **Reason:** The open-source model landscape moves fast and licenses change.
  The project must be able to swap an engine without touching Go or Angular.
- **Alternatives considered:**
  - Pick the "best" model now and integrate directly - rejected: creates
    coupling that is expensive to undo when a better or better-licensed model
    appears.
- **Impact:** Requires a model registry file and wrapper classes per engine.
  Slightly more upfront structure in the Python service.
- **Status:** Accepted.

---

## ADR-007 - Milestone-driven development

- **Decision:** Development follows the ordered phases in `docs/ROADMAP.md`. One
  phase is active at a time. The workflow is ANALYZE -> PLAN -> WAIT FOR
  APPROVAL -> IMPLEMENT -> TEST -> REVIEW -> UPDATE STATE -> WAIT. Agents never
  advance phases automatically; the user controls progression.
- **Reason:** A local voice assistant is a large system. Building it in
  approved, testable increments keeps scope controlled and quality measurable,
  and keeps the user in control of direction.
- **Alternatives considered:**
  - Build the full pipeline in one pass - rejected: unreviewable, untestable,
    and high risk of wasted work.
- **Impact:** Requires `docs/CURRENT_STATE.md` upkeep and a plan-and-approve
  gate before each implementation task. Defined in `AGENTS.md`.
- **Status:** Accepted.

---

## ADR-008 - Model selection is deferred and evidence-based

- **Decision:** No concrete ASR, LLM, TTS, or embedding model is selected during
  Phase 0. Documents may list **candidates**. A model becomes "selected" only
  after it is benchmarked on the target hardware for latency, memory, and
  Indian-language / Hinglish / code-switching quality, and its license has been
  checked against the project's distribution intent. The selection is then
  recorded as its own ADR.
- **Reason:** Reputation is not evidence. Some well-known Indian-language models
  carry non-commercial or research-restricted licenses, and hardware fit can
  only be known by measurement on the actual machine.
- **Alternatives considered:**
  - Lock in a model stack now from published benchmarks - rejected: skips
    hardware fit and the license check, and creates premature coupling against
    ADR-006.
- **Impact:** Phases 2, 3, 4, and 7 each include a benchmarking step whose
  result feeds a model-selection ADR. Until then, capability model choices are
  `TBD`.
- **Status:** Accepted.

---

## ADR-009 - UI first, against mock data

- **Decision:** The first implementation milestone (Phase 1) builds the Angular
  UI against mock / local data, with no real LLM, STT, TTS, RAG, database, or Go
  API connected. Data access sits behind a service interface with a mock
  implementation so real clients can be substituted later without UI changes.
- **Reason:** A visible UI shell makes later phases concrete and testable and
  lets interaction design settle before backend cost is incurred. Mock-first
  keeps Phase 1 free of backend dependencies.
- **Alternatives considered:**
  - Backend / LLM first - rejected by the project brief; also leaves nothing
    demonstrable and interactive early.
- **Impact:** Phase 2 includes the work of replacing the mock data-access
  implementation with a real backend client.
- **Status:** Accepted.

---

## ADR-010 - PostgreSQL with pgvector as the only datastore

- **Decision:** PostgreSQL holds application data; the `pgvector` extension
  holds embeddings for retrieval. No separate dedicated vector database.
- **Reason:** One datastore to operate, back up, and encrypt at rest. `pgvector`
  is sufficient at the scale of a single local install and keeps the local
  footprint small.
- **Alternatives considered:**
  - A dedicated vector store alongside PostgreSQL - rejected: extra operational
    surface and another container for no benefit at local-install scale.
- **Impact:** Retrieval performance tuning (HNSW index parameters) happens
  within PostgreSQL in Phase 7. Revisit only if scale outgrows it.
- **Status:** Accepted.

---

## ADR-011 - Phase 1 frontend stack: latest Angular, zoneless, no UI framework, no state library

- **Decision:** The Angular workspace uses the latest stable Angular release
  at implementation time (Angular 22, resolved via `npx @angular/cli@latest`
  rather than a pinned older version), its default zoneless change detection,
  standalone components only, and Vitest as the test runner (Angular 22's
  built-in default). No UI component framework (Angular Material, PrimeNG,
  Bootstrap, Tailwind) and no state-management library (NgRx, Akita, Elf) are
  used. All conversation and voice state lives in two plain signal-backed
  services (`ConversationService`, `VoiceSessionService`), each defined as an
  abstract class used as both interface and DI token, with a mock
  implementation provided in `app.config.ts`.
- **Reason:** "Latest stable, modern architecture" (the Phase 1 brief) is
  satisfied by simply picking up what the current Angular CLI scaffolds by
  default, rather than adding anything on top of it. The interface itself —
  mic states, per-turn language badges, multi-script text — is small and
  distinctive enough that a general UI kit would need to be fought for the
  parts that matter, while the entire Phase 1 state (one turn list, one
  voice-state value, one settings preference) is naturally owned by two
  small services; a state library would be exactly the unnecessary
  abstraction the project's guiding principles warn against.
- **Alternatives considered:**
  - Pin an older, more "battle-tested" Angular LTS version - rejected: the
    brief explicitly asked for the latest stable version, and Angular 22's
    defaults (zoneless, Vitest) are themselves less code to maintain, not
    more risk.
  - Angular Material for form controls and layout - rejected: no strong
    reason surfaced in analysis (requirement per the approved plan), and its
    theming would need to be substantially overridden for the voice-first
    interaction pieces anyway.
  - NgRx for conversation/voice state - rejected: no cross-cutting state
    complexity exists yet to justify it; revisit only if a future phase
    demonstrably needs it.
- **Impact:** A model swap or a real backend integration (Phase 2) changes
  only the two `useClass` lines in `app.config.ts`. Keeping pace with
  "latest Angular" means re-running `npx @angular/cli@latest update` checks
  periodically rather than assuming the version stays 22.x forever.
- **Status:** Accepted.

## ADR-012 - Self-host only the Devanagari font Phase 1 actually needs

- **Decision:** Phase 1 self-hosts a single font file, Noto Sans Devanagari
  (SIL OFL 1.1, `public/fonts/`), for Hindi text. Latin and Hinglish text use
  the system font stack. The other nine long-term-language scripts are not
  bundled yet.
- **Reason:** `docs/ARCHITECTURE.md` requires self-hosted fonts (no CDN
  dependency, offline-capable) for whichever scripts are actually in use.
  Phase 1's scope is Hindi and Hinglish only (`docs/PROJECT_GOAL.md`), so
  bundling all eleven languages' fonts now would be unused weight with no
  phase to justify it.
- **Alternatives considered:**
  - Load all long-term scripts' fonts now - rejected: no language beyond
    Hindi/Hinglish is enabled in the UI yet; this is exactly the "future
    feature leaking into current scope" the roadmap discipline warns against.
  - Use a CDN-hosted Google Fonts `<link>` - rejected: violates the
    self-hosted, offline-capable requirement in `docs/ARCHITECTURE.md` §2.
- **Impact:** Phase 6 (Indian Language Support) adds one font per language as
  each is activated, following this same pattern.
- **Status:** Accepted.

## ADR-013 - Phase 2 Go backend stack: router, migrations, DB access, API docs

- **Decision:** Four related Phase 2 backend choices, recorded together the
  same way ADR-011 bundled Phase 1's frontend stack:
  1. **HTTP router:** the standard library's `net/http`, using Go 1.22+'s
     method+path `ServeMux` patterns. No chi, no gin.
  2. **Migrations:** `pressly/goose`, one SQL file per version with
     `-- +goose Up`/`Down` annotations, embedded into the compiled binary via
     `go:embed` and applied automatically at startup (`internal/db.Migrate`).
  3. **Database access:** `jackc/pgx/v5` as the driver, with `sqlc` generating
     typed query code from `internal/db/queries/*.sql` against the real
     schema.
  4. **API documentation:** hand-maintained OpenAPI YAML
     (`docs/openapi/chat.yaml`, `proto/llm.openapi.yaml`) instead of
     swaggo/`swag` annotation-generated specs.
- **Reason:**
  1. Phase 2 has exactly two endpoints and zero path parameters — chi/gin's
     main advantage (ergonomic routing, path-param extraction) isn't needed
     yet, and stdlib's Go 1.22+ routing already covers it at zero new
     dependency.
  2. goose's `go:embed` support lets the compiled binary apply its own
     schema with no external migration files at runtime — a real property
     for the "one self-contained local install" deployment target in
     `docs/ARCHITECTURE.md` §6, which golang-migrate's typical usage doesn't
     make as natural.
  3. Postgres is the project's only datastore (ADR-010), and `pgvector`
     (Phase 7) works best with pgx's native type extensions. `sqlc` removes
     hand-written scan/exec boilerplate and catches SQL errors at build
     time against the real schema — it already pays for itself at Phase 2's
     four queries, and every later phase adds more.
  4. At two endpoints, a ~130-line hand file is less machinery than
     installing `swag`, running codegen, and keeping annotation comments
     in the Go source synced with it. This is a scale-dependent call, not a
     permanent one — see Impact.
- **Alternatives considered:**
  - `chi` or `gin` for routing - rejected for now: no path parameters exist
    yet to justify them.
  - `golang-migrate` for migrations - a reasonable alternative, rejected
    only because its typical usage pattern relies on external migration
    files rather than an embedded binary.
  - Raw `database/sql` with hand-written scans, no `sqlc` - rejected: the
    boilerplate and drift-from-schema risk isn't worth avoiding one
    build-time code-generation step.
  - `swaggo/swag` annotations - rejected for Phase 2's endpoint count; see
    Impact for when to revisit.
- **Impact:** Revisit the router once Phase 5's orchestrator or Phase 7's
  document API add path-parameterized routes. Revisit swaggo once the
  endpoint count grows enough that keeping `docs/openapi/chat.yaml` in sync
  by hand becomes real effort — Phase 5 or Phase 7 are the likely triggers
  for both. `sqlc`'s generated code in `internal/db/` is checked into git,
  so a missing `sqlc` binary never blocks a build — only running `sqlc
  generate` after changing a query does.
- **Status:** Accepted.

## ADR-014 - HTTP+JSON, not gRPC, for the Go<->Python `llm` contract (Phase 2)

- **Decision:** The Go<->Python contract for the `llm` capability
  (`proto/llm.openapi.yaml`) is HTTP+JSON, not gRPC/Protocol Buffers, even
  though it lives in the `proto/` directory named in `docs/DEVELOPMENT.md`'s
  target tree.
- **Reason:** `docs/ARCHITECTURE.md` §4 explicitly allows "gRPC or HTTP...
  `proto/` (or equivalent)" — this uses that flexibility rather than
  deviating from it. gRPC's real advantage over HTTP+JSON here is
  streaming, and `docs/ROADMAP.md` Phase 2 explicitly defers streaming
  output to Phase 11. Standing up `protoc` and code generation for both Go
  and Python for one unary call (`POST /v1/generate`) would be more
  tooling than Phase 2's actual need justifies.
- **Alternatives considered:**
  - gRPC with `.proto` definitions - rejected for Phase 2 only: its main
    benefit doesn't apply yet, and it adds a code-gen step in both
    languages for a single request/response call.
- **Impact:** `proto/` holds OpenAPI/JSON-schema-style contracts, not
  `.proto` files, for as long as this decision stands. Revisit when Phase 11
  (real-time streaming) or Phase 3/4 (audio framing, which benefits from
  binary transport) actually need what gRPC provides — at that point this
  ADR should be superseded, not silently ignored.
- **Status:** Accepted.

## ADR-015 - Phase 2 Python `llm` service stack

- **Decision:** Four related Milestone 2b choices, recorded together the
  same way ADR-011 and ADR-013 bundled the frontend's and Go backend's
  stacks:
  1. **Language/version:** Python 3.12+ (the workspace's venv resolves to
     whatever latest stable Homebrew provides — currently 3.14 — matching
     the "latest stable, pinned via lockfile" pattern already used for
     Angular (ADR-011) and Go).
  2. **Dependency management:** `uv`, with `pyproject.toml` +
     `uv.lock`.
  3. **Web framework:** FastAPI + Uvicorn, exposing exactly the one route
     `proto/llm.openapi.yaml` defines (`POST /v1/generate`), plus an
     unversioned `/healthz` for the "model warm/ready" check
     `docs/ARCHITECTURE.md` §3.3 asks every AI service to expose. The
     OpenAPI contract itself stays hand-maintained (ADR-013's reasoning
     applies identically here); FastAPI's autogenerated schema is not
     treated as the source of truth.
  4. **Inference engine:** `llama-cpp-python` (llama.cpp's Python
     binding), loading local GGUF weight files. Model identity lives in
     `ai-services/models.yaml` (docs/ARCHITECTURE.md §3.6); swapping models
     is a one-line registry edit.
  5. **Linting/formatting:** `ruff` (lint) and `ruff format`, one tool for
     both, replacing the two `TBD` markers in `docs/DEVELOPMENT.md` §5/§9.
- **Reason:**
  1. Matches the project's standing "latest stable" preference; `uv`
     pins it exactly via its lockfile so it doesn't drift silently.
  2. `uv` is a single fast tool that replaces pip + venv + a resolver, with
     one lockfile — less machinery than Poetry for a service this size,
     and the modern default for new Python projects as of 2025.
  3. FastAPI/Uvicorn is the standard minimal-dependency choice for a small
     JSON HTTP surface in Python, mirroring the Go side's "no unnecessary
     framework" stance (ADR-013 chose stdlib `net/http` for the same
     reason; Python's stdlib has no comparable async HTTP server, so
     Uvicorn is the equivalent-weight choice here).
  4. `llama-cpp-python` runs anywhere `docker compose up` needs it to —
     including a plain Linux container — unlike an Apple-Silicon-only
     engine (e.g. MLX), which cannot run inside a Linux container
     regardless of the host's hardware and would break the project's own
     Docker Compose deployment target (docs/ARCHITECTURE.md §6). It also
     requires no separate daemon (unlike Ollama), keeping the service
     self-contained and consistent with ADR-001's no-network-egress rule
     at inference time.
  5. `ruff` was already listed as `docs/DEVELOPMENT.md`'s own candidate;
     nothing surfaced during implementation to reconsider it.
- **Alternatives considered:**
  - Poetry for dependency management — rejected: slower resolver, two
    files where `uv` needs one, no capability `uv` lacks for this
    project's size.
  - MLX (Apple's Apple-Silicon-native framework) as the inference engine —
    rejected: would be the fastest option on this specific development
    machine, but cannot run inside a Linux container at all, breaking the
    `docker compose up` target the moment this service needs to run
    anywhere but this Mac.
  - Ollama as the inference engine — rejected: adds a second daemon/process
    to manage and containerize, for no capability this project needs yet
    over a direct, in-process `llama-cpp-python` load.
  - `black` + a separate linter — rejected: `ruff` covers both roles in one
    tool and one config block.
- **Impact:** `ai-services/pyproject.toml` and `ai-services/uv.lock` are
  the dependency source of truth; `docs/DEVELOPMENT.md` §5/§9 are updated
  from `TBD` to these concrete choices. Revisit the inference engine only
  if a future phase's hardware target changes what "runs in the compose
  stack" means (e.g. a dedicated GPU-serving container), per
  `docs/ARCHITECTURE.md` §6's CPU/GPU compose-profile note.
- **Status:** Accepted.

## ADR-016 - Milestone 2b LLM model selection: Llama-3.2-3B-Instruct

- **Decision:** `llama-3.2-3b-instruct` (bartowski/Llama-3.2-3B-Instruct-GGUF,
  Q4_K_M quantization) is selected as the `llm` capability's model in
  `ai-services/models.yaml`, replacing `FakeLLMClient` as the backend's
  answer source once `VAANISETU_LLM_SERVICE_URL` is set.
- **Reason:** Benchmarked on this development machine (Apple M5 Pro, 24GB
  RAM, llama.cpp with Metal acceleration) against two other candidates on
  a fixed, seeded (reproducible) set of 5 Hindi and Hinglish prompts
  (`ai-services/scripts/benchmark.py`, full input/output/timing recorded in
  `ai-services/benchmark_results/llm_milestone_2b.json`). All three loaded
  and generated well within budget (load ~1-1.2s, mean reply latency
  0.36-0.94s, peak RSS 3.8-4.4GB) — latency and memory did not
  differentiate them meaningfully on this hardware. **Output quality did.**
  On the factual Hindi prompt "भारत की राजधानी क्या है?" (what is India's
  capital), Llama-3.2-3B-Instruct answered correctly and formally
  ("भारत की राजधानी नई दिल्ली है।", New Delhi); Qwen2.5-3B-Instruct
  answered tersely and less formally ("दिल्ली है", just "Delhi"), and on
  the Hinglish joke prompt produced a non-existent Hindi word ("कहाज़ा").
  The system prompt explicitly instructs against emoji/markdown (added
  because a future text-to-speech phase reads replies aloud):
  Llama-3.2-3B-Instruct followed this on every prompt; Gemma-2-2B-it
  emitted one anyway ("😉") on the joke prompt despite the same
  instruction. This is Phase 2's lightweight, phase-scoped benchmark
  (`docs/ROADMAP.md`'s ordering note) — quality here is a read of actual
  model output by the implementing agent, not a human-rated MOS panel; the
  full `docs/EVALUATION.md` targets (WER-proxy, hallucination rate,
  multilingual quality scoring, etc.) remain to be measured for real once
  Phase 9's harness exists. This result is also a concrete instance of
  ADR-008's own reasoning: Qwen2.5's Apache-2.0 license and reputation for
  multilingual strength did not translate into the most fluent or
  instruction-compliant output in this GGUF/quantization/prompting
  combination — measurement, not reputation, decided this.
- **Alternatives considered:**
  - `qwen2.5-3b-instruct` (Qwen, Apache-2.0) — rejected: the most
    permissive license of the three, but its Hindi replies were terser and
    less formal, and it produced a non-existent Hindi word in its joke
    reply — a quality gap not offset by the license advantage.
  - `gemma-2-2b-it` (Google, Gemma Terms of Use) — a close second: fluent
    Hindi and Hinglish, fastest load time and lowest latency, smallest
    model. Not selected because Llama-3.2-3B-Instruct's factual answer was
    more precise and formal ("नई दिल्ली", New Delhi, vs. Gemma's "दिल्ली",
    Delhi) and, unlike Gemma, it never violated the no-emoji instruction.
    Revisit if Gemma's smaller footprint and lower latency become a
    binding constraint on lower-end target hardware.
  - All three candidates remain in `ai-services/models.yaml` (not deleted)
    so this selection can be revisited by editing one line, with the same
    benchmark script available to re-run if a new candidate is proposed.
- **Impact:** `ai-services/models.yaml`'s `llm.selected` is
  `llama-3.2-3b-instruct`. No Go or Angular code changes. The model itself
  is not referenced by name anywhere outside this file and the registry.
  Its license (Llama 3.2 Community License, not OSI-approved, includes an
  acceptable-use policy and a monthly-active-users redistribution clause)
  should be re-reviewed before any production packaging/distribution
  decision (Phase 12) — acceptable for local development and evaluation
  now, per ADR-003's "license review per model becomes mandatory."
  Superseding this ADR only requires re-running the benchmark.
- **Status:** Accepted.

## Template for future ADRs

```
## ADR-NNN - <short title>

- **Decision:** <what was decided>
- **Reason:** <why>
- **Alternatives considered:** <options and why they lost>
- **Impact:** <effect on architecture, phases, effort>
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
```
