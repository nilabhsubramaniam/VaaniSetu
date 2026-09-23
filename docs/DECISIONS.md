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

## ADR-017 - Phase 3 Milestone 3a: audio transport, endpointing, and script tagging

- **Decision:** Five related Milestone 3a choices, recorded together the
  same way ADR-011/013/015 bundled earlier phases' stacks:
  1. **Transcription is a separate step, not a `/chat` change.** The
     frontend uploads audio to a new `POST /api/v1/speech/transcribe`,
     gets back only a transcript, and feeds that transcript into the
     existing `ConversationService.sendUserTurn` — the exact same call a
     typed message makes. `/chat`, `conversation.Service`, and the chat
     DTOs are unchanged.
  2. **Audio travels as a raw binary body, not JSON or multipart.**
     Angular→Go and Go→Python both send the recorded audio as the request
     body directly, with `Content-Type` naming its encoding and the
     language passed as a query parameter (`?language=hi`), not a JSON
     field.
  3. **One Python process hosts both capabilities.** The `asr` capability
     is a new module in the existing `ai-services` FastAPI app
     (`app/engines/asr/`, alongside `app/engines/llm/`), not a second
     container — matching `docs/DEVELOPMENT.md` §5's "one module per
     capability" as a code-organization rule, not a one-service-per-capability
     deployment rule.
  4. **Endpointing is manual (tap to start, tap to stop), not an automatic
     VAD model.** The mic button already worked this way in Phase 1's
     mock; Milestone 3a keeps it, backed by real audio now, with a fixed
     30-second safety cap in case a user forgets to stop it.
  5. **`script` is a deterministic Unicode-range classification, computed
     in Go, not a language-identification model.** `internal/conversation.DetectScript`
     counts each character's Unicode script block and returns the most
     frequent one (Devanagari, Latin, Bengali, Gujarati, Gurmukhi, Tamil,
     Telugu, Kannada, Malayalam, or Oriya), applied uniformly to every
     turn — typed or spoken, user or assistant — at persist time.
- **Reason:**
  1. Reusing `/chat` unchanged is the entire reason Milestone 3a is small:
     it needed no `conversation.Service` change, no new DTO on the chat
     path, and no risk to a working, tested feature. `docs/ROADMAP.md`
     Phase 3's own goal is speaking a turn, not redesigning how turns are
     answered.
  2. Audio isn't naturally JSON-shaped; base64-encoding it into a JSON
     field costs ~33% size for no benefit at this scale, and multipart
     parsing is unneeded machinery for exactly one file per request — the
     same "no more machinery than the current need justifies" reasoning
     ADR-013 already applied to routing.
  3. Phase 3's own scope is one ASR capability, not new infrastructure;
     spinning up a second container for it would add an operational
     surface (a second health check, a second Dockerfile, a second set of
     resource limits) with no capability gained over a second module in
     the process that already exists.
  4. A full VAD model is itself a capability requiring its own model
     selection, benchmark, and ADR — real scope `docs/ROADMAP.md` Phase
     3's Definition of Done doesn't actually ask for ("VAD/endpointing
     **as needed**"). Manual endpointing is strictly simpler and already
     built.
  5. Script and language are different problems: "फल" and "phal" are the
     same word, different scripts, and script is fully determined by
     which Unicode block the characters fall in — no model needed. Real
     language identification (telling Hindi apart from other
     Devanagari-script languages, or detecting a language from purely
     Latin-script romanized text) is a genuinely harder problem correctly
     assigned to Phase 6, and this decision keeps it there rather than
     quietly pulling a piece of it into Phase 3.
- **Alternatives considered:**
  - Teaching `POST /chat` to accept either text or audio - rejected: couples
    two different concerns (turn persistence/reply generation, and
    transcription) into one endpoint and one request schema for no
    benefit over composing two calls.
  - Multipart/form-data or base64-JSON for audio transport - rejected:
    more parsing machinery (multipart) or wasted size (base64) than one
    binary body needs.
  - A second `ai-services`-style container specifically for `asr` -
    rejected: no capability gained yet over a second module in the
    existing process; revisit if a future phase's resource isolation or
    independent-scaling needs actually require it.
  - An automatic VAD model for hands-free endpointing - rejected for
    Milestone 3a: real added scope (its own capability, model, benchmark)
    the phase's Definition of Done doesn't require; revisit if user
    testing shows manual tap-to-stop is a real usability problem.
  - Language identification instead of script detection - rejected: a
    materially harder, model-requiring problem that `docs/ARCHITECTURE.md`
    already assigns to Phase 6; conflating the two would pull Phase 6
    scope into Phase 3.
- **Impact:** `backend/internal/asr` mirrors `internal/llm`'s
  fake/real-client shape exactly (`FakeASRClient`/`HTTPASRClient`,
  selected by `VAANISETU_ASR_SERVICE_URL`, ADR-006's "swap by config"
  mechanism). `turns.script` is an additive, nullable column
  (migration `0002_add_script.sql`). `proto/asr.openapi.yaml` and
  `docs/openapi/speech.yaml` are new hand-maintained contracts, following
  ADR-013's existing convention. Revisit decision 3 (one process, two
  capabilities) when Phase 4 (TTS) or Phase 7 (RAG/embeddings) add enough
  capabilities that independent scaling or resource isolation becomes a
  real operational need, not a hypothetical one.
