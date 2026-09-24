# ROADMAP.md

Milestone-based plan for VaaniSetu.

- Exactly one phase is active at a time. `docs/CURRENT_STATE.md` names it.
- Phases are done in order. Later phases must not be implemented early.
- The agent never advances phases automatically. The user controls progression.
- A phase is complete only when its **Definition of Done** is met, its
  testing / evaluation passes, and `docs/CURRENT_STATE.md` is updated.

**Status legend:** `NOT STARTED` | `IN PROGRESS` | `DONE`

| Phase | Name | Status |
|-------|------|--------|
| 0 | Project Foundation | DONE |
| 1 | UI Foundation | DONE |
| 2 | Local LLM | DONE |
| 3 | Speech-to-Text | DONE |
| 4 | Text-to-Speech | IN PROGRESS |
| 5 | End-to-End Voice MVP | NOT STARTED |
| 6 | Indian Language Support | NOT STARTED |
| 7 | RAG | NOT STARTED |
| 8 | Dataset Pipeline | NOT STARTED |
| 9 | Evaluation & Benchmarking | NOT STARTED |
| 10 | LoRA / QLoRA Fine-Tuning | NOT STARTED |
| 11 | Real-Time Streaming | NOT STARTED |
| 12 | Production Hardening | NOT STARTED |

> Note on ordering: lightweight, phase-scoped benchmarking happens **within**
> Phases 2, 3, and 4 (each selects its model by measurement). Phase 9 builds the
> durable, automated evaluation harness and fills coverage gaps. Phase 10
> depends on Phase 9.

---

## Phase 0 - Project Foundation

**Status:** DONE

- **Objective:** Establish the persistent documentation and AI-agent operating
  context so future work does not depend on chat history.
- **Scope:** `AGENTS.md` and the `docs/` set (`PROJECT_GOAL`, `ARCHITECTURE`,
  `ROADMAP`, `DECISIONS`, `CURRENT_STATE`, `DEVELOPMENT`, `EVALUATION`).
- **Dependencies:** None.
- **Expected result:** A consistent documentation set that defines the project,
  its architecture, its decisions, its roadmap, and how agents must work.
- **Testing / evaluation:** Cross-document consistency check - roadmap and
  current-state agree, architecture does not contradict `AGENTS.md`, no future
  phase marked current.
- **Definition of Done:** All eight files exist, are internally consistent, and
  name Phase 1 as the first implementation milestone.
- **Explicitly deferred:** Any application code. Repository scaffolding
  (`frontend/`, `backend/`, `ai-services/`, `proto/`) beyond `docs/`.

---

## Phase 1 - UI Foundation

**Status:** DONE

- **Objective:** Build the Angular application shell and core conversation UI
  using mock / local data only.
- **Scope:**
  - Angular workspace (TypeScript + SCSS) under `frontend/`.
  - App shell, routing, layout, theming.
  - Conversation view: turn list, user / assistant turns, per-turn language
    badge, input affordance (push-to-talk button and / or text box) driven by
    **mock data**.
  - Settings screen scaffold: language preference, model selection placeholder,
    privacy toggles (non-functional).
  - A data-access service interface with a mock implementation, so a real
    backend client can be substituted later without UI changes.
  - Lint, format, unit / component test setup.
- **Dependencies:** Phase 0.
- **Expected result:** A runnable Angular app showing a believable conversation
  UI with fake data, no network calls.
- **Testing / evaluation:** Component tests for the conversation view and
  settings scaffold; lint, format, type-check, build all green; manual check
  that no real service is contacted.
- **Definition of Done:** App builds and runs locally; conversation UI renders
  mock turns; data access is behind an interface with a mock implementation;
  tests and checks pass; `docs/CURRENT_STATE.md` and `docs/DEVELOPMENT.md`
  updated with the real workspace layout and commands.
- **Explicitly deferred:** Real LLM, STT, TTS, RAG, database, Go API,
  WebSocket / streaming, audio capture wired to a backend.

---

## Phase 2 - Local LLM

**Status:** DONE — Milestone 2a (Go backend against `FakeLLMClient`) and
Milestone 2b (Python `llm` service, model benchmark + selection ADR, real
end-to-end wiring) are both complete. See `docs/CURRENT_STATE.md` and
`docs/DECISIONS.md` ADR-015/ADR-016.

- **Objective:** Run a local open-source LLM as a Python service and let the
  UI hold a **text** conversation through the Go backend.
