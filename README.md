# VaaniSetu

**वाणी + सेतु — a voice bridge, not a voice cage.**

A privacy-first, local-first AI voice assistant built for Indian languages and Hinglish, composed from open-source models rather than a single hosted model.

> **Status: early development.** Phase 0 (project foundation) and Phase 1 (UI foundation) are complete. The repository currently contains project documentation and a frontend UI built entirely against mock data — there is no backend, database, speech, or AI functionality yet. See [Project status](#project-status) below for exactly what exists today.

---

## Table of contents

- [Project status](#project-status)
- [Vision](#vision)
- [Why VaaniSetu](#why-vaanisetu)
- [Key goals](#key-goals)
- [How it works (target pipeline)](#how-it-works-target-pipeline)
- [Supported languages](#supported-languages)
- [Planned AI / voice architecture](#planned-ai--voice-architecture)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Current implementation](#current-implementation)
- [Roadmap](#roadmap)
- [Local development](#local-development)
- [Development workflow](#development-workflow)
- [Architecture](#architecture)
- [Privacy and security principles](#privacy-and-security-principles)
- [AI / model philosophy](#ai--model-philosophy)
- [Evaluation approach](#evaluation-approach)
- [Documentation map](#documentation-map)
- [Contributing](#contributing)
- [License](#license)

---

## Project status

| Phase | Name | Status |
|---|---|---|
| 0 | Project Foundation | **Done** |
| 1 | UI Foundation | **Done** |
| 2 | Local LLM | Not started (next, pending approval) |
| 3–12 | STT, TTS, end-to-end voice, language breadth, RAG, dataset pipeline, evaluation, fine-tuning, streaming, production hardening | Not started |

What that means concretely today:

- ✅ Project documentation (`AGENTS.md`, `docs/`) is established and is the source of truth for scope and process.
- ✅ An Angular frontend exists at [`frontend/`](frontend/) with a conversation UI, a mic control, a settings screen, and a full mock data layer — no real backend call is made anywhere in it.
- ❌ There is no Go backend, no Python AI service, no database, and no speech, language-model, or retrieval functionality implemented anywhere in this repository.

The full status, updated as work lands, lives in [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Vision

VaaniSetu's goal is a voice assistant that understands and replies naturally in Indian languages and Hinglish, running on the user's own hardware by default rather than a cloud service. The target pipeline, once fully built, is conceptually:

```
Microphone → VAD → Speech-to-Text → Language Detection → Local AI → RAG / Tools → Text-to-Speech → Speaker
```

**None of this pipeline is implemented yet.** It is the destination the roadmap in [`docs/ROADMAP.md`](docs/ROADMAP.md) is working toward, built one stage at a time, not the current state of the code. Full detail: [`docs/PROJECT_GOAL.md`](docs/PROJECT_GOAL.md).

## Why VaaniSetu

Mainstream voice assistants are cloud-bound by default, and code-switching between Hindi and English in the same sentence — completely ordinary speech for a large number of people — is handled poorly by most of them. Meanwhile, capable open-source speech and language models for Indian languages already exist; wiring them into one coherent, private, local assistant is still an unsolved integration problem. That's the gap this project targets.

## Key goals

- **Local-first, cloud-optional.** Every component in the eventual voice loop is meant to run on the user's own hardware by default; a remote model, if ever supported, would be an explicit opt-in, not a silent fallback.
- **Indian languages and Hinglish as the primary case**, not an afterthought bolted onto an English-first product.
- **Incremental, milestone-driven delivery** — one approved phase at a time (see [Development workflow](#development-workflow)), never the whole system built speculatively at once.
- **Replaceable models.** No AI capability is meant to be permanently tied to one model; selection is meant to be benchmark- and license-driven (see [AI / model philosophy](#ai--model-philosophy)).

## How it works (target pipeline)

The long-term voice loop, and what's actually built so far:

| Stage | Purpose | Status |
|---|---|---|
| Voice Activity Detection | Detect when the user is speaking | Not implemented |
| Speech-to-Text | Transcribe speech | Not implemented |
| Language Detection | Tag the turn's language/script | Not implemented |
| Local AI (LLM) | Generate a reply | Not implemented — Phase 1's UI uses a canned, hardcoded mock reply |
| RAG / Tools | Ground answers in documents or actions | Not implemented |
| Text-to-Speech | Speak the reply | Not implemented |

Today, the [`frontend/`](frontend/) app simulates this loop end-to-end with mock data and timers so the interaction model (mic states, conversation view, language selection) can be built and reviewed before any real AI component exists.

## Supported languages

- **Available in the current UI:** Hindi, Hinglish.
- **Long-term direction** (not yet built): Bengali, Gujarati, Marathi, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia.

The architecture is intended to stay multilingual rather than Hindi-specific: language identity is a shared, typed model (`LanguageCode` in [`frontend/src/app/core/models/language.model.ts`](frontend/src/app/core/models/language.model.ts)) that the UI, and eventually the backend, both read from — adding a language is meant to be a configuration and evaluation exercise, not an architecture change. Each additional language is enabled in the product only once it passes the quality thresholds in [`docs/EVALUATION.md`](docs/EVALUATION.md) (see Phase 6 of the roadmap).

## Planned AI / voice architecture

VaaniSetu's long-term direction allows for **multiple open-source models or specialized components** cooperating on a single turn, rather than one monolithic model doing everything — conceptually:

```
Orchestrator
├── Speech-to-Text
├── Language Detection
├── Reasoning (LLM)
├── RAG / Knowledge
├── Tools
└── Response / Text-to-Speech
```

Some of these stages may eventually run concurrently where it's safe to do so. The intent is that each stage communicates through a defined service contract rather than being tightly coupled to a specific model implementation, so an engine can be swapped by changing configuration, not code.

**None of this orchestration exists yet** — there is no orchestrator, no multi-model execution, and no model-to-model communication in the repository today. No specific model has been selected for any capability either; model choice is meant to be decided by benchmarking on real hardware plus a license check, not by reputation (recorded as [ADR-008](docs/DECISIONS.md#adr-008---model-selection-is-deferred-and-evidence-based) in `docs/DECISIONS.md`).

## Technology stack

| Layer | Current | Planned |
|---|---|---|
| Frontend | Angular 22 (standalone components, zoneless), TypeScript, SCSS | — |
| Backend | — | Go |
| AI / ML | — | Python, open-source/local models |
| Database | — | PostgreSQL, with `pgvector` for retrieval |
| Infrastructure | — | Docker, once a backend/AI service exists to containerize |

Only the frontend column is real today. Everything in the "Planned" column is architecture intent recorded in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), not code in this repository.

## Repository structure

```
VaaniSetu/
├── AGENTS.md          # How AI coding agents (and contributors) must work on this repo
├── LICENSE            # MIT
├── README.md          # This file
├── .gitignore
├── docs/              # Persistent project documentation (source of truth — see below)
└── frontend/          # Angular 22 UI, mock data only (Phase 1)
```

`backend/` (Go) and `ai-services/` (Python) do not exist yet — they're introduced in Phase 2 onward, per [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Current implementation

What's actually in [`frontend/`](frontend/) today:

- An Angular 22 app (standalone components, signals, zoneless change detection) with two routes: an assistant/conversation screen and a settings screen.
- A mic control with a visible `idle → listening → processing → responding → error` state cycle, a text-input fallback, a language selector, and a conversation view — all driven by two in-memory mock services (`ConversationMockService`, `VoiceSessionMockService`) behind swappable interfaces, plus a small settings store for the language preference.
- No network calls anywhere in the app; no backend, database, or AI service is called or assumed to exist.

This is intentionally a UI shell for validating the interaction model, not a functioning assistant. Current status is tracked in [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Roadmap

VaaniSetu is built one approved milestone at a time; the agent/contributor workflow never jumps ahead of the current phase. Condensed from [`docs/ROADMAP.md`](docs/ROADMAP.md) (see that file for objectives, dependencies, and acceptance criteria per phase):

`0` Project Foundation → `1` UI Foundation → `2` Local LLM → `3` Speech-to-Text → `4` Text-to-Speech → `5` End-to-End Voice MVP → `6` Indian Language Support → `7` RAG → `8` Dataset Pipeline → `9` Evaluation & Benchmarking → `10` LoRA/QLoRA Fine-Tuning → `11` Real-Time Streaming → `12` Production Hardening

Phases `0` and `1` are done; everything from `2` onward is not started. Full detail, current phase, and definitions of done: [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Local development

Only the frontend exists to set up right now.

**Prerequisites:** Node.js and npm compatible with Angular 22 (this repo is developed against Node 24.x / npm 11.x). No other runtime is required for the current codebase.

```bash
cd frontend
npm install       # install dependencies
npm start         # dev server at http://localhost:4200 (ng serve)
npm run build     # production build (ng build)
npm test          # Vitest unit/component tests (ng test)
npm run lint      # ESLint (ng lint)
npx prettier --check "src/**/*.{ts,html,scss}"   # formatting check
```

These are the exact scripts defined in [`frontend/package.json`](frontend/package.json) — nothing here is invented. There is no backend or AI service to set up yet; those sections will be added to this README once Phase 2 introduces them.

## Development workflow

This project is developed under an explicit agent/contributor contract, not ad hoc: read [`AGENTS.md`](AGENTS.md) before making any change. In short:

1. Read `AGENTS.md`, the relevant `docs/` files, and `docs/CURRENT_STATE.md`.
2. Confirm the requested work belongs to the current milestone.
3. Propose a plan and get it approved before implementing.
4. Implement only the approved scope, test it, and update documentation in the same change.
5. Stop — do not automatically continue into the next milestone.

Coding conventions, tooling, and commands are kept current in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Architecture

Target shape, from [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

```
Angular (frontend)  →  Go API (backend)  →  Python AI service  →  local/open-source models
```

Angular is intended to talk only to the Go backend — never directly to a Python AI service or a model — and Go is intended to run no inference itself, only orchestration and persistence. Today, only the Angular layer exists, calling nothing but its own in-memory mock services. The full component responsibilities, service boundaries, and the planned multi-model orchestrator are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); architectural decisions and their rationale are tracked individually in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Privacy and security principles

VaaniSetu is designed with local-first processing and user control over their own data as core architectural principles — every component in the eventual voice loop (speech recognition, language detection, the language model, retrieval, speech synthesis, and the database) is intended to run on the user's own hardware by default, with any cloud model as an explicit, revocable opt-in rather than a silent fallback. Consent for storing history, using data for fine-tuning, or uploading documents is meant to be granular and independently revocable.

At the current stage, there is no data to protect: the app makes no network calls and stores nothing beyond a language preference in the browser. The commitments above describe the target architecture this project is building toward, detailed in [`docs/PROJECT_GOAL.md`](docs/PROJECT_GOAL.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — they are not yet guarantees a shipped, functioning assistant is enforcing, because that assistant doesn't exist yet.

## AI / model philosophy

- Use pretrained open-source models; do not train foundation models from scratch.
- Benchmark candidate models on real target hardware, and check licenses against how the project intends to distribute, before selecting one.
- Establish and evaluate a pretrained baseline before considering any fine-tuning.
- Use retrieval (RAG) for knowledge; reserve fine-tuning for behavior, language adaptation, or formatting, only where evaluation shows it's needed.
- Keep every model swappable behind a stable interface — no capability is meant to be permanently coupled to one model.

Recorded as project decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md) (see ADR-003, ADR-004, ADR-005, ADR-006, and ADR-008).

## Evaluation approach

Once there is a real ASR, language model, retrieval, or speech-synthesis component to measure, VaaniSetu evaluates it against defined targets: transcription accuracy (WER/CER) including Hinglish code-switching, language-identification accuracy, language-model quality/hallucination/latency, retrieval recall and grounding, speech-synthesis naturalness and latency, end-to-end voice latency and task success, and hardware/resource usage. No evaluation harness exists yet — this is the strategy it will be built against. Full metric definitions and targets: [`docs/EVALUATION.md`](docs/EVALUATION.md).

## Documentation map

| Document | Answers |
|---|---|
| [`AGENTS.md`](AGENTS.md) | How agents/contributors must work on this project |
| [`docs/PROJECT_GOAL.md`](docs/PROJECT_GOAL.md) | Why VaaniSetu exists; MVP vs. long-term scope |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the system is designed |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What gets built, in what order |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why key technical decisions were made (ADRs) |
| [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) | What's true right now |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Conventions, tooling, commands |
| [`docs/EVALUATION.md`](docs/EVALUATION.md) | How quality will be measured |

## Contributing

- Read [`AGENTS.md`](AGENTS.md) first; it governs how work happens here, including for AI coding agents.
- Keep changes scoped to the current milestone (`docs/CURRENT_STATE.md`) — don't implement future phases early.
- Avoid adding dependencies, frameworks, or a new model without checking `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` first, and without a license/benchmark review for any model.
- Add or update tests for what you change; update the relevant `docs/` file in the same change if it affects architecture, decisions, or project state.
- Never commit secrets, credentials, or model weights.

## License

[MIT](LICENSE) © 2026 Nilabh.
