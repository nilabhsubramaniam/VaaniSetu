# VaaniSetu

**वाणी + सेतु — a voice bridge, not a voice cage.**

A privacy-first, local-first AI voice assistant built for Indian languages and Hinglish, composed from open-source models rather than a single hosted model.

> **Status: early development.** Phases 0-3 (project foundation, UI foundation, local LLM, speech-to-text) are complete. You can speak or type a message in Hindi, Hinglish, or English and get a genuine, locally generated reply — real microphone capture, a real transcription model, and a real language model, all running on this machine and talking to each other over HTTP. There is no spoken reply (text-to-speech), RAG, or multi-language support yet. See [Project status](#project-status) below for exactly what exists today.

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
| 2 | Local LLM | **Done** |
| 3 | Speech-to-Text | **Done** |
| 4–12 | TTS, end-to-end voice, language breadth, RAG, dataset pipeline, evaluation, fine-tuning, streaming, production hardening | Not started |

What that means concretely today:

- Project documentation (`AGENTS.md`, `docs/`) is established and is the source of truth for scope and process.
- An Angular frontend exists at [`frontend/`](frontend/) with a conversation UI, a real microphone control, a settings screen, and real HTTP calls to a Go backend for every turn.
- A Go backend at [`backend/`](backend/) persists conversations in PostgreSQL, transcribes uploaded audio, and calls a Python service for each reply.
- A Python AI service at [`ai-services/`](ai-services/) runs two real, locally-loaded open-source models: a language model (Llama-3.2-3B-Instruct, selected by benchmark — [`docs/DECISIONS.md`](docs/DECISIONS.md) ADR-016) and a speech-to-text model (faster-whisper-large-v3-turbo, ADR-018).
- Speaking or typing in Hindi or English works well; Hinglish (code-switched) speech transcribes with reduced accuracy — a known, documented Whisper-family limitation, not a bug (ADR-018).
- There is still no spoken reply (TTS), no retrieval (RAG), and no language beyond Hindi/Hinglish/English enabled.

The full status, updated as work lands, lives in [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Vision

VaaniSetu's goal is a voice assistant that understands and replies naturally in Indian languages and Hinglish, running on the user's own hardware by default rather than a cloud service. The target pipeline, once fully built, is conceptually:

```
Microphone → VAD → Speech-to-Text → Language Detection → Local AI → RAG / Tools → Text-to-Speech → Speaker
```

**Two of these seven stages are implemented** (Speech-to-Text and the Local AI/LLM stage); the rest are the destination the roadmap in [`docs/ROADMAP.md`](docs/ROADMAP.md) is working toward, built one stage at a time. Full detail: [`docs/PROJECT_GOAL.md`](docs/PROJECT_GOAL.md).

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
| Voice Activity Detection | Detect when the user is speaking | Not implemented — endpointing is manual (tap the mic to start, tap again to stop), not automatic (see [`docs/DECISIONS.md`](docs/DECISIONS.md) ADR-017) |
| Speech-to-Text | Transcribe speech | **Implemented** — a real, locally-loaded model (faster-whisper-large-v3-turbo) transcribes every recording |
| Language Detection | Tag the turn's language/script | Partially — the *script* a turn is written in (Devanagari, Latin, ...) is computed automatically per turn; which *language* it is remains a manual selector, not detected (full language ID is Phase 6) |
| Local AI (LLM) | Generate a reply | **Implemented** — a real, locally-loaded open-source model (Llama-3.2-3B-Instruct) generates every reply |
| RAG / Tools | Ground answers in documents or actions | Not implemented |
| Text-to-Speech | Speak the reply | Not implemented |

Today, tapping the mic and speaking (or typing) sends real audio (or text) to the Go backend, which transcribes it if needed, persists it, and asks the Python `ai-services` LLM for a reply — a real network round trip and real models throughout, not a simulation. Playing the reply back as speech, and everything downstream of the LLM stage, is still not built.

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

**None of this orchestration exists yet** — there is no orchestrator and no multi-model execution in the repository today; the current system is one ASR call (when speaking) followed by one LLM call per turn, no other stage involved. Two capabilities have a selected model so far: `llm` and `asr`, each decided by benchmarking multiple candidates on real hardware plus a license check, not by reputation ([ADR-008](docs/DECISIONS.md#adr-008---model-selection-is-deferred-and-evidence-based), [ADR-016](docs/DECISIONS.md), and [ADR-018](docs/DECISIONS.md) in `docs/DECISIONS.md`). Every other capability's model choice remains undecided.

## Technology stack

| Layer | Current | Planned |
|---|---|---|
| Frontend | Angular 22 (standalone components, zoneless), TypeScript, SCSS, browser `MediaRecorder` for mic capture | — |
| Backend | Go 1.26+, stdlib `net/http`, `pgx`/`sqlc`, `goose` migrations | — |
| AI / ML | Python 3.12+, FastAPI, `llama-cpp-python` running Llama-3.2-3B-Instruct, `faster-whisper` running faster-whisper-large-v3-turbo | TTS, embeddings — not yet built |
| Database | PostgreSQL (sessions, turns, per-turn script tag) | `pgvector` for retrieval, once RAG (Phase 7) needs it |
| Infrastructure | `docker-compose.yml` (postgres + backend + ai-services), not yet run end to end in this environment | Signed desktop packaging (Phase 12) |

Everything in this table except the "Planned" column is real, running code, verified live end to end — not just architecture intent. Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository structure

```
VaaniSetu/
├── AGENTS.md          # How AI coding agents (and contributors) must work on this repo
├── LICENSE            # MIT
├── README.md          # This file
├── .gitignore
├── docs/              # Persistent project documentation (source of truth — see below)
├── proto/             # Go<->Python contracts (llm.openapi.yaml, asr.openapi.yaml)
├── docker-compose.yml # postgres + backend + ai-services
├── frontend/          # Angular 22 UI — real mic capture + backend calls (Phases 1-3)
├── backend/           # Go API: chat + speech endpoints, PostgreSQL persistence (Phase 2a/3a)
└── ai-services/       # Python LLM + ASR service: FastAPI + llama-cpp-python + faster-whisper (Phase 2b/3b)
```

## Current implementation

- **Frontend** ([`frontend/`](frontend/)): an Angular 22 app (standalone components, signals, zoneless change detection) with two routes — an assistant/conversation screen and a settings screen. A mic control really records audio (tap to start, tap again to stop) and uploads it for transcription; a text-input fallback and language selector send real messages to the backend via `HttpClient`.
- **Backend** ([`backend/`](backend/)): a Go service exposing `POST /api/v1/chat`, `GET /api/v1/chat/history`, and `POST /api/v1/speech/transcribe`, persisting every turn to PostgreSQL (with an automatically-computed script tag), and calling the Python service for transcription and replies.
- **AI service** ([`ai-services/`](ai-services/)): a FastAPI service that loads two real local models — Llama-3.2-3B-Instruct (`llama-cpp-python`) and faster-whisper-large-v3-turbo (`faster-whisper`) — and produces a real reply and a real transcript for every request, no canned or hardcoded text.
- Still not built: spoken replies (TTS), retrieval (RAG), multi-language support beyond Hindi/Hinglish/English, automatic language detection, and any orchestration beyond a single LLM/ASR call per turn.

Current status is tracked in [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Roadmap

VaaniSetu is built one approved milestone at a time; the agent/contributor workflow never jumps ahead of the current phase. Condensed from [`docs/ROADMAP.md`](docs/ROADMAP.md) (see that file for objectives, dependencies, and acceptance criteria per phase):

`0` Project Foundation → `1` UI Foundation → `2` Local LLM → `3` Speech-to-Text → `4` Text-to-Speech → `5` End-to-End Voice MVP → `6` Indian Language Support → `7` RAG → `8` Dataset Pipeline → `9` Evaluation & Benchmarking → `10` LoRA/QLoRA Fine-Tuning → `11` Real-Time Streaming → `12` Production Hardening

Phases `0`-`3` are done; everything from `4` onward is not started. Full detail, current phase, and definitions of done: [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Local development

Three pieces now exist: the frontend, the Go backend, and the Python AI service. Each has its own detailed setup guide; this is the short version.

**Frontend** — Node.js/npm compatible with Angular 22 (developed against Node 24.x / npm 11.x):

```bash
cd frontend
npm install && npm start   # dev server at http://localhost:4200
```

**Backend** — Go 1.26+ and a reachable PostgreSQL. Full walkthrough: [`backend/SETUP.md`](backend/SETUP.md).

```bash
cd backend
cp .env.example .env   # once
make run                # http://localhost:8080
```

**AI service** — Python 3.12+ and [`uv`](https://docs.astral.sh/uv/). Full walkthrough: [`ai-services/SETUP.md`](ai-services/SETUP.md).

```bash
cd ai-services
uv sync
uv run scripts/download_models.py   # ~5.5GB (both llm and asr candidates), one time
make run                             # http://localhost:8090
```

With all three running (and `backend/.env`'s `VAANISETU_LLM_SERVICE_URL`/`VAANISETU_ASR_SERVICE_URL` pointed at the AI service), speaking or typing in the frontend is backed by real transcription and a real, locally-generated reply end to end. Each workspace's own commands (`npm test`/`npm run lint`, `make test`/`make lint` in `backend/` and `ai-services/`) are listed in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

**Troubleshooting: browser console shows `TypeError: Failed to fetch` / `HttpErrorResponse ... status: 0`.**
This is a browser-level connection failure, not an application error — the
request never reached the backend at all (a real HTTP error, like `400` or
`502`, would show a numeric status instead). It almost always means the
backend on port 8080 isn't actually running (or was mid-restart) at the
moment you sent the message. Confirm with `curl http://localhost:8080/api/v1/chat/history`
— if that also fails to connect, start (or restart) the backend and try
again in the browser. If the curl call succeeds but the browser still
shows this error, check the console for a second, separate line mentioning
CORS specifically; if present, the fix is in the backend's
`VAANISETU_ALLOWED_ORIGIN` (must exactly match the frontend's origin, e.g.
`http://localhost:4200`), not in the frontend code.

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

Angular talks only to the Go backend — never directly to the Python AI service — and Go runs no inference itself, only orchestration and persistence; this boundary is real today, not just planned. The Go<->Python call happens over the HTTP+JSON contract in [`proto/llm.openapi.yaml`](proto/llm.openapi.yaml). The full component responsibilities, service boundaries, and the planned multi-model orchestrator (not yet built) are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); architectural decisions and their rationale are tracked individually in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Privacy and security principles

VaaniSetu is designed with local-first processing and user control over their own data as core architectural principles — every component in the eventual voice loop (speech recognition, language detection, the language model, retrieval, speech synthesis, and the database) is intended to run on the user's own hardware by default, with any cloud model as an explicit, revocable opt-in rather than a silent fallback. Consent for storing history, using data for fine-tuning, or uploading documents is meant to be granular and independently revocable.

The LLM and ASR stages already meet this today: replies and transcripts are both produced by models running locally on the developer's own machine, with no network egress at inference time. Recorded audio is discarded once transcribed, never written to disk or the database, matching the "raw audio is discarded after transcription by default" commitment before any retention feature exists to opt into. Conversation turns are stored in a local PostgreSQL database, not sent anywhere else. Consent toggles for history storage, training use, and document uploads exist in the settings UI as visual previews only — they don't yet gate anything, since there's no persisted-history opt-out, fine-tuning, or document upload to gate. Full detail: [`docs/PROJECT_GOAL.md`](docs/PROJECT_GOAL.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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