- **Scope:** Python LLM service behind an `llm` capability interface; model
  registry entry; Go backend skeleton with a chat endpoint and session / turn
  persistence in PostgreSQL; Angular wired from mock data to the real endpoint
  for text turns; Docker services for backend, Python, PostgreSQL.
- **Dependencies:** Phase 1.
- **Expected result:** Type a message in Hindi or Hinglish, get a locally
  generated reply, persisted as a turn.
- **Testing / evaluation:** Backend unit + integration tests; LLM service
  contract tests; a lightweight benchmark of 2-3 candidate models on the
  target hardware for latency, memory, and Hindi / Hinglish quality, recorded
  as the basis for the model selection ADR.
- **Definition of Done:** Text chat works end to end locally; a model is
  selected with recorded benchmark evidence and an ADR in `docs/DECISIONS.md`;
  the model is swappable by config; tests pass; docs updated.
- **Explicitly deferred:** Any audio. Streaming token output. RAG.

---

## Phase 3 - Speech-to-Text

**Status:** DONE — Milestone 3a (real browser audio capture, Go
transcription endpoint, script tagging) and Milestone 3b (Python `asr`
capability, WER benchmark + selection ADR, real end-to-end wiring) are
both complete; speech-to-transcript works for Hindi and English within
`docs/EVALUATION.md`'s provisional WER target. **Known gap, not blocking:**
Hinglish (code-switched) transcription accuracy is meaningfully below
`docs/EVALUATION.md`'s "within +10pts of monolingual Hindi WER" target for
every benchmarked candidate — a genuine Whisper-family limitation, not an
integration bug (see `docs/DECISIONS.md` ADR-018) — flagged for Phase 6
(Indian Language Support), which owns code-switching quality. See
`docs/CURRENT_STATE.md` and `docs/DECISIONS.md` ADR-017/ADR-018.

- **Objective:** Add microphone capture and local transcription so a user can
  **speak** their turn.
- **Scope:** Browser audio capture in Angular; audio transport to Go; Python
  ASR service behind an `asr` capability interface; VAD / endpointing as needed
  for turn capture; language + script tag stored per turn.
  - Resolved in Milestone 3a (`docs/DECISIONS.md` ADR-017): endpointing is
    manual (tap to start, tap again to stop), not an automatic VAD model —
    sufficient for this phase's turn capture. An automatic VAD model is
    introduced only in Phase 11, to drive barge-in interruption; no phase
    before that builds one as its own benchmarked capability the way `asr`,
    `llm`, and `tts` each are.
- **Dependencies:** Phase 2.
- **Expected result:** Speak in Hindi or Hinglish, see an accurate transcript,
  get a text (or existing) reply.
- **Testing / evaluation:** ASR contract tests; WER / CER on a small fixed
  Hindi + Hinglish audio set per `docs/EVALUATION.md`; candidate-model
  benchmark on target hardware; results recorded, model selected via ADR.
- **Definition of Done:** Speech -> transcript works locally within the ASR
  targets in `docs/EVALUATION.md`; model swappable by config; tests and
  evaluation recorded; docs updated.
- **Explicitly deferred:** Spoken output. Real-time partial transcripts as a
  streamed UI experience (basic partials acceptable; full streaming UX is
  Phase 11).

---

## Phase 4 - Text-to-Speech

**Status:** IN PROGRESS — Milestone 4a (Go `tts` capability boundary
against `FakeTTSClient`, real browser audio playback wired into the
conversation flow) is complete. Milestone 4b (Python `tts` capability,
model benchmark + selection ADR, real end-to-end wiring) has not started.
See `docs/CURRENT_STATE.md` and `docs/DECISIONS.md` ADR-020.

- **Objective:** Speak the assistant's reply aloud with a local TTS model.
- **Scope:** Python TTS service behind a `tts` capability interface; audio
  transport back through Go to Angular; browser playback; per-language voice
  configuration in the model registry.
- **Dependencies:** Phase 2 (Phase 3 recommended but not strictly required).
- **Expected result:** The assistant's Hindi / Hinglish reply is heard as
  natural speech.
- **Testing / evaluation:** TTS contract tests; intelligibility / pronunciation
  / naturalness (MOS-proxy) and real-time factor per `docs/EVALUATION.md`;
  candidate-model benchmark; model selected via ADR.
