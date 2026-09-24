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

## Template for future ADRs

```
## ADR-NNN - <short title>

- **Decision:** <what was decided>
- **Reason:** <why>
- **Alternatives considered:** <options and why they lost>
- **Impact:** <effect on architecture, phases, effort>
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
```
