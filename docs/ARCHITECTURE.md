# ARCHITECTURE.md

The intended system architecture for VaaniSetu.

This describes the **target** design. Only parts explicitly reached in
`docs/ROADMAP.md` and `docs/CURRENT_STATE.md` are built at any given time.
Presence in this document is not permission to implement.

---

## 1. High-level shape

```
+-----------+        +-----------+        +--------------------+
|  Angular  |  HTTP  |    Go     |  gRPC  |   Python AI        |
|  frontend | <----> |  backend  | <----> |   service(s)       |
|  (browser)|   /WS  |  (API)    |  /HTTP |                    |
+-----------+        +-----+-----+        +---------+----------+
                           |                       |
                           v                       v
                   +---------------+       +------------------+
                   | PostgreSQL    |       | Local model store|
                   | + pgvector    |       | (git-ignored)    |
                   +---------------+       +------------------+
```

- **Angular** renders the UI and captures / plays audio in the browser.
- **Go** owns everything that is not inference: sessions, auth, the turn
  orchestrator, persistence, and (later) the document / RAG API. It never runs a
  model.
- **Python** runs all inference: VAD, ASR, language detection, LLM, TTS,
  embeddings, reranking. It exposes each as a versioned service contract.
- **PostgreSQL** stores application data; **pgvector** stores embeddings for
  retrieval (later phases).
- The **model store** is a local, git-ignored directory of downloaded weights.

## 2. Target AI pipeline

```
Voice in
  -> VAD                (speech / non-speech, endpointing)
  -> ASR / STT          (audio -> transcript, with partials)
  -> Language Detection (language, script, code-mix tag)
  -> LLM                (prompt -> response)
  -> RAG / Tools        (retrieve grounding passages or invoke a tool)
  -> TTS                (response text -> audio)
Voice out
```

Every stage is a component behind a stable interface. Stages are added across
roadmap phases (LLM first, then STT, then TTS, then the full loop, then
language breadth, then RAG). The diagram is the destination, not the build
order.

## 3. Component responsibilities

### 3.1 Frontend (Angular + TypeScript + SCSS)

- Render the conversation UI, settings, and (later) a privacy dashboard.
- Capture microphone audio and play synthesized audio in the browser.
- Talk **only** to the Go backend, over HTTP and (later) WebSocket. It never
  calls the Python service directly.
- Hold view state locally; no heavy client-side state framework unless a phase
  justifies it.
- Be built first against **mock / local data** so screens exist before services
  do, and structured so a real backend client can replace the mock with no UI
  rewrite (data access behind a service interface).

### 3.2 Backend (Go)

- Session lifecycle, local authentication, request routing.
- The **turn orchestrator**: the state machine that drives a voice turn
  (listen -> transcribe -> detect language -> think -> retrieve -> speak),
  cancelling downstream work on interruption (later phases).
- Persistence: read and write PostgreSQL.
- The document ingestion / RAG API (later phases): accept uploads, dispatch
  chunking / embedding jobs to Python, never embed inline in a request.
- Calls Python AI services over typed contracts. **Imports no model, runs no
  inference.**

### 3.3 AI service (Python)

- One service surface per capability: VAD, ASR, language detection, LLM, TTS,
  embeddings + reranking.
- Wrap an open-source model engine behind the contract; the engine is
  selectable by configuration (a model registry file), hot-swappable without a
  backend change.
- Expose model warm / ready state for health checks.
- Own audio utilities (resampling, framing) and prompt templates.
- Host offline jobs (dataset prep, fine-tuning, evaluation) in separate modules
  that are **not** in the request path.

### 3.4 Database (PostgreSQL)

- Application data: users, sessions, turns (role, language, script, text, audio
  reference, latency, timestamps), and later documents and consent log.
- Language and script are recorded **per turn**, not per session.
- No raw audio blobs in the database by default; `audio_ref` points at a local,
  TTL-expiring cache directory only when the user opted into retention.

### 3.5 Vector database / search (pgvector)

- Embeddings for document chunks live in a `vector` column in PostgreSQL via the
  `pgvector` extension. No separate vector store.
- Approximate index (HNSW) on the embedding column, tuned when RAG is built
  (Phase 7). Not present before then.
- Retrieval flow (Phase 7+): top-k vector search -> rerank -> top-N passages
  into the LLM prompt.

### 3.6 Model layer

- A single configuration file (a model registry, e.g. `models.yaml`) maps each
  capability, and later each language, to a concrete model plus runtime
  settings.
- Application code references a **capability** (`asr`, `llm`, `tts`), never a
  model name.
- Weights are downloaded once into the git-ignored local model store, verified
  by checksum, never baked into a container image or committed.
- Swapping an engine (for example one ASR model for another) is a config change
  plus, at most, a new wrapper class - never a change in Go or Angular.

### 3.7 Evaluation layer

- A dedicated Python module (offline, out of the request path) holds evaluation
  harnesses: WER / CER for ASR, language-ID accuracy, LLM quality and latency,
  retrieval and grounding for RAG, MOS-proxy and RTF for TTS, and end-to-end
  latency and task success.
- Metrics and targets are defined in `docs/EVALUATION.md`.
- Evaluation runs when a phase requires it and when a model registry entry
  changes. Results are recorded so quality is tracked over time.

## 4. Boundaries between Angular, Go, and Python

| Concern | Owner | Not allowed |
|---------|-------|-------------|
| UI, audio capture / playback | Angular | Angular calling Python directly |
| Auth, sessions, routing | Go | Go running inference |
| Turn orchestration | Go | Orchestration logic in Python or Angular |
| Persistence, migrations | Go | Python writing app tables directly |
| Inference (all of it) | Python | Model code / weights in Go or Angular |
| Prompt templates, audio DSP | Python | Prompt construction in Go |
| RAG retrieval mechanics | Python (called by Go) | Angular issuing vector queries |
| Model selection | Config (model registry) | A model name hardcoded in any service |

Cross-service communication is over explicit contracts: HTTP / WebSocket
between Angular and Go, gRPC or HTTP between Go and Python, with shared schema
definitions kept in a `proto/` (or equivalent) directory. No shared in-process
state across languages.

## 5. Model-replaceability rules

1. No AI model is permanently selected. Candidate lists exist; a selection is
   made only after benchmarking on target hardware (see `docs/EVALUATION.md`)
   and a license check against the project's distribution intent.
2. Every model sits behind a capability interface. Callers depend on the
   interface, not the model.
3. Model identity and runtime parameters live in configuration, not code.
4. A model swap must not require changes outside the Python service and its
   config.
5. Until benchmarking has been performed for a capability, its model choice is
   `TBD` and any name in this repository is a **candidate**, not a decision.

## 6. Deployment shape (target)

- Local install is the primary target. `docker compose up` for developers;
  later, a signed desktop wrapper that manages the compose stack for
  non-technical users.
- CPU-only and GPU image variants selected by compose profile.
- Model weights downloaded into a host-mounted, git-ignored volume, never
  layered into images.
- No default cloud deployment.