- **Definition of Done:** Reply text -> audio playback works locally within the
  TTS targets; model swappable by config; evaluation recorded; docs updated.
- **Explicitly deferred:** Sentence-level streaming synthesis (Phase 11).
  Voice cloning / personalization.

---

## Phase 5 - End-to-End Voice MVP

**Status:** NOT STARTED

- **Objective:** Connect the stages into one working spoken loop for Hindi and
  Hinglish, single user, single machine, no RAG.
- **Scope:** Go turn orchestrator (state machine: listen -> transcribe ->
  select language -> think -> speak); wiring ASR + LLM + TTS into that single
  loop; end-to-end latency measurement; `docker compose up` brings up the
  whole stack.
  - "Listen" uses the manual endpointing already built in Phase 3 Milestone
    3a (tap to start, tap again to stop — ADR-017) — automatic Voice
    Activity Detection is not built here. A VAD model is only introduced in
    Phase 11, where it drives barge-in interruption; Phase 5's loop does not
    need or assume one exists.
  - "Select language" uses the manual language preference already built in
    Phase 1 (`SettingsStore`) — this phase does not add automatic language
    identification. A dedicated language-detection service is Phase 6's
    scope; Phase 5's orchestrator is wired to call it once Phase 6 exists,
    but does not require it.
- **Dependencies:** Phases 2, 3, 4.
- **Expected result:** A user holds a spoken Hindi / Hinglish conversation
  entirely offline.
- **Testing / evaluation:** End-to-end tests with recorded audio fixtures
  asserting transcript, reply-language fidelity, and a latency budget; verified
  no network egress from the AI service containers.
- **Definition of Done:** Offline spoken conversation works for Hindi and
  Hinglish; end-to-end latency and no-egress checks pass; orchestrator covered
  by tests; docs updated; `docs/CURRENT_STATE.md` reflects MVP reached.
- **Explicitly deferred:** More languages. RAG. Streaming. Barge-in. Multi-user.
  Automatic Voice Activity Detection (Phase 11). Automatic language
  identification (Phase 6) — the manual selector remains authoritative
  through this phase.

---

## Phase 6 - Indian Language Support

**Status:** NOT STARTED

- **Objective:** Extend the working loop to the long-term language set, one
  language at a time, each gated on meeting its quality targets.
- **Scope:** Dedicated language-detection service integrated into the turn
  loop; per-language ASR / TTS / LLM configuration in the model registry;
  per-language UI enablement in settings; script-aware text handling.
- **Dependencies:** Phase 5; Phase 9 harness (or its per-language subset)
  available to validate each language.
- **Expected result:** Each enabled language works end to end at target
  quality.
- **Testing / evaluation:** Per-language WER / CER, language-ID accuracy
  (including Hinglish confusion matrix), TTS MOS-proxy, end-to-end task
  success, per `docs/EVALUATION.md`.
- **Definition of Done:** Every language exposed in the UI has passed its
  `docs/EVALUATION.md` thresholds and has recorded results; languages that fail
  stay disabled; docs updated.
- **Explicitly deferred:** Fine-tuning to fix weak languages (Phase 10).

---

## Phase 7 - RAG

**Status:** NOT STARTED

- **Objective:** Let the assistant answer from user-provided documents,
  grounded and cross-lingual.
- **Scope:** Document upload API in Go; async chunking + embedding jobs in
  Python; `pgvector` schema and HNSW index; retrieval + rerank; prompt
  assembly with grounding passages; answer in the user's turn language
  regardless of source-passage language.
- **Dependencies:** Phase 5.
- **Expected result:** Upload a document, ask about it by voice, hear a grounded
  answer in your language.
- **Testing / evaluation:** Retrieval recall, grounding / faithfulness, answer
  correctness per `docs/EVALUATION.md`; embedding-model benchmark; selections
  via ADR.
- **Definition of Done:** Voice Q&A over an uploaded document meets the RAG
  targets; ingestion does not block the voice loop; tests and evaluation
  recorded; docs updated.
- **Explicitly deferred:** Tools / actions. Web retrieval. Multi-user document
  isolation.

---

## Phase 8 - Dataset Pipeline

**Status:** NOT STARTED

- **Objective:** Build a reproducible pipeline to curate data for evaluation and
  later fine-tuning.
- **Scope:** Ingestion, dedupe, language / script validation, PII scrubbing,
  stratified train / val / test splits, versioning of dataset artifacts outside
  the main git repo; explicit consent-flag gating for any user-derived data.
