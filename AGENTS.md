# AGENTS.md

Operating contract for every AI coding agent that works on **VaaniSetu**.

This file is the highest authority for *how* work is done. Read it in full at
the start of every task. Nothing in a single conversation overrides it.

---

## 1. Project identity

- **Name:** VaaniSetu (वाणी *voice* + सेतु *bridge*)
- **Tagline:** A Local AI Voice Bridge for Indian Languages
- **Type:** Privacy-first, local-first AI voice assistant for Indian languages
  and Hinglish, built on open-source models.
- **Stack direction:** Angular + TypeScript + SCSS (frontend), Go (backend API),
  Python (AI/ML service), PostgreSQL + pgvector (data + vector search), Docker
  (containerization).

## 2. Project goal

Let a user hold a natural spoken conversation with an assistant that runs
entirely on their own machine, in Indian languages and Hinglish, with no audio
or transcript required to leave the device.

Full statement of intent: `docs/PROJECT_GOAL.md`.

Long-term voice pipeline:

```
Microphone -> VAD -> Speech-to-Text -> Language Detection -> Local LLM
-> RAG / Tools -> Text-to-Speech -> Speaker
```

- **MVP language focus:** Hindi, Hinglish.
- **Long-term languages:** Bengali, Gujarati, Marathi, Tamil, Telugu, Kannada,
  Malayalam, Punjabi, Odia.

## 3. Source-of-truth hierarchy

When two sources disagree, the lower number wins **for its own domain**. Do not
silently pick one: state the conflict and, if it blocks progress, ask.

| # | Source | Answers |
|---|--------|---------|
| 1 | `AGENTS.md` | How the agent must work |
| 2 | `docs/PROJECT_GOAL.md` | Why the project exists |
| 3 | `docs/ARCHITECTURE.md` | How the system is designed |
| 4 | `docs/DECISIONS.md` | Why important technical decisions were made |
| 5 | `docs/ROADMAP.md` | What to build and in what order |
| 6 | `docs/CURRENT_STATE.md` | What is happening right now |
| 7 | `docs/DEVELOPMENT.md` | How development should be performed |
| 8 | `docs/EVALUATION.md` | How quality will be measured |
| 9 | Existing source code | Current implementation reality |
| 10 | Current user task | The specific approved work |

Domain rule: architecture questions are settled by `ARCHITECTURE.md`, not by a
roadmap aside; process questions are settled by `AGENTS.md`, not by code.

## 4. Development principles

Develop **incrementally**. One milestone at a time, planned and approved before
implementation.

**Do NOT:**

- Build the entire system at once.
- Train models from scratch.
- Fine-tune a model before a pretrained baseline exists and has been evaluated.
- Introduce unnecessary dependencies or frameworks.
- Create duplicate components, services, or utilities.
- Refactor unrelated code.
- Implement future milestones early because the vision mentions them.
- Commit model binaries or weights.
- Commit secrets, credentials, or API keys.
- Couple the system permanently to one AI model.
- Make an architectural decision silently.

**Prefer:**

- Minimal changes.
- Reusable components and clear separation of concerns.
- Testable code.
- Replaceable AI models behind stable interfaces.
- Local development and privacy.
- Measurable evaluation.
- Recording important decisions in `docs/DECISIONS.md`.

## 5. Milestone discipline

- The roadmap in `docs/ROADMAP.md` is the ordered plan. `docs/CURRENT_STATE.md`
  names the single active phase.
- Work only on the current phase. If a request belongs to a later phase,
  explain the dependency instead of implementing it.
- **Never** advance to the next milestone automatically. Only the user moves the
  project between phases.
- A phase is finished only when its Definition of Done in `ROADMAP.md` is met,
  its tests/evaluations pass, and `CURRENT_STATE.md` has been updated.

## 6. Coding rules

- Inspect existing code before writing new code; reuse what exists.
- Make the smallest reasonable change that satisfies the approved scope.
- No speculative abstraction. Add an interface when a second implementation is
  real, not anticipated.
- Keep model-specific code isolated behind an interface so an engine swap is a
  configuration change, not a rewrite.
- Configuration comes from the environment, not hardcoded constants.
- Match the conventions in `docs/DEVELOPMENT.md`. If a convention is missing,
  propose it in that file rather than inventing an undocumented one.
- Preserve existing behavior unless changing it is the approved task.

## 7. Architecture rules

- Respect the boundaries in `docs/ARCHITECTURE.md`: Angular renders and captures,
  Go orchestrates and persists, Python runs inference. Go never imports a model.
  Angular never calls the Python service directly.
- Services communicate over defined contracts (HTTP/gRPC + a shared `proto/` or
  schema directory), never shared in-process state.
- Before introducing a new framework, library, model, datastore, service, or
  architectural pattern, check whether the architecture already covers it.
- To replace an existing decision, document in `docs/DECISIONS.md`: why the
  current approach is insufficient, the proposed alternative, advantages and
  disadvantages, impact on future milestones, and whether it becomes an ADR.

