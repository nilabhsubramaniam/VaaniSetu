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

## ADR-020 - Phase 4 Milestone 4a: TTS transport shape, fake-tone client, and reply-playback wiring

- **Decision:** Four related Milestone 4a choices, recorded together the
  same way ADR-017 bundled Phase 3 Milestone 3a's:
  1. **`internal/tts` mirrors `internal/llm`/`internal/asr`'s
     fake/real-client shape exactly**: `TTSClient` interface,
     `FakeTTSClient` (in use now), `HTTPTTSClient` (built now, wired to a
     real service only in Milestone 4b), selected by
     `config.Config.UsesFakeTTS` / `VAANISETU_TTS_SERVICE_URL` — the same
     "swap by config" mechanism as every other capability (ADR-006).
  2. **Synthesis is a JSON request, binary response** — the mirror image
     of `internal/asr`'s binary request/JSON response. Text is naturally
     JSON-shaped (like `internal/llm`'s request); only the audio side of
     this contract needs binary framing. `POST /api/v1/speech/synthesize`
     and `proto/tts.openapi.yaml`'s `POST /v1/synthesize` both carry
     `{text, language}` in and raw `audio/wav` bytes out, with no
     persistence side effect, matching `/speech/transcribe`'s pattern of
     staying separate from `/chat`.
  3. **`FakeTTSClient` returns a real, valid, playable WAV file — a short
     quiet sine tone — never opaque stub bytes**, generated fresh per call
     regardless of the input text or language. This lets the Angular
     playback plumbing (`AudioPlaybackService`, wired into
     `ConversationRealService`) be built and genuinely exercised — a real
     `<audio>` element actually receiving and playing a real audio file —
     before any Python `tts` capability exists, the same role
     `FakeASRClient`'s canned transcripts played for Milestone 3a.
  4. **Playback is wired directly into `ConversationRealService`, not a
     new settings toggle or a `VoiceSessionService` state.** After a chat
     reply arrives, `ConversationRealService` calls
     `SpeechService.synthesize` then `AudioPlaybackService.play`,
     fire-and-forget: a failure is logged but never surfaces as the
     conversation's `error` state, since the reply already succeeded and
     is fully readable as text. Voice output is additive to the working
     text/chat flow, not a required step it can break.
- **Reason:**
  1. Reusing the exact `llm`/`asr` shape is why Milestone 4a is small and
     low-risk: no new architectural pattern, no new capability-wiring
     mechanism to design, and a reviewer already familiar with
     `internal/asr` can read `internal/tts` in minutes.
  2. Text is naturally JSON; base64-encoding the *response* audio into
     JSON would cost ~33% size for no benefit at this scale (same
     reasoning ADR-017 applied to the request side for ASR), and the
     browser's `<audio>`/Web Audio APIs consume a `Blob` directly, so a
     raw binary HTTP response needs no decoding step on the way in.
  3. A silent WAV would exercise the transport correctly but leave no way
     to audibly confirm real playback happened during manual testing; an
     opaque non-WAV stub would fail to actually play in a real
     `<audio>` element, testing nothing about the browser-facing half of
     this milestone. A short, quiet, unmistakably-a-placeholder tone gets
     genuine end-to-end verification without pretending to be synthesized
     speech.
  4. A settings toggle or new voice state is real, unrequested scope this
     milestone's own goal (transport + playback plumbing) doesn't need;
     `docs/ROADMAP.md` Phase 4's Definition of Done asks for "reply text
     -> audio playback works locally," not a way to disable it. Making
     synthesis failure non-fatal follows the same principle already
     established for voice input generally: the assistant remains fully
     usable by text even when a voice-adjacent capability is degraded.
- **Alternatives considered:**
  - Multipart/form-data for the synthesize response — rejected: OpenAPI
    and `HttpClient` both handle a plain binary body with a `Content-Type`
    header more simply than multipart for exactly one file per response.
  - A dedicated `VoiceSessionService` state (e.g. `"speaking"`) for
    playback — rejected for this milestone: no consumer needs to
    distinguish "the reply arrived" from "the reply is being read aloud"
    yet; revisit if a future phase's UI actually needs to show that
    distinction.
  - Surfacing a synthesis failure as the conversation's `error` state —
    rejected: would make a working text reply look like a failure to the
    user over a voice-output problem alone, contradicting "voice is
    additive."
  - A second `ai-services`-style container specifically for `tts` —
    rejected for the same reason ADR-017 rejected it for `asr`: no
    capability gained yet over a third module in the existing process.
- **Impact:** `backend/internal/tts`, `proto/tts.openapi.yaml`, and the
  `/speech/synthesize` path in `docs/openapi/speech.yaml` are new,
  following ADR-013's hand-maintained-OpenAPI convention.
  `frontend/src/app/core/services/audio-playback.service.ts` is new,
  mirroring `AudioCaptureService`'s "no abstract-class + DI-token, exactly
  one implementation" shape (AGENTS.md §6).
  `SpeechService` gained a second method (`synthesize`) rather than a
  second service class, since both calls belong to the same `speech`
  capability boundary. Milestone 4b (the real Python `tts` engine,
  benchmark, and model-selection ADR) is unblocked by all of this — only
  `VAANISETU_TTS_SERVICE_URL` needs to be set once it exists, no other
  code change.
- **Status:** Accepted.

## ADR-021 - Phase 4 Milestone 4b: TTS engines, benchmark, and model selection

- **Decision:** Three related Milestone 4b choices:
  1. **Three candidates built and benchmarked (two actually benchmarked):**
     `facebook/mms-tts-hin` (VITS, via `transformers`), `coqui/XTTS-v2`
     (via `coqui-tts`), and `ai4bharat/indic-parler-tts` (via `parler-tts`)
     each got a real `app/engines/tts/` wrapper implementing the shared
     `TTSEngine` interface. `indic-parler-tts` could **not** be
     benchmarked: its Hugging Face repo is gated, and even after a token
     was created and used, Hugging Face returned "you are not in the
     authorized list" — this specific account's access request has not
     been (or will not be) manually approved. It stays fully implemented
     and listed in `models.yaml`, unselected, ready to benchmark the
     moment access is granted.
  2. **Model selected: `facebook/mms-tts-hin`.** Fastest, lightest, and by
     far the most accurate of the two benchmarked candidates on Hindi —
     but it has a real, hard limitation, not just a quality gap: its
     tokenizer vocabulary is Devanagari-phoneme only, so Latin-script text
     (Hinglish, English) tokenizes to a **literally empty sequence** — it
     cannot produce any audio for Hinglish input at all.
     `MmsVitsEngine.synthesize` now raises a descriptive
     `UnsupportedTextError` for this case instead of letting an empty
     tensor crash inside `transformers` with an opaque dtype error.
  3. **Intelligibility measured via the documented proxy** (feeding
     synthesized audio back through the already-selected
     `faster-whisper-large-v3-turbo` engine and computing WER against the
     input text, reusing `eval_data/asr_fixtures.yaml`'s text/language
     set — no new fixture file). **Pronunciation accuracy and naturalness
     (MOS) are not measured** — both require a human listener, which
     doesn't exist in this environment; recorded as an explicit,
     unmeasured gap in `benchmark_results/tts_milestone_4b.json`, not
     silently skipped.
- **Reason:**
  1. Full results in `ai-services/benchmark_results/tts_milestone_4b.json`
     (8 fixtures: 4 Hindi, 2 Hinglish, 2 English; each candidate run in its
     own subprocess for accurate memory isolation, same method as
     ADR-016/ADR-018). Summary (proxy WER — lower is better; RTF —
     synthesis time / audio duration):

     | Candidate | License | Hindi WER | Hinglish WER | English WER | Mean RTF | Load | Peak RSS |
     |---|---|---|---|---|---|---|---|
     | mms-tts-hin | CC-BY-NC-4.0 | **0.238** | fails (0/2 producible) | 1.00 | **0.166** | **0.96s** | **2.43GB** |
     | xtts-v2 | CPML | 0.713 | 1.813 (unintelligible) | 0.00 | 0.404 | 14.92s | 5.45GB |
     | indic-parler-tts | Apache-2.0 | not benchmarked — gated repo access denied | | | | | |

     `mms-tts-hin` is ~3x faster, uses less than half the memory, and is
     three times more accurate on Hindi than `xtts-v2` — a decisive margin
     on the language that matters most for the current MVP scope. Neither
     candidate produces usable Hinglish speech: `mms-tts-hin` cannot
     attempt it at all (see point 2 above); `xtts-v2` attempts it but the
     proxy transcript is unintelligible word salad (WER 1.81, worse than
     the "say nothing" baseline). `xtts-v2`'s only clear win is English
     (0.00 WER, unsurprising for a model trained heavily on Western
     languages) — not this project's MVP focus language.
  2. Both benchmarked candidates carry a non-commercial license
     (`mms-tts-hin`: CC-BY-NC-4.0; `xtts-v2`: CPML, and Coqui Inc. no
     longer exists to sell a commercial license). License is therefore not
     a differentiator between them this round — both are acceptable for
     local/personal, non-commercial use only, and neither should be part
     of any future commercial distribution without revisiting this ADR.
     `indic-parler-tts` (Apache-2.0) is the only candidate here without
     this constraint, which is exactly why it is worth re-benchmarking
     once its access request is resolved, rather than dropping it.
  3. Choosing evidence over convenience: `xtts-v2` "works" on every
     language without crashing, which could look like the safer choice,
     but its actual measured Hindi intelligibility is worse than
     `mms-tts-hin`'s by a wide margin, and its Hinglish output is
     unintelligible regardless. Selecting the candidate with a narrower
     but higher-quality, faster, lighter capability — and documenting the
     Hinglish gap plainly — follows the same principle ADR-018 applied to
     Whisper's Hinglish weakness: report the real limitation rather than
     picking a worse-but-technically-broader model to paper over it.
- **Alternatives considered:**
  - Waiting indefinitely for `indic-parler-tts` access before selecting
    anything — rejected: Milestone 4b's Definition of Done needs a real,
    working `selected` model now; re-benchmarking `indic-parler-tts` later
    is a small, well-scoped follow-up (the wrapper and registry entry
    already exist), not a reason to block this milestone.
  - Selecting `xtts-v2` for its broader language coverage — rejected: its
    Hindi intelligibility is measurably worse, it is ~15x slower to load
    and ~2.2x heavier at rest, and its "coverage" of Hinglish is
    unintelligible in practice, not a genuine capability advantage.
  - Silently falling back to Hindi phonemes for Hinglish text on
    `mms-tts-hin` (e.g. transliterating Latin-script input to Devanagari
    before synthesis) — not attempted this round: transliteration quality
    is itself an unevaluated variable that would need its own benchmark;
    worth a real follow-up (Phase 6, Indian Language Support, already owns
    script/language-ID work) rather than an untested guess bolted on here.
- **Impact:** `ai-services/models.yaml`'s `tts.selected` is
  `mms-tts-hin`. `backend/internal/tts.HTTPTTSClient` (already built in
  Milestone 4a) needs only `VAANISETU_TTS_SERVICE_URL` set to switch from
  `FakeTTSClient` — no code change. **Known gap, stated plainly: spoken
  replies to Hinglish input have no real TTS voice yet** — the Go
  `/speech/synthesize` call will fail (mapped to a 5xx, same as any other
  engine failure) whenever `language=hinglish` is requested; the frontend's
  Milestone 4a fire-and-forget playback (ADR-020, point 4) means this
  degrades gracefully to text-only for Hinglish replies rather than
  breaking the conversation. This should inform Phase 6 (Indian Language
  Support) and is the first thing to revisit if `indic-parler-tts` access
  is granted. The selected model's non-commercial license means the
  current build must not be distributed commercially without first
  resolving this ADR.
- **Status:** Accepted.

## ADR-022 - TTS voice revision: female-voice fine-tune replaces mms-tts-hin's single male voice

- **Decision:** Replaced `tts.selected` in `ai-services/models.yaml` from
  `mms-tts-hin` (`facebook/mms-tts-hin`) to a new candidate,
  `mms-tts-hin-ft-female` (`Anjan9320/fb-mms-tts-hin-ft-female`) — a
  community fine-tune of the exact same VITS architecture and tokenizer,
  loaded by the same `MmsVitsEngine` with no code change beyond making one
  error message candidate-agnostic (it previously hardcoded the string
  `"mms-tts-hin"`, which became wrong the moment a second checkpoint used
  this engine — now derived from the checkpoint's own directory name).
- **Reason:** The user reported the selected voice sounded male after
  actually listening to it. ADR-021's benchmark measured accuracy, speed,
  and memory but never evaluated voice gender — `facebook/mms-tts-hin`'s
  config confirms `num_speakers: 1`, i.e. a single, fixed voice with no
  speaker-ID parameter to switch, so gender could not be fixed by
  configuration alone. Given the user's choice among three real options
  (this fine-tune; switching to `xtts-v2`'s already-configured female
  built-in speaker; or keeping the male voice), a same-architecture
  female fine-tune was preferred over `xtts-v2` because it preserves
  ADR-021's speed/accuracy/license profile rather than trading it away.
  Verified, not assumed, before selecting:
  - **Same shape:** `num_speakers: 1`, 16kHz, loads through the existing
    `MmsVitsEngine`/`transformers.VitsModel` path unmodified.
  - **Comparable intelligibility:** proxy-WER (same method as ADR-021,
    synthesize → transcribe via `faster-whisper-large-v3-turbo` → WER
    against input) on the same 4 Hindi fixtures: 0.200 mean, vs. the base
    checkpoint's 0.238 — not a regression.
  - **Same speed/footprint:** load 1.05s (vs. 0.96s), mean RTF 0.171 (vs.
    0.166) — both essentially identical to ADR-021's numbers, as expected
    for the same architecture/size class.
  - **Higher, more female-typical pitch:** a rough autocorrelation-based
    F0 estimate put the base voice's median pitch at ~163-180Hz (the
    upper edge of a typical male range) and this fine-tune's at
    ~182-195Hz (solidly in a typical female range) — directionally
    consistent evidence, not a substitute for a human listener actually
    confirming it (still unavailable in this environment, same caveat as
    ADR-021's pronunciation/MOS gap).
  - **Same license family:** CC-BY-NC-4.0, identical to the base
    checkpoint — this swap introduces no new licensing constraint beyond
    what ADR-021 already accepted.
  - **Same Hinglish limitation:** confirmed this fine-tune still raises
    `UnsupportedTextError` for Latin-script text — inherits the base
    checkpoint's Devanagari-only vocabulary, so ADR-021's Hinglish gap is
    unchanged, not newly introduced.
- **Alternatives considered:**
  - `coqui/XTTS-v2` with its already-configured female speaker ("Ana
    Florence") — rejected: still carries ADR-021's measured 3x-worse
    Hindi WER, ~15x slower load, and ~2.2x heavier memory footprint; a
    voice-gender fix should not silently reopen an already-decided
    quality tradeoff.
  - Waiting for `ai4bharat/indic-parler-tts` access (Apache-2.0, already
    configured with a female voice description) — rejected for now, same
    reasoning as ADR-021: no reason to block a real, user-reported gap on
    an access request with no ETA; revisit and re-benchmark if/when access
    is granted.
- **Impact:** `ai-services/models.yaml` gains the `mms-tts-hin-ft-female`
  candidate entry and `tts.selected` now points to it;
  `facebook/mms-tts-hin` remains listed as a candidate (e.g. to revert to,
  or as a baseline for future comparisons). No Go, Angular, or API-contract
  change — `HTTPTTSClient`/`proto/tts.openapi.yaml` are unaffected, per
  the same "swap by config" design ADR-006 established.
  `app/engines/tts/mms_vits_engine.py`'s error message fix is a genuine
  correctness fix (a hardcoded checkpoint name that had already become
  inaccurate), not scope creep. This ADR does not change any of ADR-021's
  other findings — the Hinglish gap and the non-commercial-license
  constraint both still stand.
- **Status:** Accepted.

## ADR-023 - Real, simultaneous male/female TTS voice selection

- **Decision:** Following ADR-022, both `mms-tts-hin-ft-female` (female)
  and `mms-tts-hin` (male) are now loaded **simultaneously** in
  `ai-services`, and a per-request `voice` field picks between them, end
  to end:
  1. `ai-services/models.yaml`'s `tts.selected` becomes a **map**
     (`{female: mms-tts-hin-ft-female, male: mms-tts-hin}`) instead of a
     single string — the one capability where more than one model is
     simultaneously selected. `llm`/`asr` keep their original
     single-string `selected` shape; `app/registry.load_selected_entry`
     takes an optional `voice` param used only when `capability == "tts"`.
  2. `app/main.py`'s `lifespan` loads one engine per `_TTS_VOICES =
     ("female", "male")` entry at startup (fails loudly if either is
     missing, same as every other capability). `POST /v1/synthesize`
     gains an optional `voice` field (default `"female"`); the handler
     looks it up in the loaded-engines dict directly (not a FastAPI
     `Depends`, since the voice key is only known once the body is
     parsed) and returns 400 for an unrecognized voice.
  3. `proto/tts.openapi.yaml` / `docs/openapi/speech.yaml` gain the same
     optional `voice` (`"female" | "male"`, default `"female"`) field.
     `backend/internal/tts.SynthesizeRequest` gains `Voice string`;
     `internal/api`'s `handleSynthesize` defaults an empty voice to
     `"female"` and 400s an unrecognized one, mirroring its existing
     `isValidLanguage` check.
  4. Frontend: `SettingsStore` gains a `preferredVoice` signal
     (`VoiceCode`, `localStorage`-backed), an exact copy of
     `preferredLanguage`'s existing mechanism. A new `voice-preferences`
     settings component (a structural copy of `language-preferences`)
     lets the user pick Female/Male. `ConversationRealService` reads
     `settings.preferredVoice()` when calling
     `SpeechService.synthesize(text, language, voice)`.
- **Reason:** The user asked for a real choice, not a second hardcoded
  pick. Both voices were already fully verified working checkpoints
  (ADR-021/ADR-022) on the same architecture, so the only real design
  question was how `ai-services` — which had only ever loaded **one**
  model per capability — could serve two simultaneously. Loading both at
  startup (rather than lazily swapping one in per request) was chosen
  because: it keeps `/v1/synthesize` request latency uniform regardless of
  which voice is asked for; it fails loudly at startup if either voice's
  weights are missing, consistent with every other capability's existing
  behavior; and the memory cost is small (~2.4GB peak RSS per this
  architecture, per ADR-021's benchmark) and paid once, not per request.
  A plain dict lookup (not `Depends`) for engine selection was chosen
  because FastAPI's dependency-injection only resolves before/alongside
  parameter binding — the voice key genuinely isn't known until the
  request body itself is parsed, so forcing it through `Depends` would
  need an awkward two-pass request read for no benefit.
- **Alternatives considered:**
  - Lazily load whichever voice a request asks for, evicting the other —
    rejected: adds real per-request latency variance (a cold load) for no
    memory savings large enough to justify it at this model size, and
    reintroduces exactly the kind of statefulness `docs/ARCHITECTURE.md`
    §5 tries to keep out of the request path.
  - A generic N-voice registry shape usable by any future capability, not
    just `tts` — rejected as speculative: no second capability needs
    multiple simultaneous selections today (AGENTS.md §6, "no speculative
    abstraction"); revisit if one does.
  - Making `voice` a `LanguageCode`-style per-language default instead of
    an explicit user setting — rejected: gender and language are
    orthogonal to the user, and `voices` (ADR-021) already covers
    per-language configuration for engines that need it (parler_tts,
    xtts); conflating the two would overload one field with two concerns.
- **Impact:** `ai-services/models.yaml`, `app/registry.py`, `app/main.py`;
  `proto/tts.openapi.yaml`, `docs/openapi/speech.yaml`;
  `backend/internal/tts`, `backend/internal/api/dto.go` and `server.go`;
  `frontend/src/app/core/models/voice.model.ts` (new),
  `SettingsStore`, `SpeechService`, `ConversationRealService`, and a new
  `settings/voice-preferences/` component. No change to which models are
  selected (still ADR-022's two checkpoints) or their license status
  (still both CC-BY-NC-4.0, non-commercial) — this ADR is about serving
  both simultaneously, not about model selection itself.
- **Status:** Accepted.

## ADR-024 - Phase 5: Go turn orchestrator and the voice/turn response shape

- **Decision:** Two related Phase 5 choices:
  1. **A new `backend/internal/orchestrator` package** implements
     `docs/ARCHITECTURE.md` §3.2's "turn orchestrator" for real: one
     `Orchestrator.RunTurn(ctx, audio, contentType, language, voice)`
     method sequencing transcribe (`asr.ASRClient`) -> think
     (`ConversationService.SendMessage`, the same call `handleChat`
     already makes) -> speak (`tts.TTSClient`), composing three
     interfaces every caller already depended on individually — no new
     capability. Exposed as `POST /api/v1/voice/turn`
     (`docs/openapi/voice.yaml`), reusing `handleTranscribe`'s existing
     request shape (raw audio body + query params) and `handleChat`'s
     existing error-code conventions (`asr_unavailable`,
     `llm_unavailable`).
  2. **A speech-synthesis failure inside `RunTurn` is not fatal to the
     turn** — `TurnResult.SynthesisFailed` is set and `Audio` stays nil,
     but the transcript and reply are still returned with a 200. This
     moves ADR-020's "voice is additive" rule from Angular (where it
     lived as a client-side `.catch()` around a second HTTP call) into
     Go, where `docs/ARCHITECTURE.md` says orchestration belongs.
  3. **The endpoint's response is one JSON body** —
     `{userTurn, assistantTurn, audio: {contentType, base64} | null}` —
     not multipart, and not a second "now fetch the audio" call.
- **Reason:**
  1. Confirmed by reading the actual code before writing any of this
     (not assumed): the sequencing decisions "after transcribe, call
     chat" and "after the reply arrives, speak it" lived in
     `frontend/src/app/assistant/mic-button/mic-button.ts` and
     `ConversationRealService` respectively — exactly the pattern
     `docs/ARCHITECTURE.md` §4 lists as forbidden ("Turn orchestration |
     Go | Orchestration logic in Python or Angular"). Composing the
     three existing capability interfaces in one new Go package is the
     smallest change that fixes this: no new capability, no change to
     `internal/asr`/`internal/tts`/`internal/conversation`, and the
     existing `/chat`, `/speech/transcribe`, `/speech/synthesize`
     endpoints are untouched and still used elsewhere (typed text still
     calls `/chat` directly).
  2. A synthesis failure was already known to be non-fatal (ADR-020) —
     this only relocates where that decision is made, from a client-side
     try/catch to the one place that now actually owns turn sequencing.
     Getting this right in Go rather than leaving it in Angular matters
     because Angular no longer decides *whether* to synthesize at all
     after this change — it only renders what Go already decided.
  3. One reply clip at this project's scale is small (tens of KB, per
     Milestone 4b's real measurements) — base64's ~33% overhead is
     negligible, and it keeps the client contract to exactly one HTTP
     call per spoken turn. A second "now fetch the audio" call would
     reintroduce a client-side sequencing decision ("now that I have the
     reply, go get its audio"), undoing the entire point of this ADR;
     multipart would avoid the encoding overhead but adds real complexity
     to both the Go response-writing side and the Angular parsing side
     for a savings that doesn't matter at this payload size.
- **Alternatives considered:**
  - Multipart/mixed response (JSON part + binary audio part) — rejected:
    meaningfully more code on both ends (Go multipart writer, Angular
    multipart response parsing, neither of which this codebase has any
    existing pattern for) to save an overhead that's irrelevant at a few
    tens of KB per reply.
  - A second endpoint call from Angular once the turn's text is known —
    rejected: puts the "now speak it" decision back in the client,
    exactly what this phase exists to remove.
  - Returning `202 Accepted` immediately and polling/streaming
    partial results — rejected as out of scope: `docs/ROADMAP.md` Phase 5
    is explicitly the **non-streaming** MVP; streaming is Phase 11.
  - A `WebSocket`-based orchestrator instead of a single request/response
    call — rejected for the same reason: nothing in Phase 5's scope needs
    a persistent connection or partial/incremental results; a plain HTTP
    call is the smallest change that satisfies "one call in, one turn out."
- **Measured, not assumed — real end-to-end latency against
  `docs/EVALUATION.md` §6's "p50 < 3s non-streaming MVP" target:** eight
  live `POST /api/v1/voice/turn` calls against real recorded audio
  (`ai-services/eval_data/audio/`, all 8 fixtures: 4 Hindi, 2 Hinglish, 2
  English), through the actual running Go + Python services, not
  simulated:

  | Metric | Measured | Target |
  |---|---|---|
  | p50 | **5.09s** | < 3s |
  | p95 (approx, n=8) | **8.85s** | — |
  | mean | 5.50s | — |

  **This target is not met.** Per-stage timing (logged on every request —
  `transcribeMs`/`thinkMs`/`speakMs`) shows why: transcription alone took
  ~4.0-4.3s on **every single request**, already exceeding the entire p50
  budget before the LLM (0.28-2.77s) or TTS (0-1.9s) stage even ran. This
  is not a new regression from this phase's own code — it is
  `faster-whisper-large-v3-turbo`'s already-measured latency from
  ADR-018 (there: "~4s mean, ~4.3s max... accepted for now — Phase 3 sets
  no hard latency budget, that arrives with Phase 5's end-to-end target"),
  now shown, for the first time, to be the dominant bottleneck against a
  real budget. ADR-018's own benchmark already recorded faster
  alternatives with much worse Hindi accuracy (`faster-whisper-small`:
  1.09s mean latency but 38.8% WER; `-medium`: 2.77s but 10% WER) — closing
  this gap means re-opening that accuracy/latency tradeoff, which this ADR
  does **not** do; it only measures and records the conflict for a future
  phase to resolve with its own evidence, rather than silently trading
  away either the latency target or ADR-018's accuracy decision to make a
  number look better.

  Also verified live in the same run: a Hinglish request correctly
  returns 200 with `synthesisFailed: true`/`speakMs: 0` — the known
  Hinglish TTS gap (ADR-021) fails fast and degrades to text-only exactly
  as designed, not as a new discovery.
- **Impact:** `backend/internal/orchestrator` (new), `internal/api/server.go`
  (`Server.orchestrator` field, `POST /api/v1/voice/turn`), `internal/api/dto.go`
  (`voiceTurnResponse`/`voiceTurnAudioDTO`), `docs/openapi/voice.yaml` (new).
  Frontend: `ConversationService` (abstract `sendVoiceTurn`),
  `ConversationRealService` (real implementation),
  `ConversationMockService` (a trivial stub — this mock has no ASR, so it
  reuses `sendUserTurn`'s canned-reply flow with a placeholder transcript;
  it exists only so the abstract contract compiles, not as a maintained
  second implementation), and `mic-button.ts` (now makes exactly one call
  instead of two sequenced ones; no longer depends on `SpeechService` at
  all). `docker-compose.yml`'s `ai-services` healthcheck and `backend`'s
  `depends_on` condition were also fixed as part of this phase's "docker
  compose up brings up the whole stack" Definition of Done item — see
  `docs/CURRENT_STATE.md` for what was and wasn't actually verified
  (Docker itself remains unavailable in this development environment).
  **Known gap, not blocking (same honesty precedent as ADR-018's Hinglish
  WER and ADR-021's Hinglish TTS gaps):** end-to-end latency does not meet
  `docs/EVALUATION.md`'s provisional target — see the measured evidence
  above. Flagged for whichever future phase actually owns latency
  optimization (Phase 11's streaming work is the most likely candidate,
  since it changes the latency model entirely; a standalone faster-ASR
  re-benchmark is also possible sooner, but is a real model-selection
  decision this ADR deliberately does not make).
- **Status:** Accepted.

## ADR-025 - Silence-timeout auto-stop for the mic button (not a VAD model)

- **Decision:** The user asked for the mic to stop automatically once
  they finish speaking, instead of requiring a second tap. A real,
  benchmarked VAD model is explicitly Phase 11's scope
  (`docs/ROADMAP.md`; ADR-017 chose manual endpointing for Phase 3
  specifically because "a full VAD model is itself a capability requiring
  its own model selection, benchmark, and ADR" — real scope Phase 3's
  Definition of Done didn't ask for). Flagged as a conflict; the user
  chose a narrower alternative instead of jumping ahead to Phase 11:
  `AudioCaptureService.start()` gains an optional `onAutoStop` callback.
  When given, it additionally builds a small Web Audio graph
  (`AudioContext` -> `MediaStreamAudioSourceNode` -> `AnalyserNode`) and
  polls the live audio level every 100ms. Once real speech has been seen
  for at least 300ms and the level has then stayed below a fixed
  threshold for 1500ms continuously, the callback fires once.
  `mic-button.ts` wires it to the exact same `stopListeningAndSend()`
  path manual tap and the existing 30s max-duration timer already use.
- **Reason:** This is a coarse amplitude heuristic (mean absolute
  deviation from the time-domain midpoint), not speech/non-speech
  classification — no model, no training data, no benchmark, no
  model-registry entry. It genuinely is not the capability ADR-017 and
  Phase 11 mean by "VAD," so building it now doesn't reopen either
  decision; it's a UX change to audio capture Phase 3 already owns
  (`docs/ARCHITECTURE.md` §3.1, "capture microphone audio... in the
  browser"). Feature-detected rather than required: if `AudioContext`
  doesn't exist (or building the graph throws for any reason),
  `start()` still resolves and recording still works via `MediaRecorder`
  exactly as before — manual tap-to-stop is the permanent fallback, not
  a temporary gap. Reusing the existing `stopListeningAndSend()` path for
  the new trigger (rather than adding a second "how a turn ends" code
  path) means the manual-tap, max-duration, and now silence-triggered
  stops all funnel through the one already-tested handler, including its
  existing "ignore if not currently listening" guard against double-stops.
- **Alternatives considered:**
  - A real, benchmarked VAD model now — rejected: exactly the capability
    ADR-017 deferred to Phase 11, for the same reasoning given there; no
    new evidence changes that calculus today.
  - Press-and-hold instead of tap-to-toggle (hold the button while
    speaking, release when done) — a real, simpler alternative the user
    was offered; not chosen. Still available to revisit if the silence
    heuristic proves unreliable in practice (e.g. noisy environments
    triggering false stops, or soft speech never crossing the threshold).
  - Doing the analysis in `mic-button.ts` instead of
    `AudioCaptureService` — rejected: the component has no access to the
    live `MediaStream`, which the capture service already owns
    end-to-end; splitting stream ownership across two places for this
    would be a worse shape than one optional callback parameter.
- **Impact:** `frontend/src/app/core/services/audio-capture.service.ts`
  (`start`'s new optional parameter, the watcher and its teardown in
  `stop`/`cancel`), `mic-button.ts` (one call-site change). All four
  tunable constants (check interval, silence duration, minimum
  speech-before-eligible, and the level threshold) are named and
  commented in one place — expected to need real-world tuning; not a
  claim that these exact numbers are correct, only that they're
  isolated and easy to change if they're not.
- **Status:** Accepted.

## ADR-026 - Phase 6 Milestone 6a: `langid` capability boundary, wired into `conversation.Service`

- **Decision:** Four related Milestone 6a choices, following the same
  fake-boundary-first pattern Milestones 2a/3a/4a used for `llm`/`asr`/`tts`:
  1. **New `backend/internal/langid` package**: `LangIDClient` interface
     (`Detect(ctx, DetectRequest{Text}) (DetectResponse{Language,
     Confidence}, error)`), `FakeLangIDClient` (in use now — a tiny,
     self-contained Devanagari-vs-not Unicode check, not a language-ID
     algorithm), and `HTTPLangIDClient` (built now, wired to a real
     service only in Milestone 6b). `proto/langid.openapi.yaml` records
     the contract now, before the Python side exists — same as
     `proto/tts.openapi.yaml` in Milestone 4a.
  2. **Detection is wired into `conversation.Service.SendMessage`**, not
     the Phase 5 orchestrator, right alongside the existing
     `DetectScript` calls — for both the user's text and the LLM's reply,
     on every turn, typed or spoken. `Service` gains a `langIDClient`
     field and a `logger` field (new — `Service` previously logged
     nothing itself); `NewService`'s signature grows from
     `(pool, llmClient)` to `(pool, llmClient, langIDClient, logger)`.
  3. **A detection failure is logged and swallowed, never fatal** —
     `detectLanguage` returns `nil` on error, and `SendMessage` persists
     the turn exactly as it would have otherwise.
  4. **The result is persisted (`turns.detected_language`, migration
     `0003_add_detected_language.sql`) and returned over the API
     (`turnDTO.detectedLanguage`, `docs/openapi/chat.yaml`,
     `frontend/.../turn.model.ts`) but does not yet drive the LLM prompt
     language or the TTS voice, and is not shown in any UI.**
- **Reason:**
  1. Confirmed by reading the code, not assumed:
     `backend/migrations/0002_add_script.sql`'s own comment says script
     detection is "not a language-identification model — that stays
     Phase 6's job." `DetectScript` is a deterministic Unicode-range
     check; language ID (Hindi vs. other Devanagari-script languages,
     Hinglish vs. English in Latin script) is a genuinely harder problem
     this milestone finally builds a real capability boundary for — even
     though the fake behind it, honestly, is barely more sophisticated
     than `DetectScript` itself. The gap between the two is exactly what
     Milestone 6b's real model closes.
  2. `docs/ARCHITECTURE.md`'s pipeline diagram places Language Detection
     right after ASR/STT, operating on text — and `SendMessage` is
     already the one place both the typed (`/chat`) and spoken
     (`/voice/turn`, via the orchestrator calling `SendMessage` exactly
     as before) paths converge, since it already computes `DetectScript`
     "uniformly... at persist time" (ADR-017) for both. Wiring detection
     in here covers both paths with **one** integration point and **zero**
     changes to `backend/internal/orchestrator` or `internal/api`'s
     handlers — the smallest change that satisfies "integrated into the
     turn loop" (`docs/ROADMAP.md` Phase 6 scope).
  3. Same principle ADR-020 established for TTS: a new, non-critical
     signal must never make an existing, working operation (sending a
     message) start failing. Logging (not silently dropping) the failure
     keeps it observable without being disruptive — `Service` gaining a
     logger is a small, contained cost for that, mirroring
     `internal/api.Server`'s existing logger dependency.
  4. `docs/PROJECT_GOAL.md`: "a manual language pin always wins over
     auto-detection." Persisting and returning the detected value without
     letting it drive anything keeps this milestone small, reversible,
     and consistent with that standing product principle — exactly how
     `script` itself shipped and sat unused until a real consumer needed
     it (`turn.model.ts`'s own doc comment already said as much before
     this milestone touched it).
- **Alternatives considered:**
  - Building the real Python `langid` capability and a benchmark now,
    instead of a fake — rejected: the user explicitly chose the smaller,
    2a/3a/4a-sized first step; real candidates (e.g. `ai4bharat/IndicLID`,
    MIT-licensed and purpose-built for native-script *and* romanized
    Indian-language text — a much better fit than general-purpose options
    like fastText's `lid.176`, which has no code-mixed class and a
    CC-BY-SA license) are Milestone 6b's evidence-based selection to make,
    not this one's.
  - Wiring detection into `internal/orchestrator` instead of
    `conversation.Service` — rejected: the orchestrator only sees the
    spoken path; typed messages via `/chat` never touch it, and
    duplicating the call in two places for one signal is worse than one
    integration point in the layer both paths already share.
  - Reusing `DetectScript`'s logic inside `FakeLangIDClient` — rejected:
    would require `internal/langid` to import `internal/conversation`
    while `internal/conversation` also imports `internal/langid` for the
    interface — an import cycle. The fake's own tiny, duplicated
    Unicode check is simpler than restructuring package boundaries to
    avoid it for placeholder code.
  - Letting the detected language immediately override the LLM
    prompt/TTS voice when it disagrees with the manual selection —
    rejected: contradicts `docs/PROJECT_GOAL.md`'s standing "manual pin
    wins" principle outright; worth a real, separate product decision in
    a later milestone, not a side effect of adding the capability.
- **Impact:** `backend/internal/langid` (new), `proto/langid.openapi.yaml`
  (new); `internal/conversation` (`Service`'s new fields and constructor
  signature, `Turn.DetectedLanguage`, `detectLanguage`);
  `backend/migrations/0003_add_detected_language.sql` plus regenerated
  `internal/db` (sqlc); `internal/api/dto.go` (`turnDTO.DetectedLanguage`);
  `internal/config` (`LangIDServiceURL`/`UsesFakeLangID`); `cmd/api/main.go`
  (client wiring, startup log); `docs/openapi/chat.yaml`; frontend
  `turn.model.ts` and `conversation.real.service.ts` (wire shape only, no
  UI change). Milestone 6b (the real Python `langid` engine, benchmark,
  and model-selection ADR) is unblocked by all of this — only
  `VAANISETU_LANGID_SERVICE_URL` needs to be set once it exists, no other
  Go code change, per the same "swap by config" mechanism ADR-006
  established.
- **Status:** Accepted.

## ADR-027 - Phase 6 Milestone 6b: `langid` capability selects `fasttext-lid176`, not `indiclid`

- **Decision:** The real Python `langid` capability is built
  (`app/engines/langid/{base,indiclid_engine,fasttext_lid_engine}.py`,
  `POST /v1/detect` per `proto/langid.openapi.yaml`) and `models.yaml`
  selects **`fasttext-lid176`** (the original `lid.176.bin`,
  CC-BY-SA-3.0), not `ai4bharat/IndicLID` (`indiclid`, MIT) — a real,
  measured, and counter-intuitive result: the general-purpose baseline
  outscored the Indic-specific candidate on this project's own fixture
  set. `indiclid` stays listed as a candidate, not deleted, per
  `AGENTS.md` §4 ("do not create duplicate components" is not "delete
  a real alternative that lost a small-sample benchmark").
- **Reason:**
  1. **The benchmark** (`scripts/benchmark_langid.py`, run for real,
     `benchmark_results/langid_milestone_6b.json`): both candidates
     classify each of `eval_data/asr_fixtures.yaml`'s 8 fixtures (4 Hindi,
     2 Hinglish, 2 English) and are scored against the fixture's labeled
     language.
     | Candidate | Overall accuracy | Hindi | Hinglish | English |
     |---|---|---|---|---|
     | `fasttext-lid176` | **75% (6/8)** | 100% (4/4) | 0% (0/2) | 100% (2/2) |
     | `indiclid` | 50% (4/8) | 50% (2/4) | 0% (0/2) | 100% (2/2) |
     Confusion matrix (true label -> predicted bucket; `other` = any
     prediction outside {hi, hinglish, en}):
     - `fasttext-lid176`: hi -> {hi: 4}; hinglish -> {en: 2}; en -> {en: 2}.
     - `indiclid`: hi -> {hi: 2, other: 2}; hinglish -> {other: 2};
       en -> {en: 2}.
  2. **Why `indiclid` scored lower, verified by hand, not assumed**: its
     two Hindi misses (`hi-weather`, `hi-story`) are its own native-script
     fastText model (`IndicLID-FTN`) confidently (0.91-1.00) predicting
     `mai_Deva` (Maithili) and `doi_Deva` (Dogri) instead of `hin_Deva` —
     genuinely wrong, closely-related-language confusion on short,
     single-sentence Devanagari input, reproduced directly against the
     downloaded model outside this project's code. Its Hinglish misses
     are its romanized model (`IndicLID-FTR`) confidently (0.90-0.96)
     predicting `ben_Latn` (romanized Bengali) and `nep_Latn` (romanized
     Nepali) instead of `hin_Latn` — again a genuine model error, not an
     integration bug, and specifically *not* the BERT-fallback path
     working as intended (both FTR calls exceeded the 0.6
     confidence-to-trust-FTR threshold, so the BERT stage was never
     reached for either miss). `fasttext-lid176`'s own Hinglish misses are
     more explicable: both predicted `en` at low confidence (0.22, 0.32),
     i.e. genuine uncertainty on romanized Hindi it was never trained to
     recognize as a distinct class at all (no code-mixed class exists in
     `lid.176`'s label space) — a known, expected gap, not a surprise.
  3. **A real, load-bearing incompatibility was found and fixed along the
     way, not worked around by skipping the affected stage**:
     `IndicLID-BERT`'s checkpoint is a `torch.load`-ed, fully pickled
     `nn.Module` saved against an older `transformers` version. Loading it
     under this project's `transformers==4.46.1` reproducibly raised
     `AttributeError: 'BertModel' object has no attribute
     'attn_implementation'` on every BERT-fallback call — because that
     attribute is set only in `BertModel.__init__` (line 981 of
     `transformers/models/bert/modeling_bert.py` in this project's
     installed version), and unpickling never calls `__init__`. Fixed in
     `IndicLIDEngine.__init__` by copying
     `self._bert.bert.config._attn_implementation` onto
     `self._bert.bert.attn_implementation` right after `torch.load` — a
     real, minimal, verified-necessary compatibility shim, not a
     hypothetical one; `en-schedule`'s BERT-fallback call failed before
     this fix and passed after it, isolating the fix's effect precisely.
  4. **Neither candidate meets `docs/EVALUATION.md`'s >90% accuracy target
     for Hinglish** — stated plainly, not glossed over. This is a real,
     open gap, not a milestone failure: `docs/DECISIONS.md` ADR-026
     already scoped Milestone 6a/6b to "detection is real but drives
     nothing yet" (no LLM prompt, no TTS voice, no UI depends on this
     value), so a still-imperfect Hinglish signal is not currently
     load-bearing anywhere. It is recorded here as evidence for whoever
     revisits this capability, not hidden.
  5. **Given (1)-(4), the evidence-based choice per `AGENTS.md` §8
     ("model selection is evidence-based... none is selected until
     benchmarked... on the target hardware for... Hinglish... quality")
     is `fasttext-lid176`**: it has the higher measured overall and
     per-language accuracy everywhere the two differ, loads in 0.05s
     versus `indiclid`'s 4.5s (three fastText/BERT models plus a
     tokenizer), and has a near-zero memory/dependency footprint (no
     `torch`/`transformers` model load at all for this capability's own
     purposes, though both remain installed for the `tts` capability
     regardless). Choosing `indiclid` anyway because its architecture is
     *supposed* to handle Hinglish better, when the measured evidence on
     this project's own fixtures says otherwise, would be exactly the
     "select without evidence" `AGENTS.md` prohibits.
  6. **License**: both are viable — `fasttext-lid176` is CC-BY-SA-3.0 (a
     share-alike obligation on redistribution of the model itself, not a
     commercial-use restriction), `indiclid` is MIT (no obligations at
     all). Neither is the deciding factor here, since `fasttext-lid176`
     wins on accuracy regardless; recorded for completeness, same as
     every prior model-selection ADR.
- **Alternatives considered:**
  - **Selecting `indiclid` anyway, on the strength of its purpose-built
    architecture** — rejected per (5) above: this is precisely the kind
    of vibes-based selection `AGENTS.md` explicitly forbids ("model
    selection is evidence-based").
  - **Re-benchmarking against a larger, held-out fixture set before
    selecting anything** — considered, but Phase 9 is explicitly where
    "the automated, repeatable harness" (this project's own recurring
    disclaimer, see `scripts/benchmark_asr.py`/`benchmark_tts.py`) belongs;
    every prior capability (2b/3b/4b) selected from this same small,
    directional, 8-fixture set, so holding `langid` to a stricter
    standard than `llm`/`asr`/`tts` were held to would be inconsistent,
    not more rigorous.
  - **Skipping the BERT-fallback stage entirely (FTN/FTR-only IndicLID)**
    to sidestep the `attn_implementation` incompatibility instead of
    fixing it — rejected: the BERT fallback is specifically what
    disambiguates uncertain romanized text, i.e. the Hinglish case this
    milestone cares about measuring most; skipping it would have hidden
    a real capability gap rather than measuring it honestly, and the fix
    itself was small and verified.
  - **Marking `langid` as "no model meets the bar, capability stays fake"**
    — rejected: `fasttext-lid176` measurably beats the Milestone 6a fake
    (a bare Devanagari-Unicode-range check with no English/Hinglish
    distinction at all) on every fixture, so real progress exists even
    though the Hinglish gap remains; withholding a strictly-better real
    model because it isn't perfect contradicts the incremental,
    evidence-based spirit of `AGENTS.md` §4/§8.
- **Impact:** `ai-services/app/engines/langid/` (new: `base.py`,
  `indiclid_engine.py`, `fasttext_lid_engine.py`); `app/registry.py`
  (`ModelEntry.download_url`/`download_urls`/`bert_tokenizer`,
  `build_engine`'s `fasttext_lid`/`indiclid` branches,
  `_find_model_file` helper); `app/config.py`
  (`langid_model_store_dir`/`VAANISETU_LANGID_MODEL_STORE`); `app/main.py`
  (`POST /v1/detect`, `langid` in `/healthz`, startup loading);
  `models.yaml` (`langid` section, `selected: fasttext-lid176`);
  `scripts/download_models.py` (direct-URL single-file and
  zip-plus-HF-tokenizer download paths); `scripts/benchmark_langid.py`
  (new); `pyproject.toml` (`fasttext`, `requests` added — `torch`/
  `transformers` already present since Milestone 4b);
  `docker-compose.yml` (`VAANISETU_LANGID_MODEL_STORE`,
  `VAANISETU_LANGID_SERVICE_URL`); `ai-services/SETUP.md`. On the Go side,
  per ADR-026's design, only `VAANISETU_LANGID_SERVICE_URL` needs setting
  to switch `conversation.Service` from `FakeLangIDClient` to
  `HTTPLangIDClient` talking to this real model — verified end-to-end
  (see `docs/CURRENT_STATE.md`). No LLM prompt, TTS voice, or UI logic
  reads `detectedLanguage` yet — that boundary, set in ADR-026, is
  unchanged by this milestone.
- **Status:** Accepted.

## ADR-028 - Phase 6 Milestone 6c: Malayalam enabled end to end; TTS's language axis added to the registry

- **Decision:** Four related Milestone 6c choices:
  1. **`models.yaml`'s `tts.selected` becomes a two-level
     `{language: {voice: key}}` map**, not the flat `{voice: key}` map
     ADR-023 introduced. `app/registry.py`'s `load_selected_entry` gains a
     `language` parameter for `tts`; a new `tts_languages()` helper reads
     the configured language set from `models.yaml` rather than
     hardcoding it in `app/main.py`. The startup loop now loads one engine
     per `(language, voice)` pair, de-duplicated by candidate key so
     `hi`/`hinglish` sharing the same Hindi checkpoints load them once,
     not twice. `get_tts_engine`/`/v1/synthesize` now select by
     `(language, voice)`; an unconfigured language is a clean `400`
     ("tts not available for language X") instead of silently routing to
     the Hindi engine and failing inside it — the same failure mode
     Hinglish already had (ADR-021's `UnsupportedTextError`), now
     surfaced correctly as a missing-language response for any language
     genuinely not configured, while Hinglish keeps its existing
     in-engine-failure behavior since it *is* configured (against the
     Hindi checkpoints, which still can't speak Latin script).
  2. **`facebook/mms-tts-mal` (CC-BY-NC-4.0) added and selected** as
     Malayalam's TTS candidate — the only viable one found. A broader
     Hugging Face search for a Malayalam MMS-VITS fine-tune equivalent to
     `Anjan9320/fb-mms-tts-hin-ft-female` (Hindi's female voice, ADR-022)
     turned up none; other Malayalam TTS projects found (Praha-Labs'
     LFM/Qwen3/Orpheus-based models, Sandhya2002's Spark/Orpheus models)
     use entirely different architectures that would require new engine
     wrappers and new dependencies — rejected per `AGENTS.md` §4's "no
     unnecessary dependencies" for uncertain quality gain. Both the
     "female" and "male" voice keys point at the same `mms-tts-mal`
     engine instance — a real, honestly-recorded asymmetry with Hindi's
     two distinct voices, not an oversight.
  3. **Malayalam is enabled in the UI
     (`LANGUAGE_OPTIONS[].enabled = true` for `ml`)** despite its TTS
     failing badly — see the Reason section for the real numbers and the
     reasoning for shipping anyway.
  4. **Self-hosted Malayalam typography added**: `Noto Sans Malayalam`
     (SIL OFL 1.1, `public/fonts/OFL-Malayalam.txt` — a separate license
     file from the Devanagari font's, since each Noto script repo carries
     its own copyright line) alongside the existing Devanagari font;
     `message-bubble.ts`'s `langAttr` (previously a single Hindi-only
     ternary) generalizes to a small set lookup covering both
     script-specific languages.
- **Reason:**
  1. **The real, measured evidence, per capability** (fixtures:
     `eval_data/asr_fixtures.yaml`'s four new `ml-*` entries; results:
     `benchmark_results/tts_milestone_4b.json`,
     `benchmark_results/langid_milestone_6b.json`, and a one-off
     `--only llama-3.2-3b-instruct` run for the LLM, not saved over the
     committed `llm_milestone_2b.json` since it isn't a re-selection):
     - **langid: strong pass.** 100% accuracy (4/4) for *both*
       `fasttext-lid176` and `indiclid` — Malayalam's own Unicode block
       (U+0D00-0D7F) makes it trivially distinguishable, unlike the
       Devanagari-vs-Devanagari and Latin-vs-Latin ambiguity that caused
       Hindi/Hinglish's imperfect scores in ADR-027. The strongest
       language-detection result measured in this project so far.
     - **LLM: pass, read directly** (per `docs/EVALUATION.md` §3,
       "multilingual quality" has no automated score). The
       already-selected `llama-3.2-3b-instruct` produced fluent,
       grammatical, on-topic Malayalam for both a weather question
       (correctly referencing Kerala) and a short-story request — no
       code change was needed since `llama_cpp_engine.py`'s
       `_LANGUAGE_NAMES`/system-prompt template already covered `ml`, an
       artifact of the prompt already being written generically for
       every `LanguageCode`, not a change made for this milestone.
     - **TTS: fails badly.** `mms-tts-mal`'s proxy WER (synthesize the
       fixture text, transcribe it back with the already-selected
       `faster-whisper-large-v3-turbo`, compare) ranged 100-150% against
       `docs/EVALUATION.md` §5's <10% target — e.g. `ml-greeting`
       transcribed back as unintelligible fragments
       ("ൾ�ൾ� ്ൾ�ൾൾ്ു..."). This proxy conflates TTS and ASR quality
       (there is no independent Malayalam recording or macOS system
       voice to isolate which is at fault — confirmed directly via
       `say -v '?'`: Hindi/Bengali/Tamil/Telugu/Kannada have a voice,
       Malayalam doesn't) — a real, stated limitation, not a
       hypothetical one, and not something this milestone can resolve
       without Phase 8's future real dataset pipeline.
  2. **The enable/disable decision was a real policy conflict, put to the
     user rather than decided silently** (`AGENTS.md` §14): `docs/ROADMAP.md`
     Phase 6's Definition of Done reads literally as "every threshold
     must pass, languages that fail stay disabled" — Malayalam's TTS
     result fails that reading outright. But Hinglish already ships
     enabled today despite its own TTS failing *completely* (not just a
     bad score — a total `UnsupportedTextError` for every fixture, ADR-021),
     because a TTS failure is non-fatal by design (ADR-020: the text
     conversation still completes, voice output for that turn silently
     doesn't happen). Presented both readings, with a recommendation to
     follow the Hinglish precedent; the user chose to enable Malayalam,
     consistent with that precedent rather than the DoD's literal
     wording — recorded here as the applicable precedent for the next
     language this happens for, not a one-off exception.
  3. The registry's language axis is real, useful new architecture
     regardless of Malayalam specifically —
     `docs/ARCHITECTURE.md` §3.6 already anticipated "later each
     language" as the intended shape; this milestone is what actually
     builds it, and every future TTS-language addition reuses it as a
     pure `models.yaml` edit (ADR-006), not a code change.
- **Alternatives considered:**
  - **Keeping Malayalam disabled until a better TTS candidate or a real
    recording exists** — the literal-DoD reading; rejected in favor of
    the Hinglish-precedent reading per the user's explicit decision
    above, not because the TTS gap isn't real (it is, and stays
    documented as a known, open gap for Malayalam specifically).
  - **Building a new engine wrapper for one of the other Malayalam TTS
    projects found (LFM/Qwen3/Orpheus/Spark-based)** — rejected: unknown
    quality, a new dependency and a new `TTSEngine` implementation for an
    unverified gain, when `mms_vits`'s existing wrapper already works
    mechanically (it synthesizes real audio, just at poor measured
    quality) — not a "no candidate works at all" situation.
  - **Keeping `tts.selected` flat and special-casing Malayalam in Python
    code instead of the registry** — rejected: exactly the kind of
    per-language `if` branch `docs/ARCHITECTURE.md`'s "later each
    language... in the model registry" phrasing was written to avoid,
    and would need to be undone the next time a language is added anyway.
- **Impact:** `ai-services/app/registry.py` (`load_selected_entry`'s
  `language` param, new `tts_languages()`); `app/main.py` (nested
  `(language, voice)` loading + dedup, `get_tts_engine`, `/v1/synthesize`,
  `/healthz`); `models.yaml` (`tts.selected` reshaped, `mms-tts-mal`
  added); `eval_data/asr_fixtures.yaml` (four `ml-*` fixtures, no `voice`
  field); `scripts/generate_audio_fixtures.py` (skips fixtures with no
  `voice`); `scripts/benchmark.py` (two `ml` prompts added to `_PROMPTS`);
  `tests/test_registry.py`/`tests/test_main.py` (new-shape coverage);
  frontend `language.model.ts` (`ml.enabled = true`), `styles.scss`/
  `_tokens.scss` (Malayalam font-face, token, `[lang='ml']` rule),
  `message-bubble.ts` (`langAttr` generalized), plus the two new font
  files under `public/fonts/`. No Go source change — `language`/`voice`
  were already required, validated, passed-through fields end to end
  (`internal/api/dto.go`'s `isValidLanguage` already included `ml`).
  Verified end-to-end live: `/healthz` reports the nested shape correctly,
  `POST /v1/synthesize` returns real Malayalam audio, `POST
  /api/v1/chat` with Malayalam text returns a real Malayalam LLM reply
  with `script: "Malayalam"` and `detectedLanguage: "ml"`, and `POST
  /api/v1/speech/synthesize` returns real audio through the Go backend.
- **Status:** Accepted.

## ADR-029 - Phase 6 Milestone 6d: Hinglish TTS via transliteration; Malayalam's real bottleneck diagnosed

- **Decision:** Two independent fixes, on explicit direction to close both
  known gaps before any further language work:
  1. **`MmsVitsEngine.synthesize()` transliterates `hinglish`-language
     text from romanized Hindi to Devanagari (ITRANS scheme, via the new
     `indic-transliteration` dependency, MIT) before tokenizing**, instead
     of immediately raising `UnsupportedTextError` for every Hinglish
     request as it did since ADR-021. No other language is transliterated
     — `en` (and anything else with no Devanagari) still raises the same
     error as before.
  2. **A real, human-recorded Malayalam audio diagnostic was built and
     run** (`eval_data/malayalam_real_fixtures.yaml`,
     `scripts/download_malayalam_real_fixtures.py`,
     `scripts/benchmark_malayalam_real_asr.py`) — five short utterances
     from Google's IndicTTS Malayalam corpus (OpenSLR resource 63,
     CC-BY-SA-4.0, ~710MB one-time download, only the manifest is
     committed per `AGENTS.md` §12). This is the project's first
     real, non-synthetic audio fixture set.
- **Reason:**
  1. **Hinglish, measured, real change**: before, both Hindi TTS
     candidates failed 100% of Hinglish fixtures
     (`UnsupportedTextError`, ADR-021). After transliteration, both
     candidates now produce real audio for 100% of them — a genuine
     crash-to-audio fix. Word-level quality is still poor
     (`mms-tts-hin-ft-female`: `hinglish-weather` WER 1.00,
     `hinglish-joke` WER 1.00; `mms-tts-hin`: WER 1.25 and 1.00
     respectively) because both fixtures are heavily mixed with genuine
     English loanwords ("weather", "joke", "bata sakte ho" alongside
     them) that a rule-based romanized-Hindi scheme transliterates into
     meaningless Devanagari phonemes rather than recognizing as English —
     an inherent, accepted limit of this approach, not a bug, and stated
     as such before implementation (the alternative, a real neural
     transliterator via `ai4bharat-transliteration`, was rejected for
     pulling in `fairseq` and other large, legacy dependencies for
     uncertain gain over this simpler fix, `AGENTS.md` §4). The practical
     result: Hinglish speech that leans mostly Hindi with light
     code-switching will now be spoken reasonably; heavily English-mixed
     Hinglish still won't be understandable — a real, partial
     improvement, not a full fix, and the milestone's objective was
     exactly this: "not a guarantee of solving English-loanword
     mispronunciation."
  2. **Malayalam, a genuinely important finding**: running the
     already-selected `faster-whisper-large-v3-turbo` against *real*
     human Malayalam speech (not TTS output) measured a mean WER of
     **0.96** — nearly as bad as the TTS proxy's 100-150%. This means
     Milestone 6c's proxy-WER measurement was not primarily indicting
     `mms-tts-mal`'s synthesis quality; **faster-whisper's own Malayalam
     recognition is itself weak**, independent of any TTS involvement.
     One of the five real clips (`mlf_06469_00325832880`) was transcribed
     entirely in **Devanagari script** instead of Malayalam script
     despite `language="ml"` being forced — a genuine script-confusion
     bug/limitation in Whisper's Malayalam handling specifically, distinct
     from Hindi/English where forced-language decoding has reliably kept
     script correct (ADR-018). The other four stayed in Malayalam script
     with real phonetic errors — several hypotheses are recognizably close
     to the reference despite high word-level WER (e.g. reference
     "അതിൽ ഒരു കാരണം ഞാൻ പറയാം" / hypothesis "അദിലോരു കാരണം നാം പരയം." —
     "കാരണം" matched exactly, "പറയാം"/"പരയം" is phonetically close), which
     `word_error_rate`'s exact-string matching can't credit — a real,
     stated caveat on the 0.96 headline number, not a claim that Whisper
     produces zero usable signal for Malayalam.
  3. **Given (2), there is no further "fix" available within this
     project's existing tools**: no better Malayalam TTS candidate exists
     (ADR-028's search already covered this), and the newly-discovered
     real bottleneck is partly in the *already-selected* ASR engine, which
     was chosen and benchmarked for Hindi/Hinglish/English (ADR-018) —
     re-benchmarking ASR candidates specifically for Malayalam quality is
     a real, separate, larger effort (a new candidate search, new
     benchmark criteria) explicitly out of this milestone's scope. The
     honest outcome here is a properly diagnosed root cause, not a
     resolved metric — exactly the milestone's stated, accepted possible
     result.
- **Alternatives considered:**
  - **`ai4bharat-transliteration` (IndicXlit)** for Hinglish — a real
    neural transliterator trained on casual romanization, likely better
    quality than ITRANS's rule-based mapping — rejected for its dependency
    footprint (`fairseq`, `tensorboardX`, `flask`, and other large, legacy
    packages) relative to the uncertain quality gain over the lightweight
    option that was actually tried and measured.
  - **Re-requesting `ai4bharat/indic-parler-tts`'s gated HF access** as
    the Hinglish fix (it already lists a "hinglish" voice, Apache-2.0,
    would need no transliteration hack at all) — not pursued this
    milestone: access was already denied once (ADR-021) and re-requesting
    is outside engineering control/timeline, unlike the transliteration
    approach, which was actionable immediately.
  - **Skipping the Malayalam diagnostic and just searching harder for a
    different TTS candidate** — rejected per the explicit direction to
    properly diagnose first; doing so would have kept the project
    guessing at the wrong component, which is exactly what the real-audio
    test just corrected.
  - **Downloading Common Voice Malayalam via Hugging Face `datasets`**
    instead of OpenSLR — tried first; `datasets-server`'s
    `first-rows` endpoint returned "Not found" for the configs tried, and
    Common Voice's own access terms typically need auth/agreement, making
    OpenSLR's direct, unauthenticated, clearly-licensed download the more
    reliable choice.
- **Impact:** `ai-services/pyproject.toml` (`indic-transliteration`
  added); `app/engines/tts/mms_vits_engine.py` (transliteration branch);
  `tests/test_mms_vits_engine.py` (new coverage, and one existing test's
  `language` fixed from `"hinglish"` to `"en"` since it no longer
  represents genuinely unsupported text otherwise); new
  `eval_data/malayalam_real_fixtures.yaml`,
  `scripts/download_malayalam_real_fixtures.py`,
  `scripts/benchmark_malayalam_real_asr.py`,
  `benchmark_results/malayalam_real_asr_diagnostic.json`; `.gitignore`
  (the new real-audio cache/output directories — the corpus archive and
  extracted clips are never committed, only the fixture manifest and the
  diagnostic's result JSON are). No Go or frontend change — this
  milestone is entirely within `ai-services`. `models.yaml`'s `tts`
  selections are unchanged (no new or different TTS candidate was
  selected for either language); this milestone improved Hinglish's
  existing selected engines' behavior and diagnosed, rather than changed,
  Malayalam's.
- **Status:** Accepted.

## ADR-030 - Auto-detect drives typed-chat behavior, opt-in, chat-only

- **Decision:** `POST /api/v1/chat`'s `language` field accepts a new
  sentinel value, `"auto"`, in addition to a concrete `LanguageCode`.
  When a request sends `"auto"`, `conversation.Service.SendMessage`
  reuses the `langid` detection call it already makes for the user's
  text (Milestone 6a, ADR-026) to resolve a real language *before*
  calling the LLM: if detection succeeded and returned one of this app's
  12 supported codes, that becomes `resolvedLanguage`; otherwise
  (detection failed, or returned a `fasttext-lid176` label outside the
  supported set) it falls back to a `defaultLanguage` constant (`"hi"`).
  `resolvedLanguage` drives the LLM's reply language and is persisted as
  both turns' `Turn.Language` — `Turn.DetectedLanguage` keeps recording
  the raw, unclamped detection result exactly as before, unaffected by
  the fallback. A manual, concrete `language` value behaves exactly as
  it always has; only `"auto"` triggers resolution.

  On the frontend, this is strictly opt-in: `SettingsStore` gets a new
  `autoDetectLanguage` boolean signal (persisted, default `false`) and a
  computed `effectiveChatLanguage()` (`"auto"` when the toggle is on,
  else the pinned `preferredLanguage`) that only `text-input-bar.ts`
  reads. Turning auto-detect on leaves the stored `preferredLanguage`
  untouched, so turning it back off restores the last concrete pin. The
  header `LanguageSelector` and the Settings page's `LanguagePreferences`
  both gained one new "Auto-detect" entry, above the 12 language options,
  that sets `autoDetectLanguage(true)` without touching the pin; picking
  any concrete language does the reverse.

  `POST /api/v1/voice/turn` (and, by the same reasoning, `/speech/
  transcribe` and `/speech/synthesize`) explicitly reject `"auto"` with a
  clean `400 invalid_request` rather than silently accepting it — `mic-
  button.ts` keeps sending `preferredLanguage()` directly, unchanged.
  This is deliberate and scoped, not an oversight: see Reason.

- **Reason:** `docs/PROJECT_GOAL.md` §6 already states detection driving
  behavior, with a manual pin overriding it, as the intended long-term
  design — Milestone 6a's ADR-026 built the detection capability but
  explicitly deferred wiring it into anything, "does not yet drive the
  LLM prompt language or the TTS voice," as a smaller first step. This
  milestone is that deferred step, scoped down twice on evidence already
  in this project's own history:
  1. **Opt-in, not a default-on behavior change**: every existing session
     has a concretely pinned language today (the frontend's `preferred
     Language` signal is non-nullable). Flipping detection on by default
     would silently change reply language for existing users on upgrade;
     opt-in keeps today's behavior identical unless a user deliberately
     turns the new setting on.
  2. **Typed chat only, not voice**: ADR-018 already found that letting
     Whisper auto-detect the spoken language (no forced hint) transcribes
     romanized Hinglish speech into the *wrong script* (Devanagari
     instead of Latin) — voice-turn auto-detection needs the language
     *before* transcription even runs, which is a real, separate,
     harder chicken-and-egg problem (a cheap first-pass hint, or a
     two-pass transcribe) deliberately left unsolved rather than worked
     around. Typed text has no equivalent problem: the text already
     exists before detection runs.
  3. **A defined, honest fallback for out-of-scope detection**: the real
     `fasttext-lid176` model (ADR-027) can return any of its 176
     ISO-639 labels, a strict superset of this app's 12 supported codes,
     and can never emit `"hinglish"` (not in its label space). Letting an
     out-of-scope label reach the LLM call or get persisted as `Turn.
     Language` would be silently wrong; falling back to `defaultLanguage`
     keeps behavior defined while `Turn.DetectedLanguage` still honestly
     records whatever langid actually returned.
  4. **Reusing the existing detection call, not adding a second one**:
     `SendMessage` already called `detectLanguage` on the user's text for
     `Turn.DetectedLanguage` before this change; resolving `"auto"` reads
     that same result rather than invoking `langid` twice per turn.
  5. **Zero TTS-trigger code change needed**: `speakReply` already reads
     the *returned* `assistantTurn.language` from the backend, not
     `SettingsStore` again — once Go resolves `"auto"` into a concrete
     language before persisting/returning the turn, the existing,
     unmodified TTS call site picks the correct voice automatically.
  6. **The optimistic user-turn append needed a real fix, not a
     workaround**: `ConversationRealService.sendUserTurn` appends the
     user's turn to the UI immediately, before the backend responds. If
     the raw `"auto"` request value were used as that optimistic turn's
     `language`, `message-bubble.ts`'s `languageLabel(turn.language)`
     would render the literal string "auto" — and, since that user turn
     was never previously reconciled with the server's response, would
     have shown it *permanently*. Fixed two ways: the optimistic turn
     now shows the current `preferredLanguage()` pin as a placeholder
     (never the literal `"auto"`, since `Turn.language: LanguageCode`
     never includes it), and a new `replaceTurn` swaps that placeholder
     for the server's resolved turn once the response arrives — a real
     correctness fix this milestone's frontend work exposed, not
     optional polish.
- **Alternatives considered:**
  - **Default auto-detect to on for everyone** — rejected: a silent
    behavior change for existing users on upgrade, contrary to this
    project's privacy/control-first principles (`AGENTS.md` §10).
  - **Also wire `/voice/turn`** — rejected this milestone: needs its own
    design for the ASR-hint chicken-and-egg problem (ADR-018), which is
    a separate, harder effort than typed chat's detect-after-text-exists
    case; explicitly deferred rather than worked around with something
    fragile.
  - **Silently clamping an out-of-scope detected language to `"en"`
    instead of a named `defaultLanguage` fallback** — rejected in favor
    of a named constant mirroring the frontend's own `DEFAULT_LANGUAGE`
    (`"hi"`), so the fallback is one documented, greppable value instead
    of an incidental default.
- **Impact:** `backend/internal/conversation/conversation.go`
  (`autoLanguage`, `defaultLanguage`, `supportedLanguages`,
  `resolveLanguage`, `SendMessage` rewritten to resolve before
  generating); `backend/internal/api/dto.go` (`isValidLanguage` accepts
  `"auto"`); `backend/internal/api/server.go` (`handleVoiceTurn`,
  `handleTranscribe`, `handleSynthesize` each explicitly reject `"auto"`
  — the latter two beyond `/voice/turn` alone because `isValidLanguage`
  becoming globally permissive to `"auto"` would otherwise let it reach
  them too); `docs/openapi/chat.yaml` (`"auto"` documented, plus a stale
  `detectedLanguage` doc comment fixed to describe the real
  `fasttext-lid176` model instead of Milestone 6a's placeholder);
  `docs/openapi/voice.yaml` (explicit note + 400 case that `"auto"` is
  rejected). Frontend: `core/models/language.model.ts`
  (`ChatLanguageRequest`, `AUTO_DETECT_OPTION`); `core/services/
  settings.store.ts` (`autoDetectLanguage`, `effectiveChatLanguage`);
  `core/services/conversation.service.ts` (`sendUserTurn`'s `language`
  widened to `ChatLanguageRequest`); `core/services/
  conversation.real.service.ts` (optimistic-turn placeholder +
  `replaceTurn` reconciliation, described above); `assistant/
  text-input-bar/text-input-bar.ts` (sends `effectiveChatLanguage()`);
  `assistant/mic-button/mic-button.ts` (comment only, no functional
  change); `shared/components/language-selector/` and `settings/
  language-preferences/` (new "Auto-detect" entry, both places a
  language pin is set). New Go tests in `conversation_test.go`
  (`resolveLanguage`, no Docker needed) and `conversation_integration
  _test.go` (`SendMessage` auto-mode, Docker-gated like its neighbors);
  new `internal/api` handler tests for all four endpoints' `"auto"`
  acceptance/rejection. New/updated frontend tests for `SettingsStore`,
  `LanguageSelector`, `LanguagePreferences`, `TextInputBar`, and
  `ConversationRealService`. No `ai-services` change — Go resolves
  `"auto"` before Python ever sees a request; no change to which model
  `langid` uses (`fasttext-lid176` stays as ADR-027 selected it).
- **Status:** Accepted.

## ADR-031 - Phase 6 Milestone 6f: Maithili — real evidence gathered, not enabled

- **Decision:** Wired Maithili (`mai`) into the same per-language
  scaffolding every prior language uses — `backend/internal/api/dto.go`'s
  `validLanguages`, `internal/conversation`'s `supportedLanguages`,
  `docs/openapi/chat.yaml`'s `LanguageCode` enum, the frontend's
  `LanguageCode` union and `LANGUAGE_OPTIONS` (disabled), the Devanagari
  `[lang='mai']` font-stack rule, and a new `mms-tts-mai` TTS candidate in
  `models.yaml` — then measured all four capabilities against real
  fixtures rather than assuming any of them would work. **Left
  `LANGUAGE_OPTIONS`'s `mai.enabled` at `false`**: the results below are
  real, not marginal, and materially different in kind from every
  language enabled so far.
- **Reason — four real, measured findings, each checked directly against
  the actual installed code/model, not assumed:**
  1. **LLM: fails outright, not just weakly.** Ran the already-selected
     `llama-3.2-3b-instruct` directly against all four Maithili fixtures.
     It understood every prompt correctly (answered "capital of India"
     correctly, told an on-topic story, greeted appropriately) but
     **replied in standard Hindi every single time, never Maithili** —
     0/4, against `docs/EVALUATION.md` §3's ">95% of turns" language-
     fidelity target. This is categorically different from Malayalam's
     result (ADR-028: "fluent, on-topic Malayalam, no code change
     needed") — comprehension works, generation defaults to the nearest
     language the model actually has real training data for. (Also
     fixed a real, necessary gap found along the way: `llama_cpp_engine.
     py`'s `_LANGUAGE_NAMES` display-name map had no `"mai"` entry either
     — every prior language including `ml` needed one added when it was
     introduced; without it the system prompt would have said "reply in
     mai" verbatim, an even weaker signal than "reply in Maithili".)
  2. **langid: real, but the weakest result any language has measured
     with the selected model.** Loaded `models/langid/lid.176.bin`
     directly and confirmed `mai` is one of its 176 labels (unlike
     Whisper, fastText does have real Maithili training data) — then ran
     `scripts/benchmark_langid.py` for real: `fasttext-lid176` (the
     already-selected model, ADR-027) scored **50% (2/4)** on Maithili,
     misclassifying `mai-story` as `ne` (Nepali) and `mai-greeting` as
     `hi` — plausible confusions given how closely Maithili, Nepali, and
     Hindi share vocabulary in short phrases, not a technical failure.
     Below every other configured language's accuracy with this model
     except Hinglish's already-documented 0% (ADR-027).
  3. **TTS: a real candidate exists, and fails the same way Malayalam's
     did.** `facebook/mms-tts-mai` (CC-BY-NC-4.0) is a real, published
     MMS checkpoint — added to `models.yaml` and downloaded for real.
     `scripts/benchmark_tts.py`'s synthesize-then-transcribe proxy
     measured WER **100%, 125%, 100%, 150%** across the four fixtures
     (mean 118.75%) — same 100–150% range Malayalam's own TTS candidate
     failed at (ADR-028), against the `docs/EVALUATION.md` §5 target of
     <10%. The proxy itself is doubly unreliable here in a way it wasn't
     for Malayalam: the transcription half of the proxy can't force
     Whisper into a Maithili mode either (see finding 4), so even this
     100–150% number is measuring transcribed-back *something*, not
     cleanly isolating TTS quality — stated as a real limitation, not
     hidden.
  4. **ASR: a capability gap, and — checked directly, not assumed —
     silently the *wrong kind* of gap.** `faster-whisper`'s language
     table has no `"mai"` entry (confirmed against its tokenizer, and
     upstream OpenAI Whisper's own on GitHub) — a capability gap, unlike
     Malayalam's accuracy gap (ADR-029), which at least had a valid `"ml"`
     code. The real, checked-not-assumed part: this project's own
     `FasterWhisperEngine._WHISPER_LANGUAGE_HINTS` dict doesn't propagate
     an unmapped code into a call that would raise a clean error — `.get()`
     returns `None` for `"mai"`, and `WhisperModel.transcribe(language=
     None, ...)` falls back to Whisper's own auto-detection, exactly
     ADR-018's already-documented wrong-script failure mode for
     un-hinted Hinglish. `backend/internal/api/server.go`'s
     `handleVoiceTurn`/`handleTranscribe` reject `"mai"` outright with a
     clean `400` specifically *because* of this — an unrejected request
     would silently produce a wrong-language transcript, not fail loudly.
  - **Why not enable anyway, on the Hinglish/Malayalam "ship with a known
    gap" precedent (ADR-020/ADR-028)?** That precedent was always about a
    *secondary* channel (voice output, or an ASR quality weakness) while
    the *primary* channel — typed chat replying in the right language —
    still worked. Here the primary channel is what fails: the LLM never
    replies in Maithili at all. Enabling `mai` today would mean shipping
    a language selector entry where every single typed reply comes back
    in Hindi instead — not a degraded experience, a non-functional one.
    That distinction, not a numeric threshold, is why this milestone
    stops short of flipping `enabled: true` and instead puts the decision
    to the user explicitly, per `AGENTS.md` §14.
- **Alternatives considered:**
  - **Source Maithili benchmark text from FLORES-200's `mai_Deva` split**
    (Meta, CC-BY-SA-4.0, professionally translated) as originally
    planned — every hosting mirror checked (`openlanguagedata/
    flores_plus`, `facebook/flores`) is gated behind Hugging Face
    authentication unavailable in this environment. Fell back to four
    directly-composed fixtures using well-documented Maithili grammar
    (the `अछि`/`छी` copulas, `टा` classifier, `अहाँ`/`हमरा` pronouns, `क`
    genitive) — the same "written directly, not sourced from a certified
    corpus" basis the pre-existing Hindi/Malayalam fixtures already have,
    stated explicitly in `eval_data/asr_fixtures.yaml` rather than
    implied. A native-speaker review of these four sentences before
    treating any result above as final would be a reasonable next step.
  - **Add a `"mai"` entry to `_WHISPER_LANGUAGE_HINTS` pointing at a
    close relative's code (e.g. `"hi"`)** so voice input at least
    produces *some* transcript — rejected: this would silently transcribe
    Maithili speech as if it were Hindi, actively misleading rather than
    honestly unsupported, worse than the clean 400 shipped instead.
  - **Duplicate `test_synthesize_dispatches_to_the_requested_language`'s
    pattern for `"mai"` specifically** — rejected: that test already
    proves the language-dispatch mechanism generically using a synthetic
    second language (it already used `"ml"` as its example); a `"mai"`
    copy would exercise the identical generic code path a third time for
    zero additional coverage, the kind of duplication `AGENTS.md` §4
    warns against. No registry/dispatch code changed this milestone at
    all, so there was nothing new at that layer to test.
- **Impact:** `backend/internal/api/dto.go` (`validLanguages`,
  `maithiliLanguage`), `internal/api/server.go` (`handleVoiceTurn`/
  `handleTranscribe` reject `mai`), `internal/conversation/
  conversation.go` (`supportedLanguages`); `docs/openapi/{chat,voice,
  speech}.yaml`; `ai-services/models.yaml` (`mai` TTS entry,
  `mms-tts-mai` candidate), `ai-services/eval_data/asr_fixtures.yaml`
  (four `mai-*` fixtures), `ai-services/app/engines/llama_cpp_engine.py`
  (`_LANGUAGE_NAMES["mai"]`); `benchmark_results/langid_milestone_6b.json`
  and `benchmark_results/tts_milestone_4b.json` re-run and updated (both
  are living, re-run-per-milestone artifacts, not frozen snapshots — same
  convention Milestone 6c/6d already established). Frontend:
  `core/models/language.model.ts` (`LanguageCode`, `LANGUAGE_OPTIONS`
  disabled entry), `core/models/example-prompt.model.ts` and
  `core/services/conversation.mock.service.ts` (compiler-forced `Record<
  LanguageCode, string>` cascades), `assistant/message-bubble/
  message-bubble.ts` (`SCRIPT_SPECIFIC_LANGUAGES`), `styles.scss`
  (`[lang='mai']`, reuses the Devanagari stack — no new font). No change
  to `langid`/`llm`/`asr` model *selection* (ADR-016/ADR-018/ADR-027 all
  unchanged) — this milestone only measured whether Maithili works with
  what's already selected.
- **Status:** Accepted (as a diagnostic, matching Milestone 6d's Malayalam-
  ASR precedent) — real evidence gathered and honestly recorded, `mai`
  wired into every layer's config, but **not enabled**, pending the
  user's explicit call on whether to ship it anyway per `AGENTS.md` §14.

## ADR-032 - Three.js returns for the hero's map strip, scoped to real India geography + connections

- **Decision:** Reversed part of the landing-page hero rework
  (commit `624f0ed`, which itself reversed ADR-019 by removing the
  entire Three.js hero and dropping `three`/`@types/three` from
  `package.json` — landing-page bundle ~113KB -> ~36KB): `three`
  (`0.186.1`) and `@types/three` (`0.186.0`) are back as exact-pinned
  dependencies, used for exactly one thing — a real Three.js scene
  replacing the hero's static `map-scene.jpg` strip with a glowing
  outline of India, 6 pulsing markers at the hero's own region-card
  positions, and animated connection arcs between them.

  This is a **user-approved, informed reversal**, not a silent one: the
  request ("rebuild it in Three.js, connections should be seen")
  was flagged as conflicting with the recent removal before any code was
  written (`AGENTS.md` §14) — the bundle-size/complexity tradeoff was
  explained, the user chose to proceed anyway, and explicitly said to
  "remove what not needed" from the old system rather than restore it
  wholesale. What actually got reused vs. left out, checked directly
  against the removed code (`git show 624f0ed~1:frontend/src/app/
  landing/three/`):
  - **Not reused:** `core-system.ts`/`hero-runtime.ts`/`platform-system.
    ts`/`interaction-controller.ts`/`project-to-screen.ts` (the abstract
    "communication core" hero centerpiece and DOM-projected 3D pick
    targets for demo language nodes — ADR-019's own reasoning for real
    DOM buttons over 3D pick targets still holds, and the mic button/
    region cards/status panel built this session already are real DOM,
    verified live); `landmark-geometry.ts` (pagodas/colosseums/gates — a
    world-culture "growing network of languages" motif already rejected
    once in the 624f0ed removal as overstating language breadth VaaniSetu
    doesn't have; this project is India-focused now).
  - **Technique reused, data replaced:** `globe-network.ts`'s approach
    (`BufferGeometry`/`LineSegments`/`Points`, `QuadraticBezierCurve3`
    arcs between glowing nodes) was explicitly "non-geographic/
    conceptual" — a random sphere. The new `india-map-scene.ts` uses the
    same primitives against **real India geography** instead.
  - **Kept as-is, untouched:** `environment-support.ts`
    (`prefersReducedMotion`/`supportsWebGL`) — survived the removal
    already; still the exact capability gate used here.
  - **Revived, small and unchanged in substance:** `read-css-color.ts`
    (8 lines) — reads `--vs-cyan`/`--vs-gold` off `:root` so the scene's
    colors can't drift from `_tokens.scss`.

  **Real geography, sourced and verified, not approximated:**
  `datameet/maps`' `Country/india-composite.geojson` (MIT). The
  mainland polygon's outer ring (242,146 raw points: full coastline +
  land border) was simplified to 392 points (~0.3° minimum vertex
  spacing), aspect-corrected (`cos(mean latitude)` on longitude), and
  centered/scaled into a compact unit space — checked into
  `three/india-outline-data.ts` with the exact processing steps
  documented in its own header comment. A first attempt used that same
  repo's `india-land-simplified.geojson`; its bounding box (lat
  21.9°-37.1°) revealed it was a **land-border-only** line missing the
  entire coastline and all of South India — caught by checking the
  actual numbers against known geography (Kanyakumari is ~8°N), not
  assumed correct because it downloaded successfully. The hero's 6
  region cards' positions (`hero-region.model.ts`) are projected through
  the identical formula from their real state-capital coordinates, so
  they land correctly relative to the outline.

  **A real technical correction made during implementation, not
  assumed:** the plan's original "second, wider line for glow" idea
  (mirroring what a literal reading of old code might suggest) doesn't
  actually work — `LineBasicMaterial.linewidth` is ignored above 1px by
  WebGL on most browsers, a well-known platform limitation. The glow is
  a CSS `filter: drop-shadow(...)` on the `<canvas>` element instead
  (`india-map.scss`), which genuinely works. A second real bug, found by
  taking and looking at an actual live screenshot rather than trusting
  the build: the canvas's initial `alpha: true`/transparent clear color
  let the light section below the hero bleed starkly through the
  `.hero-map` fade mask — the old static JPG had its own dark background
  baked into the image, which is what made that same mask look fine
  before. Fixed by rendering an opaque `--hero-bg`-matching clear color
  instead of a transparent one.
- **Reason:** The static photo didn't read as India and showed no sense
  of connection between regions — the actual, stated purpose of this
  strip. A real map with real regional connections is a genuine
  visual upgrade the static image (or a CSS-only alternative, which was
  offered first and set aside in favor of this) couldn't deliver.
  Scoping to *only* the map strip — not the whole hero centerpiece, not
  DOM-projected pick targets, not world landmarks — keeps this from
  reintroducing the exact complexity/bundle cost the original removal
  was about, while still delivering what was actually asked for.
- **Alternatives considered:**
  - **A CSS/SVG-only "connections" effect** (animated glowing lines
    between the mic and region cards, no Three.js) — proposed first as
    the option that wouldn't reverse the recent removal at all; the user
    chose the Three.js rebuild instead once the tradeoff was explained.
  - **Restoring the old hero wholesale** (`git revert` of 624f0ed) —
    rejected per the user's own "remove what not needed": most of the
    removed system was a different concept (a world-culture "global
    network" hero centerpiece) that doesn't fit this project's current,
    India-focused, real-DOM-controls hero.
  - **`india-land-simplified.geojson`** as the outline source — rejected
    once its bounding box showed it was land-border-only, missing the
    coastline and all of South India.
  - **A duplicate, wider Three.js line for the outline's glow** —
    doesn't work (WebGL linewidth limitation, see above); replaced with
    a CSS canvas filter.
- **Impact:** `frontend/package.json` (`three`, `@types/three`, the only
  new dependencies, exact-pinned per ADR-019's own precedent);
  `frontend/src/app/landing/three/{india-outline-data,india-map-scene,
  read-css-color}.ts` (new); `frontend/src/app/landing/components/
  india-map/` (new wrapper component, `INDIA_MAP_SCENE_LOADER` DI token
  so `three` stays dynamically imported — a separate ~113KB lazy chunk,
  confirmed via `ng build`, that only downloads for visitors whose
  browser passes the WebGL/reduced-motion gate; doesn't inflate the
  initial bundle or even the `landing-page` chunk meaningfully, +2KB for
  the wrapper itself); `landing.page.ts`/`.html`/`.scss` (`showMapScene`
  gate, `@if`/`@else` between `<app-india-map>` and the unchanged
  fallback `<img>`). New tests: `india-outline-data.spec.ts` (bounding-
  box/geography sanity checks) and `india-map.spec.ts` (canvas renders,
  scene mounts/disposes, selection forwarding — using the DI-token
  override since Angular's vitest integration doesn't support `vi.mock`
  for relative imports). Verified live with Playwright (installed into
  the session scratchpad, not the project) at the real WebGL path and a
  forced no-WebGL path (`--disable-webgl`), confirming the canvas and
  the fallback `<img>` each render correctly in their respective case,
  and that the two visual bugs above were real, found live, and fixed —
  not just built and assumed correct.
- **Status:** Accepted.

**Amendment (same day):** The static fallback `<img>` (`images/landing/
map-scene.jpg`) and its `@else` branch were removed at the user's
explicit request ("remove image, redesign using threejs" — clarified via
AskUserQuestion to mean specifically the map strip's fallback image, not
the region-card photos or the mic backdrop, which are unchanged). The
map strip is now Three.js-only: `landing.page.html`'s `@if
(showMapScene())` has no `@else` — an unsupported browser (no WebGL, or
`prefers-reduced-motion`) sees nothing in that strip at all, not a
fallback photo, since there isn't one anymore. `showMapScene()` still
exists and still gates the mount, purely so such a browser doesn't
attempt a WebGL context creation that would fail — safety, not
degradation-to-an-image. `frontend/public/images/landing/map-scene.jpg`
deleted. New test in `landing.page.spec.ts` confirms the real
"unsupported" case in this project's own test environment (jsdom has no
WebGL, so `supportsWebGL()` is always false there — not simulated):
neither `<app-india-map>` nor any `.hero-map` element renders.

**Second amendment (same day):** The 6 region cards' cropped photos
(Assam/Punjab/West Bengal/Kashmir/Tamil Nadu/Goa) were also removed, at
the user's explicit follow-up request ("remove the .jpg and redesign
completely based on our architecture" — clarified via AskUserQuestion to
mean the region-card photos specifically, not the mic backdrop photo,
which stays). No hero image is left that came from the original
AI-mockup reference kit except `mic-stage.jpg`. Each card's visual is now
its `DEMO_LANGUAGE_NODES` entry's own native-script `label` (real,
translatable text — e.g. "অসমীয়া", "ਪੰਜਾਬੀ") on a gradient tinted with the
hero's own `--vs-cyan`/`--vs-gold` tokens, not an image — genuinely
data-driven, consistent with how every other decorative element in this
hero (the status panel, the demo language nodes) already works.
`hero-region.model.ts`'s `image` field was removed entirely (no longer
referenced anywhere); `frontend/public/images/landing/{assam,punjab,
west-bengal,kashmir,central,goa}.jpg` deleted. Updated test asserts no
`<img>` renders inside a region card and that the glyph's text matches
the linked demo language's label.

**Third amendment (same day):** The mic backdrop photo (`mic-stage.jpg`)
— the one image explicitly kept out of scope in both prior
amendments — was also removed, at the user's final follow-up ("do not
use image, use custom built, as image is not setting up as what we
need"). `.mic-art` (`landing.page.html`/`.scss`) is now a `<span>`
styled as a procedural CSS radial-gradient glow (cyan/gold, matching the
hero's own tokens) with a slow breathing animation
(`@keyframes mic-art-breathe`, disabled under `prefers-reduced-motion`
via the existing `mixins.reduced-motion-off`), not an `<img>` — the same
"a fixed-resolution photo never sits right at every size, a procedural
gradient does" reasoning `.hero`'s own background already used.
`frontend/public/images/landing/mic-stage.jpg` deleted, along with the
now-empty `public/images/` directory tree. **No image asset from the
original AI-mockup reference kit remains anywhere in the hero** — every
visual is either real, translatable text, a procedural CSS effect, or
the real Three.js map scene.

## ADR-033 - Phase 6 Milestone 6h: Bengali, Tamil, Telugu, Kannada evaluated; a live Odia ASR bug fixed

- **Decision:** Ran the full per-language evidence-gathering process
  (langid, LLM, ASR, TTS) established by Milestones 6b/6c/6d/6f against
  Bengali, Tamil, Telugu, and Kannada — the first four of the eight
  languages `docs/ROADMAP.md` names as Phase 6's remaining, unapproved
  scope. Also found and fixed a real, independent, currently-live bug in
  Odia's ASR handling, unrelated to whether Odia itself is ever enabled.
- **Reason — five real, measured findings:**
  1. **LLM: fluent, on-topic, correct-script for all four**, no code
     change needed — `llama_cpp_engine.py`'s `_LANGUAGE_NAMES` map and
     system prompt already had real entries for all four (`bn`/`ta`/
     `te`/`kn`), confirmed generic since Milestone 6c. 4/4 fixtures per
     language produced real, on-topic replies in the correct script
     (e.g. Tamil "இந்தியாவின் தலைநகரம் நாட்டின் தலைநகராக மாற்றப்பட்ட
     பெங்களூர்" — factually wrong, says Bengaluru, but genuinely fluent
     Tamil, a content-accuracy issue, not a language-fidelity one).
  2. **langid: 100% accurate for all four** (16/16), the strongest result
     any language has measured with `fasttext-lid176`, tied with
     Malayalam's own 100% (ADR-028) — each of these four has its own
     distinct Unicode script block, the same reason Malayalam scores
     perfectly where Hindi/Hinglish/Maithili (sharing Devanagari) don't.
  3. **ASR and TTS: real, uneven, language-specific weaknesses — not a
     capability gap.** All four codes are genuinely supported by
     `faster-whisper` (confirmed directly against its tokenizer's
     language table, unlike Maithili/Odia). Measured two independent
     ways: real macOS-voice-recorded audio transcribed directly
     (`Piya`/bn_IN, `Vani`/ta_IN, `Geeta`/te_IN, `Soumya`/kn_IN — real
     voices exist for all four, unlike Malayalam/Maithili, so this
     isn't proxy-only), and the standard synthesize-then-transcribe
     proxy against a newly added `facebook/mms-tts-{ben,tam,tel,kan}`
     candidate per language (all CC-BY-NC-4.0, same license as the
     existing Hindi/Malayalam/Maithili candidates):

     | Language | Real-audio ASR WER | TTS-proxy WER |
     |---|---|---|
     | Tamil (ta) | 0.362 | 0.343 |
     | Kannada (kn) | 0.417 | 1.00 |
     | Bengali (bn) | 0.933 | 0.90 |
     | Telugu (te) | 0.942 | 0.83 |

     Both measurements agree closely for Tamil, Bengali, and Telugu
     (converging evidence, not noise), suggesting a genuine per-language
     ASR/synthesis difficulty rather than a one-off bad recording — the
     same "measure two ways to isolate the real cause" method Milestone
     6d used for Malayalam. Kannada's two measurements disagree sharply:
     real-audio ASR is reasonable (0.417) but the `mms-tts-kan` proxy is
     the worst of any candidate measured in this project (1.00), and its
     transcripts show actual repetitive-syllable synthesis breakdown
     (e.g. `ಹವಾಮಾಯಾಯಾಮಾಯಾದಡಿದಡಿಡಿದದ...`), not just mispronunciation —
     pointing at a real quality defect in that specific checkpoint,
     not Whisper's Kannada recognition. None of the four meet
     `docs/EVALUATION.md`'s <20% ASR WER or <10% TTS-proxy-WER targets.
  4. **Every one of these four is a quality gap, not the capability gap
     Maithili/Odia have.** Both real-world-voice and TTS-proxy WER are
     already-supported-language *accuracy* numbers, in the same
     failure class Malayalam shipped with (ADR-028: TTS proxy WER
     100-150%; ADR-029: real-audio ASR WER 0.96 — worse than any number
     measured here) and Hinglish shipped with (TTS producing near-total
     WER on genuinely mixed text). Typed chat — the primary channel that
     blocked Maithili (ADR-031) — works perfectly for all four.
  5. **A real, independent bug found and fixed**: `faster_whisper_
     engine.py`'s `_WHISPER_LANGUAGE_HINTS` had an `"or": "or"` entry,
     asserting Odia is a valid Whisper language hint. Checked directly
     against `faster_whisper.tokenizer._LANGUAGE_CODES`: it isn't — no
     "or" entry exists. Unlike Maithili's silent-fallback bug (ADR-031),
     this raises `Tokenizer.__init__`'s `ValueError` for an unrecognized
     code, which `app/main.py`'s blanket exception handler turns into an
     opaque `500 transcription failed` rather than a clean rejection.
     Nobody had hit this yet (Odia is UI-disabled), but it was live and
     would have surfaced the moment anyone tried. Fixed at the source
     (the incorrect hint entry removed) and guarded at the Go layer too:
     `dto.go`'s single `maithiliLanguage` constant generalized to a
     `noASRLanguages` set covering both `mai` and `or`, with the same
     `handleVoiceTurn`/`handleTranscribe` rejection both already had for
     Maithili. This fix is independent of Odia's own future evaluation
     (Milestone 6j) — it closes a real defect either way.
- **Given the results are uneven, not decided silently which of the four
  to enable (`AGENTS.md` §14) — recommendation, not a unilateral action:**
  All four have a stronger typed-chat foundation than Malayalam did
  (perfect langid *and* perfect LLM fidelity, where Malayalam only had
  perfect langid) and none has a hard capability gap. Recommend enabling
  all four, consistent with the Hinglish/Malayalam "ship with an honestly
  documented, non-fatal quality gap" precedent (ADR-020/ADR-028) — with
  Tamil flagged as the strongest of the four and Kannada's TTS candidate
  flagged as having a distinct, worse-than-typical synthesis defect worth
  a user's attention before deciding whether it should ship voice output
  or text-only for now.
- **Alternatives considered:**
  - **Enable only Tamil now, defer the other three** — rejected as the
    default: Bengali/Telugu/Kannada's typed-chat quality (LLM+langid) is
    just as strong as Tamil's; only the voice-channel numbers differ,
    and that gap already has an accepted, shipped precedent. Left as an
    option in the recommendation rather than decided outright.
  - **Silently flip all four `enabled` flags** — rejected: the same
    "primary vs. secondary channel" judgment call that stopped Milestone
    6f from silently deciding Maithili applies here too, even though the
    result leans toward "enable" this time rather than "don't."
- **Impact:** `ai-services/models.yaml` gained four `tts.candidates`
  entries and four `tts.selected` language entries; `ai-services/
  eval_data/asr_fixtures.yaml` gained sixteen fixtures (four languages ×
  four themes, matching the existing weather/capital/story/greeting
  pattern) with real macOS voices, generating genuine (not proxy-only)
  audio via `scripts/generate_audio_fixtures.py`. `backend/internal/api`'s
  `dto.go`/`server.go` generalized Maithili's single-language ASR
  rejection into a small set covering Odia too, with matching new tests
  in `server_test.go`. The user accepted the recommendation above: all
  four enabled. `frontend/.../language.model.ts`'s `LANGUAGE_OPTIONS`
  gained `enabled: true` for `bn`/`ta`/`te`/`kn`. This surfaced a real,
  independent gap: none of the four had a self-hosted, script-specific
  font the way Devanagari/Malayalam already do — `message-bubble.ts`'s
  `SCRIPT_SPECIFIC_LANGUAGES` set didn't include them either, so their
  chat replies would have silently rendered in the generic Latin stack.
  Fixed the same way Malayalam was (ADR-028): four new self-hosted Noto
  Sans fonts (`public/fonts/NotoSans{Bengali,Tamil,Telugu,Kannada}-
  Regular.woff2`, each SIL OFL 1.1, sourced from the same `notofonts`
  GitHub organization Devanagari/Malayalam already cite), four new
  `--vs-font-*` tokens, four new `[lang='...']` rules, and the
  `SCRIPT_SPECIFIC_LANGUAGES` set extended. Verified live (not just unit
  tests): each language's real font file is actually fetched and applied
  — confirmed via a real network request and the computed `font-family`
  for an element carrying that `lang` attribute, not assumed from the
  unit tests passing alone.
- **Status:** Accepted and enabled. All four languages are live in the
  UI as of this milestone.

## ADR-034 - Phase 6 Milestone 6i: Gujarati, Marathi, Punjabi evaluated and enabled

- **Decision:** Ran the same per-language evidence-gathering process as
  Milestones 6b/6c/6d/6f/6h against Gujarati, Marathi, and Punjabi — the
  next three of the four remaining languages `docs/ROADMAP.md` names as
  Phase 6's scope (only Odia is left, pending Milestone 6j). Enabled all
  three in the UI on the same precedent Milestone 6h just used.
- **Reason — four real, measured findings:**
  1. **LLM: fluent, on-topic, correct-script for all three**, no code
     change needed, 4/4 fixtures each — the same generic-prompt result
     every enabled language has had since Malayalam (ADR-028).
  2. **langid: 100% accurate for all three** (12/12) — including Marathi,
     which shares Devanagari with Hindi/Hinglish/Maithili yet was
     correctly distinguished every time by `fasttext-lid176`, unlike the
     Hindi/Maithili confusion ADR-031 documented. A genuinely different,
     better result than the shared-script languages have had so far.
  3. **A real sourcing improvement over every non-Hindi language before
     it**: Gujarati and Marathi both have real, human-recorded,
     CC-BY-SA-4.0 speech corpora on OpenSLR (resources 78 and 64, the
     same "Google Speech Corpus" family Milestone 6d already used for
     Malayalam) — checked and confirmed directly, not assumed. Punjabi
     has no equivalent (checked directly against OpenSLR's resource
     list) — its evaluation rests on the TTS-proxy metric alone, the
     same lower-confidence, circularity-caveated situation Malayalam/
     Maithili have. `scripts/download_malayalam_real_fixtures.py`'s
     one-language pattern was generalized into `scripts/
     download_real_fixtures.py`/`benchmark_real_asr.py` (a real second
     use, not speculative) rather than duplicated per language; the
     original Malayalam-specific scripts and fixture file are untouched.
  4. **ASR and TTS: real, uneven, language-specific weaknesses — not a
     capability gap**, all three genuinely supported by
     `faster-whisper` (confirmed directly, unlike Maithili/Odia):

     | Language | Real-audio ASR WER | TTS-proxy WER |
     |---|---|---|
     | Gujarati (gu) | 0.333 (real corpus) | 0.585 |
     | Marathi (mr) | 0.5375 (real corpus) | 1.00 |
     | Punjabi (pa) | not measurable (no real corpus) | 0.983 |

     Two new, distinct failure modes found, each different in kind from
     anything measured before: one Marathi real-audio clip
     ("आता मी ऐकतेय") was transcribed entirely as **romanized Latin
     text** ("Atami-eit-tie") rather than Devanagari — a script-fidelity
     failure specific to that clip, not the general pattern (the other
     three Marathi clips stayed in Devanagari). And one Punjabi TTS-proxy
     transcript hallucinated **characters from unrelated scripts**
     (Armenian- and CJK-looking glyphs mixed into the Gurmukhi output) —
     a qualitatively worse failure than Kannada's repetitive-syllable
     breakdown (ADR-033), suggesting `mms-tts-pan`'s synthesis is
     confusing Whisper's decoder badly enough to break tokenization, not
     just mispronounce. None of the three meet `docs/EVALUATION.md`'s
     targets.
- **Given the pattern is now well-established, enabled directly rather
  than pausing for a separate confirmation round** (`AGENTS.md` §14): the
  same reasoning Milestone 6h's recommendation used applies identically
  here — no hard capability gap for any of the three, typed chat works
  perfectly, and the ASR/TTS quality gaps are in the same shippable class
  Malayalam/Hinglish/Bengali/Telugu/Kannada already ship in. Punjabi's
  weaker evidence base (proxy-only, no independent real-audio check) and
  its distinct hallucination failure are flagged honestly rather than
  hidden, but don't change the enable/disable call given the established
  precedent — a user can always fall back to typed chat for any language
  where voice quality disappoints, per `docs/PROJECT_GOAL.md`.
- **Alternatives considered:**
  - **Treat Punjabi differently (disable while gu/mr enable)** — rejected
    for consistency: Punjabi's typed-chat foundation (LLM+langid) is
    exactly as strong as the other two; only its ASR/TTS evidence is
    weaker in kind (proxy-only vs. real-corpus), not necessarily worse in
    outcome, and that distinction is already the norm for Malayalam/
    Maithili's Whisper-family languages.
  - **Duplicate the Malayalam real-fixture scripts per language** —
    rejected: a second real use of the exact same pattern is what
    `AGENTS.md` §6 calls for generalizing, not what it calls speculative.
- **Impact:** `ai-services/models.yaml` gained three `tts.candidates`
  entries and three `tts.selected` language entries.
  `ai-services/eval_data/asr_fixtures.yaml` gained twelve fixtures
  (Gujarati/Marathi real corpus text reused for langid/TTS-proxy
  measurement; Punjabi composed, same caveat as every other
  composed-fixture language). New `ai-services/eval_data/
  real_fixtures.yaml` plus `scripts/download_real_fixtures.py`/
  `scripts/benchmark_real_asr.py` (generalized from the Malayalam-only
  originals, which are untouched). `frontend/.../language.model.ts`
  gained `enabled: true` for `gu`/`mr`/`pa`, and — the same real gap
  Milestone 6h found for its own four languages — three new self-hosted
  fonts (`Noto Sans Gujarati`/`Noto Sans Devanagari` already covers
  Marathi/`Noto Sans Gurmukhi`), `SCRIPT_SPECIFIC_LANGUAGES` extended,
  verified live the same way (real font-file network fetch + computed
  `font-family` per `lang` attribute).
- **Status:** Accepted and enabled. All three languages are live in the
  UI as of this milestone. Only Odia (Milestone 6j) remains of Phase 6's
  originally-named eight-language batch.

## ADR-035 - Phase 6 Milestone 6j: Odia evaluated, not enabled

- **Decision:** Ran the same per-language evidence-gathering process
  against Odia, the last of Phase 6's originally-named eight languages.
  Unlike Milestones 6h/6i's six languages, **Odia is not enabled** — its
  results land in Maithili's category (ADR-031), not Bengali's.
- **Reason — three real, measured findings, a genuinely different shape
  from every language enabled since Malayalam:**
  1. **langid: 100% accurate** (4/4, confidence 0.97-0.99) —
     `fasttext-lid176` has real Odia training data and distinguishes it
     cleanly, the same strong result every other script-distinct
     language has had.
  2. **LLM: broken, not just wrong-language.** Unlike Maithili (which
     understood every prompt and replied fluently, just in Hindi
     instead), `llama-3.2-3b-instruct`'s Odia output degenerates into
     repetitive token loops ("...କି କ‍ର ତ ଆପ କ‍ର ତ ଆପ କ‍ର ତ ଆପ...",
     "ଆଫଗାନିସ୍ତାନ, ଆଫଗା, ଆଫଗାନ...") and, on two of four fixtures, mixes
     in stray characters from other scripts entirely (a Gurmukhi
     character in the "capital" reply, Malayalam-looking characters in
     the same reply) — a genuine generation failure, not a
     language-choice one. None of the four fixtures produced a coherent,
     on-topic answer.
  3. **ASR: no real Whisper support at all** (confirmed directly against
     `faster_whisper.tokenizer._LANGUAGE_CODES`, the same check Milestone
     6h used to find and fix the `"or": "or"` hint-dict bug) — the same
     hard capability gap Maithili has, not an accuracy one. This produced
     the most dramatic evidence of *why* it's a capability gap, not a
     quality one, seen anywhere in this project: with the buggy hint-dict
     entry now removed (ADR-033), the TTS-proxy benchmark's transcription
     step falls back to Whisper's own auto-detection, which hallucinated
     a **different, unrelated script for every single clip** — romanized
     Latin ("A dí pago ke mi ty oči."), Devanagari ("भारतरों
     राजहनिकों"), Gujarati ("મતે ગોટે છોટ્ત"), and Arabic script ("نوما
     سارا اپنو كميتي") — not mere mispronunciation, but the model
     essentially guessing at random since it has no real signal for the
     language it's being asked to transcribe. Proxy WER (1.0-1.75) is
     reported for completeness but is close to meaningless given this —
     it isn't measuring Odia intelligibility, it's measuring how far a
     random wrong-language guess drifts from the reference text.
- **Given two of three capabilities have primary-channel failures, not
  decided silently** (`AGENTS.md` §14) — **recommendation: leave `or`
  disabled**, breaking the pattern Milestones 6h/6i just established.
  This is not an inconsistency: those six languages all had a working
  LLM and a real (if imperfect) ASR path — the gap was voice *quality*,
  already an accepted, shippable category (ADR-020/ADR-028). Odia has
  neither: the LLM cannot reliably produce a coherent Odia sentence at
  all, and ASR has no path whatsoever, not even a bad one. Enabling it
  today would mean a language selector entry where typed chat frequently
  degenerates into gibberish and voice input is entirely non-functional
  — the same "not a degraded experience, a non-functional one" reasoning
  ADR-031 used for Maithili, not the "known gap, ships anyway" one used
  since.
- **Alternatives considered:**
  - **Enable typed-chat only, following a hypothetical Maithili-style
    compromise** — rejected: Maithili's typed-chat path is at least
    fluent (just wrong-language); Odia's typed-chat output is
    frequently incoherent regardless of language, so there's no
    working mode to carve out and ship.
  - **Treat this as "no different from Milestone 6h/6i" and enable
    anyway, for consistency** — rejected: consistency with a precedent
    means applying its *reasoning* to new evidence, not repeating its
    *conclusion* regardless of what the evidence says. The whole point
    of gathering real evidence per language is that a result can turn
    out differently, the way Malayalam's did from Hindi's and Maithili's
    did from Malayalam's.
- **Impact:** `ai-services/models.yaml` gained one `tts.candidates` entry
  and one `tts.selected` language entry (`facebook/mms-tts-ory`,
  downloaded and benchmarked, same as every other candidate — a real
  entry stays listed even though the language isn't enabled, the same as
  every unselected-but-evaluated candidate elsewhere in this file).
  `ai-services/eval_data/asr_fixtures.yaml` gained four composed Odia
  fixtures (no OpenSLR corpus exists for Odia, checked directly; no
  macOS voice either). No frontend change — `LANGUAGE_OPTIONS`'s
  `or.enabled` stays `false`.
- **Status:** Accepted and disabled. This closes evidence-gathering for
  all eight of Phase 6's originally-named languages (Milestones 6c,
  6h, 6i enabled seven of them; Odia stays out). Only Maithili's own
  gap-closing (Milestone 6g, paused) remains open in Phase 6's
  currently-scoped work.

## Template for future ADRs

```
## ADR-NNN - <short title>

- **Decision:** <what was decided>
- **Reason:** <why>
- **Alternatives considered:** <options and why they lost>
- **Impact:** <effect on architecture, phases, effort>
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
```