- **Dependencies:** Phase 6 (real language coverage to target); benefits from
  Phase 9.
- **Expected result:** Versioned, consented, PII-scrubbed datasets ready for
  evaluation and fine-tuning.
- **Testing / evaluation:** Pipeline unit tests; validation that PII scrub and
  consent gating cannot be bypassed; dataset statistics recorded.
- **Definition of Done:** Pipeline produces versioned datasets reproducibly;
  privacy gates verified; docs updated.
- **Explicitly deferred:** Actually running fine-tuning (Phase 10).

---

## Phase 9 - Evaluation & Benchmarking

**Status:** NOT STARTED

- **Objective:** Turn the metrics in `docs/EVALUATION.md` into an automated,
  repeatable harness that tracks quality over time.
- **Scope:** Evaluation module for ASR, language ID, LLM, RAG, TTS, end-to-end,
  and hardware metrics; fixed evaluation sets; result storage; a run triggered
  on model-registry changes.
- **Dependencies:** Phase 5 (something to evaluate end to end); ideally Phase 6.
- **Expected result:** One command produces a full quality + hardware report;
  results are stored and comparable across runs.
- **Testing / evaluation:** The harness is tested against known-good fixtures;
  metric calculations have unit tests.
- **Definition of Done:** Harness runs green, produces stored reports, and is
  wired to run on registry changes; docs updated.
- **Explicitly deferred:** Fine-tuning (Phase 10).

---

## Phase 10 - LoRA / QLoRA Fine-Tuning

**Status:** NOT STARTED

- **Objective:** Close specific, evaluation-proven quality gaps with parameter-
  efficient fine-tuning.
- **Scope:** Offline QLoRA / LoRA training jobs in Python; adapter versioning in
  the model store; before / after evaluation reports; model registry updated to
  load adapters.
- **Dependencies:** Phase 8 (curated data) and Phase 9 (baseline scores proving
  a gap).
- **Expected result:** Versioned adapters that measurably improve a weak
  language or domain with no regression elsewhere.
- **Testing / evaluation:** Each adapter ships with a paired evaluation report
  showing improvement on its target metric and no significant regression on
  others.
- **Definition of Done:** At least one adapter improves its target metric with
  recorded evidence; adapters are versioned and loadable by config; an ADR
  records the fine-tuning decision; docs updated.
- **Explicitly deferred:** Full model retraining. Merging adapters into base
  weights for redistribution without a license review.

---

## Phase 11 - Real-Time Streaming

**Status:** NOT STARTED

- **Objective:** Make the voice loop feel real-time: streamed partial
  transcripts, streamed LLM tokens, sentence-level streamed TTS, and barge-in.
- **Scope:** WebSocket / streaming transport Angular <-> Go; client-streaming
  audio to ASR; server-streaming transcripts and tokens; sentence-boundary
  flush from LLM to TTS; VAD-driven interruption that cancels downstream work.
- **Dependencies:** Phase 5 (working non-streaming loop).
- **Expected result:** First audio starts while the model is still generating;
  the user can interrupt the assistant mid-reply.
- **Testing / evaluation:** First-audio latency (p50 / p95), interruption
  handling correctness, script-aware sentence splitting tests, per
  `docs/EVALUATION.md`.
- **Definition of Done:** Streaming loop meets its latency targets; barge-in
  reliably cancels playback and starts a new turn; tests pass; docs updated.
- **Explicitly deferred:** Multi-user streaming isolation.

---

## Phase 12 - Production Hardening

**Status:** NOT STARTED

- **Objective:** Make the local install trustworthy and maintainable for
  non-technical users.
- **Scope:** Signed desktop packaging that manages the compose stack; decoupled
  model-update mechanism with checksum verification; local-only, opt-in
  diagnostics; a user-facing privacy dashboard surfacing consent state and
  network activity; full security review.
- **Dependencies:** MVP-plus feature set stable (through at least Phase 7);
  Phase 9 harness green across layers.
- **Expected result:** A clean install completes without a terminal; the
  privacy dashboard lets a user verify the no-egress claim.
- **Testing / evaluation:** Full test suite green across all layers; security
  review sign-off recorded; install tested on each supported OS.
- **Definition of Done:** Signed installers build; update + checksum flow works;
  privacy dashboard accurate; security review recorded; docs updated.
- **Explicitly deferred:** A hosted / cloud offering (separate product track).
