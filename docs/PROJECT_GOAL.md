# PROJECT_GOAL.md

Why VaaniSetu exists and what it is ultimately trying to achieve.

---

## 1. Product vision

VaaniSetu is a **local-first, privacy-first AI voice assistant** for Indian
languages and Hinglish. A user speaks in their own language; the assistant
understands, reasons, and replies in speech, with the entire voice loop running
on the user's own hardware. No audio and no transcript is required to leave the
device for the assistant to work.

The name: वाणी (*vaani*, voice) + सेतु (*setu*, bridge) - a bridge between
spoken Indian languages and useful AI assistance.

## 2. Problem being solved

- **Mainstream voice assistants are cloud-bound.** Speech and transcripts are
  sent to remote servers. That is a privacy cost many users cannot inspect or
  control.
- **Indian languages and Hinglish are underserved.** Code-switching between
  Hindi and English in a single sentence is normal speech for millions of
  people and is handled poorly by general assistants.
- **Good open-source speech and language models now exist** for Indian
  languages, but wiring them into a coherent, private, offline assistant is
  still a systems problem nobody has packaged well.

VaaniSetu targets exactly that gap: a coherent local pipeline built from
open-source parts, with Indian languages and Hinglish as the primary case
rather than an afterthought.

## 3. Target users and use cases

- **Privacy-conscious individuals** who want an assistant that provably does not
  phone home.
- **Hindi and Hinglish speakers** who want to talk to a computer the way they
  actually talk.
- **Households and small teams** (long term) who want a shared assistant on one
  local machine.
- **Developers and researchers** building on top of a local Indian-language
  voice stack.

Representative tasks: ask a question and hear an answer, dictate and get a
spoken summary back, query personal documents by voice (long term), run local
tools by voice (long term).

## 4. Local-first and privacy-first philosophy

- Every component in the critical voice loop (VAD, ASR, language detection, LLM,
  TTS, database) runs on the user's hardware by default.
- A remote model, if ever supported, is an explicit per-user opt-in override,
  never a silent fallback.
- Raw audio is discarded after transcription by default. Retention is opt-in.
- Storing conversation history, using a turn as training data, and uploading
  documents for retrieval are each separate, revocable consents.
- No third-party telemetry in the voice path. Any diagnostics are local and
  opt-in.

## 5. Voice assistant vision

Long-term pipeline:

```
Microphone
  -> VAD (is someone speaking?)
  -> Speech-to-Text (what did they say?)
  -> Language Detection (which language / script / code-mix?)
  -> Local LLM (what should the answer be?)
  -> RAG / Tools (ground it in documents or take an action)
  -> Text-to-Speech (say the answer)
  -> Speaker
```

Each stage is a replaceable component behind a stable interface. The pipeline is
built stage by stage across the roadmap, not all at once.

## 6. Indian-language focus

- **MVP languages:** Hindi and Hinglish (Hindi-English code-switching, including
  romanized Hindi).
- **Long-term languages:** Bengali, Gujarati, Marathi, Tamil, Telugu, Kannada,
  Malayalam, Punjabi, Odia.
- Detected language and script travel with every turn through the pipeline and
  are stored per turn, because users code-switch mid-conversation.
- A manual language preference always overrides automatic detection.

## 7. MVP vs. long-term vision

The MVP and the long-term vision are **different scopes**. Future features must
not leak into current work. The roadmap (`docs/ROADMAP.md`) is the contract for
ordering.

### MVP (the near-term target)

| Aspect | MVP |
|--------|-----|
| Languages | Hindi, Hinglish |
| Interface | Angular UI, built first with mock / local data |
| Voice loop | Built stage by stage: local LLM, then STT, then TTS, then end-to-end |
| Knowledge | None. No RAG in the MVP. |
| Users | Single user, single machine |
| Streaming | Not required for MVP; request/response is acceptable first |
| Data | Local PostgreSQL for sessions and turns |
| Deployment | `docker compose up` for developers |

The first implementation milestone is **Phase 1 - UI Foundation**, developed
against mock data with no real backend, LLM, STT, TTS, RAG, or database wired
in.

### Long-term vision (explicitly NOT current scope)

- All ten-plus Indian languages meeting quality targets individually.
- RAG over user documents, with cross-lingual grounding.
- Persistent, searchable conversation memory.
- Real-time streaming voice with barge-in / interruption handling.
- Dataset collection pipeline and LoRA / QLoRA fine-tuning for weak
  languages and domains.
- Tool-calling / skills (calendar, smart home, search) via the orchestrator.
- Multi-user household / team mode with per-account isolation.
- Signed desktop packaging and a user-facing privacy dashboard.

## 8. What VaaniSetu is NOT

- **Not a cloud service.** There is no default hosted backend. A managed
  offering, if ever built, is a separate target behind the same contracts.
- **Not a foundation-model training project.** It composes pretrained
  open-source models. It does not train them from scratch.
- **Not a fine-tuning-first project.** Fine-tuning happens only after a
  pretrained baseline is evaluated and shown to fall short.
- **Not tied to one model.** No ASR, LLM, or TTS model is permanently selected.
  Models are chosen by benchmarking and remain replaceable by configuration.
- **Not a general chatbot UI.** The product is voice-first; text is a secondary
  affordance.
- **Not a data-collection product.** User speech and text are not a resource to
  be harvested.