- **Status:** Accepted.

## ADR-018 - Phase 3 Milestone 3b: ASR engine, forced-English Hinglish decoding, and model selection

- **Decision:** Four related Milestone 3b choices:
  1. **Inference engine:** `faster-whisper` (a CTranslate2-optimized
     Whisper implementation), loading a local CTranslate2 model directory
     via a new `app/engines/asr/` module mirroring the `llm` capability's
     shape exactly (an `ASREngine` interface, one implementation).
  2. **Hinglish is forced to decode as English (`language="en"`), not
     auto-detected.** `app/engines/asr/faster_whisper_engine.py`'s
     `_WHISPER_LANGUAGE_HINTS` maps `"hinglish"` to `"en"`.
  3. **Model selected:** `faster-whisper-large-v3-turbo`
     (deepdml/faster-whisper-large-v3-turbo-ct2), replacing
     `asr.FakeASRClient` as the backend's transcription source once
     `VAANISETU_ASR_SERVICE_URL` is set.
  4. **Benchmark fixtures are synthetic (TTS-generated via macOS's `say`),
     not real recordings**, with the fixture manifest committed
     (`ai-services/eval_data/asr_fixtures.yaml`) and the generated audio
     git-ignored and regenerable
     (`ai-services/scripts/generate_audio_fixtures.py`).
- **Reason:**
  1. Same reasoning as ADR-015 for `llama-cpp-python`: CTranslate2 ships
     prebuilt wheels for this platform (no from-source compile) and runs
     efficiently on CPU — what the actual `docker compose up` deployment
     target needs — with Metal acceleration here a bonus, not a
     requirement.
  2. Measured, not assumed. The first benchmark run left `hinglish`
     unhinted (auto-detect); on this project's synthetic Hinglish audio
     (an Indian-English TTS voice reading romanized Hindi-English text),
     every candidate auto-detected the speech as Hindi and transcribed it
     into Devanagari script — completely wrong for VaaniSetu's own
     definition of "hinglish" as Latin-script romanized text (WER 1.0 on
     every candidate, both Hinglish fixtures). Forcing `"en"` produces
     Latin-script output by construction regardless of accent, which is a
     real, measured improvement in script-correctness even though
     word-level accuracy on Hinglish specifically remains the weakest
     category for every candidate (see point 4 below and the Alternatives
     section) — Whisper was not trained on romanized Hindi as a target
     orthography, so it sometimes produces a plausible English paraphrase
     rather than a literal phonetic transliteration. This is a genuine,
     documented limitation of the Whisper family for code-switched Indian
     languages, not a bug in this integration.
  3. Full results in `ai-services/benchmark_results/asr_milestone_3b.json`
     (8 fixtures: 4 Hindi, 2 Hinglish, 2 English; mean WER, latency, and
     peak memory per candidate, each run in its own subprocess for
     accurate memory isolation — same method as ADR-016's LLM benchmark).
     Summary:

     | Candidate | Mean WER | Hindi WER | Hinglish WER | Mean latency | Peak RSS |
     |---|---|---|---|---|---|
     | faster-whisper-small | 0.439 | 0.388 | 0.975 | 1.09s | 1.44GB |
     | faster-whisper-medium | 0.248 | 0.100 | 0.790 | 2.77s | 1.95GB |
     | faster-whisper-large-v3-turbo | **0.182** | **0.000** | 0.725 | 4.04s | 2.19GB |

     `faster-whisper-large-v3-turbo` transcribed all 4 Hindi fixtures and
     both English fixtures with zero errors, and had the lowest (best)
     Hinglish WER of the three despite the shared, genuine Hinglish
     weakness above. It comfortably meets `docs/EVALUATION.md`'s
     provisional "< 20% Hindi WER" target (0%); `faster-whisper-medium`
     also meets it (10%); `faster-whisper-small` does not (38.8%). Its
     higher latency (~4s mean, ~4.3s max) and memory (2.2GB) are accepted
     for now — Phase 3 sets no hard latency budget, that arrives with
     Phase 5's end-to-end target and Phase 11's streaming work — in
     exchange for a large, decisive quality margin on the two languages
     that matter most for VaaniSetu's MVP.
  4. Synthetic fixtures are the only Hindi/Hinglish speech available
     without either building a TTS capability (explicitly Phase 4, out of
     scope) or recording real speech (Phase 8's dataset pipeline territory,
     not built yet). Using a pre-existing OS utility as a one-time
     dev-tool to bootstrap test audio is not the same as shipping a TTS
     capability; the manifest states this limitation plainly so results
     aren't mistaken for a Phase 9-grade measurement.
- **Alternatives considered:**
  - `faster-whisper-small`/`-medium` — rejected: `small` fails the
    Hindi WER target outright; `medium` meets it but with meaningfully
    worse Hindi and Hinglish accuracy than `large-v3-turbo` for roughly
    half its latency cost, which isn't yet a binding constraint at this
    phase.
  - The original `openai-whisper` (PyTorch) package instead of
    `faster-whisper` — rejected: slower on CPU, no prebuilt-wheel
    advantage, no capability gained over CTranslate2 for this project's
    needs.
  - An Indic-specific ASR model (e.g. AI4Bharat's IndicWhisper) as a
    fourth candidate — not attempted this round: no readily available
    CTranslate2 conversion was confirmed, and Milestone 3b's own scope
    only calls for 2-3 candidates. Worth a follow-up benchmark
    specifically targeting the Hinglish weakness identified above, since
    that is exactly the gap an Indic-specialized model would be expected
    to close.
  - Recording real human Hindi/Hinglish speech for the fixture set —
    preferable in principle, rejected only for this milestone: no
    recording setup or consented speaker exists yet; revisit before
    treating any WER number here as more than directional.
- **Impact:** `ai-services/models.yaml`'s `asr.selected` is
  `faster-whisper-large-v3-turbo`. `backend/internal/asr.HTTPASRClient`
  (already built in Milestone 3a) needs only
  `VAANISETU_ASR_SERVICE_URL` set to switch from `FakeASRClient` — no
  code change. The known Hinglish weakness is not blocking (Milestone 3a's
  transport and Milestone 3b's transcription both work correctly; output
  quality on code-switched input specifically is the open item) and
  should inform Phase 6 (Indian Language Support), which owns
  code-switching/language-ID quality more broadly. Superseding this ADR
  only requires re-running the benchmark.
- **Status:** Accepted.

## ADR-019 - Landing page hero: an abstract 3D "communication core", not a photoreal globe or a decorative overlay

- **Decision:** Rebuilt the landing page hero (`frontend/src/app/landing/`)
  as a genuinely depth-stratified Three.js scene rather than a flat page
  with a decorative 3D object on top, with these specific choices:
  1. **The central visual is an abstract "communication core"** — a
     layered wireframe/lattice/glass-shell construction
     (`three/core-system.ts`) — not a photoreal Earth. An earlier pass
     used real NASA imagery on a textured sphere; it was discarded because
     it read as "a website with a 3D object bolted on" rather than a
     purpose-built motif, and because shipping literal satellite/Earth
     imagery for a decorative demo raised unnecessary licensing surface
     for no product benefit.
  2. **Depth is real, not implied**: `THREE.Fog` tied to the page's own
     `--vs-bg` token, explicit foreground/midground/background Z bands
     (`hero-runtime.ts`), and a camera rig that moves for parallax
     (`camera.position.lerp`) rather than rotating the whole scene in
     place.
  3. **Demo language nodes are real DOM buttons, not 3D pick targets.**
     `three/project-to-screen.ts` projects world positions to viewport
     percentages every frame; `hero-experience.ts` writes the resulting
     `left`/`top`/`transform`/`opacity` directly onto real
     `<button>` elements, bypassing Angular change detection for
     per-frame updates. Nodes sit on fixed base angles across a
     restricted arc with a small idle sway, not a continuous 360°
     rotation — a full orbit periodically swung nodes behind the hero
     copy or off-screen at extreme perspective angles.
  4. **Three language concepts stay separate, on purpose:**
     `LanguageCode`/`LANGUAGE_OPTIONS` (the real, functional assistant
     language, owned by `SettingsStore`), `DemoLanguageNode` (the hero's
     decorative demo set, including languages VaaniSetu doesn't actually
     support), and `LandingI18nService`'s page-copy locale (derived via
     `computed()` from `SettingsStore`, never independent state). The
     header's `app-language-selector` is the single place the real
     preference is set; the landing page owns no second, competing
     control.
  5. **Everything below the hero — what the product is, supported
     languages, capabilities, privacy stance, future direction — is
     unchanged static Phase 1 content.** Only the hero and the
     header/language-selector duplication were in scope.
  6. **Graceful, complete fallback**: `prefers-reduced-motion` or no WebGL
     support skips Three.js entirely (no dynamic import even happens) and
     renders a static description plus a fully functional mic button and
     accessible language list — not a broken or empty hero.
- **Reason:** The product-facing ask was consistently "rearchitect the
  visual composition and theme, don't just add more glow/particles" —
  i.e. the failure mode to avoid was decorating a fundamentally flat page
  rather than building genuine spatial depth. Keeping the demo language
  set and the real language preference as separate types prevents a
  recurring bug class where selecting a decorative hero node would
  silently change the assistant's actual language, or where the "coming
  soon" demo set would need to stay in lockstep with the real, phased
  `LANGUAGE_OPTIONS` roadmap.
- **Alternatives considered:**
  - Raycasting/hit-testing 3D objects directly for language selection —
    rejected: real DOM buttons get correct keyboard focus, screen-reader
    semantics, and hit-testing for free; a 3D pick target would need all
    of that reimplemented by hand for no visual benefit, since the nodes
    already have to be projected to screen space for their DOM labels
    anyway.
  - Photoreal Earth via three.js's public-domain NASA example textures —
    used during one iteration, ultimately dropped per point 1 above;
    `public/textures/earth/` was deliberately not repopulated in the
    final rebuild.
  - A single shared "language" model for both the real preference and the
    hero's decorative set — rejected: the demo set intentionally includes
    unsupported languages (Japanese, Spanish, German) purely for visual
    global-reach framing, which `LANGUAGE_OPTIONS` must never do since it
    drives real `enabled`/"coming soon" UI elsewhere in the app.
- **Impact:** `frontend/src/app/landing/` gained `i18n/`, `models/`,
  `three/`, and `components/` subdirectories (see
  `docs/DEVELOPMENT.md`'s repository structure). `three`/`@types/three`
  remain the only new dependency (pinned exactly, per ADR-011's
  no-unnecessary-dependencies stance), code-split into its own lazy
  chunks (`hero-runtime`, `globe-runtime`, `scene-manager`) via
  `@defer (on idle)`/`@defer (on viewport)`, isolated from the initial
  bundle and every other route.
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