## 8. AI/ML rules

- No training foundation models from scratch. Ever.
- No fine-tuning before a pretrained baseline is running and has been evaluated
  against `docs/EVALUATION.md` metrics.
- Model selection is evidence-based. Candidate models may be listed, but none is
  "selected" until benchmarked on the target hardware for latency, memory, and
  Indian-language / Hinglish / code-switching quality, and its license has been
  checked for the project's distribution intent.
- Do not download large model weights until a phase actually requires them.
- Use **RAG** for knowledge retrieval. Use **fine-tuning** only for behavior,
  language adaptation, formatting, or domain adaptation, and only when
  evaluation shows it is required.
- Keep every model replaceable: engine code lives behind an interface, model
  identity lives in configuration.

## 9. Testing requirements

- Every implementation task ships with tests appropriate to its layer
  (unit for logic, component for UI, integration for cross-service behavior).
- A phase with an evaluation requirement in `ROADMAP.md` is not done until that
  evaluation has been run and its result recorded.
- Do not report a task complete while its tests fail. Report the failure with
  output instead.
- Run the project's lint, format, type-check, and build steps for the affected
  workspace before declaring done.

## 10. Security and privacy rules

- The voice loop must not require network egress. Cloud is opt-in, never a
  silent fallback.
- Never commit secrets, credentials, API keys, or model binaries. Use
  environment variables and a git-ignored local model directory.
- Raw audio is discarded after transcription by default; retention is an
  explicit user opt-in.
- No third-party telemetry or analytics in the voice path.
- Treat user transcripts and documents as private data: no logging of content
  at info level, no transmission off-device without explicit consent.

## 11. Documentation rules

- The eight files in section 3 are the persistent documentation set. Do not
  create additional documentation files to restate what they already cover.
- Update documentation **in the same task** as the change it describes:
  - New architectural decision -> `docs/DECISIONS.md`.
  - Milestone boundary crossed -> `docs/CURRENT_STATE.md` and `ROADMAP.md`
    status.
  - New convention, command, or tool -> `docs/DEVELOPMENT.md`.
  - New or changed metric / target -> `docs/EVALUATION.md`.
- Keep `docs/CURRENT_STATE.md` short.
- Mark anything undecided as `TBD` rather than guessing.

## 12. Git / change rules

- Do not commit or push unless the user asks.
- If asked to commit while on the default branch, create a branch first.
- One logical change per commit; message explains why, not just what.
- Do not add AI attribution/co-author lines to commits or PRs.
- Never commit: `.env` files, credentials, model weights (`*.gguf`, `*.pt`,
  `*.safetensors`, `*.onnx` over trivial size), datasets, build output.

## 13. Definition of Done

A task is done when **all** of the following hold:

1. Scope matches exactly what the user approved. No more, no less.
2. Code follows `docs/DEVELOPMENT.md` conventions.
3. Tests for the change exist and pass.
4. Lint, format, type-check, and build pass for the affected workspace.
5. Any required evaluation for the phase has been run and recorded.
6. Documentation affected by the change has been updated in the same task.
7. The diff has been reviewed for unrelated or unnecessary changes.
8. Existing functionality still works.
9. A report has been given: what changed, files changed, tests run, issues
   found, remaining work, recommended next milestone.
10. The agent has stopped and is waiting for the user. It has **not** started
    the next task or milestone.

## 14. Conflict handling

If a request conflicts with `AGENTS.md`, `docs/ARCHITECTURE.md`, an established
decision in `docs/DECISIONS.md`, or the current milestone:

1. Do not silently follow it.
2. State clearly: **"Conflict detected."**
3. Explain the conflicting rule or decision and why the request conflicts.
4. Give the options.
5. Give a recommendation.
6. Wait for the user's decision.

If the user reaffirms the request after the explanation, treat that as the
decision, record it in `docs/DECISIONS.md` if it is architectural, and proceed.

## 15. Agent workflow

Before every task:

1. Read `AGENTS.md`.
2. Read the relevant project documentation for the task.
3. Read `docs/CURRENT_STATE.md`.
4. Identify the current milestone.
5. Inspect the existing implementation.
6. Determine whether the requested task belongs to the current milestone.
7. Create a plan before implementation.
8. Wait for explicit user approval before implementation.
9. Implement only the approved scope.
10. Test the implementation.
11. Update project documentation / state when necessary.
12. Stop after the approved task.

The agent MUST NOT automatically continue to the next milestone. The user
controls milestone progression.

### Plan format

A plan presented for approval contains: current state, objective, scope,
files/modules affected, implementation approach, dependencies, risks, testing
strategy, acceptance criteria, and future impact.

### Priority order

CORRECTNESS -> MAINTAINABILITY -> MINIMAL CHANGES -> TESTABILITY ->
LONG-TERM ARCHITECTURE.

Do not optimize for doing more work.
