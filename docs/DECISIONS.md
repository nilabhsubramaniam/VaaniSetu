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

## Template for future ADRs

```
## ADR-NNN - <short title>

- **Decision:** <what was decided>
- **Reason:** <why>
- **Alternatives considered:** <options and why they lost>
- **Impact:** <effect on architecture, phases, effort>
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
```
