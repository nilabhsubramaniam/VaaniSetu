# CURRENT_STATE.md

Short, always-current snapshot of where the project is. Update this whenever the
project moves between milestones or a phase's status changes.

---

- **Current phase:** Phase 2 - Local LLM, **DONE**. Phase 3 - Speech-to-Text,
  **DONE** (Milestones 3a and 3b both complete). Phase 4 - Text-to-Speech,
  **DONE** (Milestones 4a and 4b both complete, with a known Hinglish gap —
  see below).
- **Current focus:** none active — awaiting the user's decision to start
  Phase 5 (End-to-End Voice MVP); see `AGENTS.md` §5, "never advance to the
  next milestone automatically".
- **Last updated:** 2026-09-24 (Milestone 4b: Python `tts` capability
  built and wired for real — `facebook/mms-tts-hin` selected after a
  real RTF/proxy-WER benchmark against `coqui/XTTS-v2`; a third,
  Apache-2.0-licensed candidate, `ai4bharat/indic-parler-tts`, is fully
  implemented but could not be benchmarked because Hugging Face denied
  gated-repo access. An assistant reply in Hindi now plays back real,
  audible, freshly synthesized speech end to end through the real Go and
  Python services — verified live, not just unit-tested. Known gap:
  the selected model cannot produce Hinglish speech at all, only Hindi;
  see `docs/DECISIONS.md` ADR-021 and `docs/ROADMAP.md` Phase 4)

## Completed

- Project documentation bootstrap: `AGENTS.md` and the `docs/` set
  (`PROJECT_GOAL`, `ARCHITECTURE`, `ROADMAP`, `DECISIONS`, `CURRENT_STATE`,
  `DEVELOPMENT`, `EVALUATION`).
- Phase 1 - UI Foundation: Angular workspace at `frontend/`, including a
  public landing page at `/`, a full assistant workspace at `/assistant`,
  and a settings scaffold — all still against mock/local data, no network
  calls.
- Decisions recorded: ADR-001 through ADR-014 (see `docs/DECISIONS.md`).
- **Phase 2, Milestone 2a - Go backend against a fake LLM client:**
  - `backend/` (Go 1.26, module `github.com/nilabhsubramaniam/VaaniSetu/backend`):
    `cmd/api`, `internal/{api,conversation,llm,config,db,logging}`.
  - `POST /api/v1/chat` and `GET /api/v1/chat/history`, per
    `docs/openapi/chat.yaml`, matching the frontend's existing `Turn`/
    `ConversationService` shapes exactly (no frontend interface change
    needed when Milestone 2b wires it up, per ADR-009).
  - PostgreSQL schema (`sessions`, `turns`) via `goose` migrations, embedded
    into the binary and applied automatically at startup.
  - `internal/llm.LLMClient` interface with `FakeLLMClient` (in use now, no
    network) and `HTTPLLMClient` (built, not yet wired to a real service —
    that's Milestone 2b) implementing it.
  - The Go<->Python `llm` contract (`proto/llm.openapi.yaml`, HTTP+JSON —
    ADR-014).
  - `docker-compose.yml` (postgres + backend) and `backend/Dockerfile`.
  - Tests: unit tests for `config`, `llm` (both clients), `logging`
    (verifies the no-transcript-at-info-level redaction actually redacts),
    and `api` handlers (via an in-memory fake `ConversationService`);
    integration tests for `conversation.Service` against a real,
    `testcontainers-go`-managed Postgres.
  - `go build`, `go vet`, `go test`, `gofmt`, and `golangci-lint` all clean.
  - **Verified live, end to end, against a real (native, non-Docker)
    PostgreSQL:** the backend starts, applies its migrations automatically,
    and both `POST /api/v1/chat` and `GET /api/v1/chat/history` return
    correct data — not just unit-tested, actually run and curled.
  - Local setup is documented in `backend/SETUP.md` (Prerequisites through
    Troubleshooting, including the exact `VAANISETU_DATABASE_URL` value)
    and `backend/.env.example`; a thin `backend/Makefile`
    (`run`/`build`/`vet`/`test`/`fmt`/`lint`/`check`) mirrors the
    frontend's `npm run` scripts.
- `docs/DEVELOPMENT.md` §4/§8 updated from `TBD` to the concrete backend
  stack actually used; §4.1 added, pointing at `backend/SETUP.md`.
- **Frontend↔backend integration:** the Angular app now talks to the real Go
  backend over HTTP instead of an in-memory mock.
  - Backend: minimal, hand-written CORS middleware in `internal/api` allows
    exactly one configured origin (`config.Config.AllowedOrigin`, default
    `http://localhost:4200`) — never a `*` wildcard; verified to never
    reflect an arbitrary request `Origin` back. `Routes()` now returns
    `http.Handler` (was `*http.ServeMux`) to wrap it.
  - Frontend: `ConversationRealService` (`core/services/conversation.real.service.ts`)
    implements `ConversationService` with Angular's `HttpClient`
    (`provideHttpClient()` added to `app.config.ts`), calling
    `POST {apiBaseUrl}/v1/chat` and `GET {apiBaseUrl}/v1/chat/history` via
    `environment.apiBaseUrl` (never a hardcoded host). Preserves the mock's
    optimistic-update pacing and stale-response handling (sequence counter
    plus real `Subscription.unsubscribe()` cancellation), and reuses
    `VoiceSessionService`'s existing `error` state for network failures,
    4xx, and 5xx — no new error-handling pattern introduced.
  - `app.config.ts`'s `ConversationService` provider now points at
    `ConversationRealService` (`VoiceSessionService` stays on its mock, per
    ADR-009 — only these two `useClass` lines were expected to change, and
    only one did).
  - `docs/openapi/chat.yaml` gained request/response `example:` blocks
    (real Hindi text and IDs observed during live verification) and a CORS
    note in its top-level description.
  - Verified live: real preflight (`OPTIONS`) and POST round trips against
    a running backend, correct CORS headers, non-reflection of an
    arbitrary `Origin`, and the Angular dev build's compiled bundle
    referencing the real `v1/chat` endpoint path. 75 frontend tests
    (66 previous + 9 new) and all backend tests pass; `ng lint`,
    `golangci-lint`, `gofmt`, and `prettier` all clean.
- **Phase 2, Milestone 2b - Python `llm` service, benchmark, and real
  wiring:**
  - `ai-services/` (Python 3.12+, `uv`, FastAPI + Uvicorn — ADR-015):
    `app/main.py` implements `proto/llm.openapi.yaml` exactly
    (`POST /v1/generate`) plus an unversioned `/healthz`. `app/engines`
    holds the `LLMEngine` capability interface and its one implementation,
    `LlamaCppEngine` (`llama-cpp-python`, local GGUF weights, no network
    call at generation time).
  - Model registry at `ai-services/models.yaml` (docs/ARCHITECTURE.md
    §3.6): three candidates listed, `selected: llama-3.2-3b-instruct`.
  - Lightweight, phase-scoped benchmark (`ai-services/scripts/benchmark.py`,
    seeded/reproducible, isolates each candidate in its own subprocess for
    accurate memory measurement) run on this machine (Apple M5 Pro, 24GB
    RAM) against Qwen2.5-3B-Instruct, Llama-3.2-3B-Instruct, and
    Gemma-2-2B-it on a fixed Hindi/Hinglish prompt set. Full input/output/
    timing recorded in `ai-services/benchmark_results/llm_milestone_2b.json`.
    Llama-3.2-3B-Instruct selected — see `docs/DECISIONS.md` ADR-016 for the
    evidence and reasoning (Qwen produced less fluent/precise Hindi output
    in this benchmark despite its more permissive license; Gemma violated
    the no-emoji system-prompt instruction once, Llama never did).
  - `HTTPLLMClient` (already built in Milestone 2a) is now wired to a real
    service: setting `VAANISETU_LLM_SERVICE_URL` on the backend switches it
    from `FakeLLMClient` with no code change, per ADR-006/the Milestone 2a
    design.
  - `docker-compose.yml` gained an `ai-services` entry (bind-mounts
    `./models/llm` read-only, per docs/ARCHITECTURE.md §6 — weights are
    never baked into the image); `backend`'s `VAANISETU_LLM_SERVICE_URL`
    now points at it.
  - Tests: 13 Python tests (contract tests for `/v1/generate` and
    `/healthz` via a fake `LLMEngine`, registry-loading tests, and
    chat-template-fallback tests for models with no system role) — all
    pass, no real model file needed. `ruff check`/`ruff format --check`
    clean.
  - **Verified live, end to end:** the Python service loads the selected
    model and reports ready; a direct `POST /v1/generate` call returns a
    real, freshly generated Hindi reply; with the Go backend pointed at it
    (`usesFakeLLM:false` in its startup log), a real `POST /api/v1/chat`
    request produces a genuine, fluent, on-topic Hindi story (not a canned
    reply), persisted to PostgreSQL and returned correctly through
    `GET /api/v1/chat/history` — the full Angular-contract-compatible
    chain, actually run, not just unit-tested.
  - `docs/DEVELOPMENT.md` §5/§9/§10 updated from `TBD` to the concrete
    Python stack actually used; §5.1 added, pointing at
    `ai-services/SETUP.md`; repository-structure tree corrected to match
    reality (previously still described a pre-Phase-2 layout).
  - Docker Compose itself (postgres + backend + ai-services all together)
    has not been run end to end — Docker remains unavailable in this
    development environment; each piece has instead been run and verified
    natively. Verify the Compose stack on a machine with Docker before
    treating it as proven.
- **Phase 3, Milestone 3a - real audio capture, transport, and script
  tagging:**
  - Frontend: `AudioCaptureService` wraps the browser's `MediaRecorder`
    API (start/stop/cancel); `SpeechService` uploads the recorded audio to
    the backend and returns a transcript. `MicButton` now really records
    (tap to start, tap again to stop — manual endpointing, ADR-017) and
    feeds the real transcript into the existing, unchanged
    `ConversationService.sendUserTurn`.
  - Backend: new `internal/asr` package mirrors `internal/llm`'s
    fake/real-client shape exactly (`ASRClient` interface,
    `FakeASRClient` in use now, `HTTPASRClient` built for Milestone 3b).
    New `POST /api/v1/speech/transcribe` (raw binary audio body, language
    as a query param, per `docs/openapi/speech.yaml` and
    `proto/asr.openapi.yaml`) has no persistence side effect — it only
    returns a transcript.
  - Database: additive migration `0002_add_script.sql` adds a nullable
    `turns.script` column. `internal/conversation.DetectScript` computes
    it deterministically (Unicode-range classification, not a
    language-ID model) for every turn, typed or spoken, at persist time.
  - `VAANISETU_ASR_SERVICE_URL` config var added (mirrors
    `VAANISETU_LLM_SERVICE_URL`'s "swap by config" mechanism, ADR-006);
    unset by default, so `make run` needs no `ai-services/` checkout.
  - Tests: 8 new Go tests (`internal/asr`'s fake/HTTP clients, 5 new
    `handleTranscribe` handler tests) and 14 new Go `DetectScript`/config
    tests; 13 new frontend tests (`AudioCaptureService` against a mocked
    `MediaRecorder`, `SpeechService` against `HttpTestingController`, and
    a rewritten `MicButton` spec covering the real record/transcribe/send
    flow, permission-denied, and transcription-failure cases). All pass;
    `go build/vet/test`, `gofmt`, `golangci-lint`, `ng test/lint/build`,
    and `prettier` all clean.
  - Real browser/microphone testing was not performed by the agent (no
    interactive browser available); the transport and persistence path
    was proven via Go/TypeScript unit and handler tests, and — once
    Milestone 3b's real model existed — via live curl-driven audio
    uploads (see below). A hands-on browser/microphone smoke test is
    still worth doing.
  - `docs/DECISIONS.md` ADR-017 records the audio-transport, one-process-
    two-capabilities, manual-endpointing, and script-vs-language-ID
    decisions this milestone made.
- **Phase 3, Milestone 3b - Python `asr` capability, benchmark, and real
  wiring:**
  - `ai-services/app/engines/asr/` (new capability module, hosted in the
    same FastAPI process as `llm` per ADR-017): `ASREngine` interface,
    `FasterWhisperEngine` implementation (`faster-whisper`/CTranslate2,
    chosen for the same reasons `llama-cpp-python` was — ADR-015/ADR-018).
    `app/main.py` now loads both capabilities at startup and implements
    `proto/asr.openapi.yaml`'s `POST /v1/transcribe` alongside the
    existing `POST /v1/generate`; `/healthz` reports both models.
  - Model registry gained an `asr` section in `ai-services/models.yaml`:
    three candidates (`faster-whisper-small`/`-medium`/`-large-v3-turbo`),
    `selected: faster-whisper-large-v3-turbo`.
  - A committed fixture manifest (`ai-services/eval_data/asr_fixtures.yaml`,
    8 Hindi/Hinglish/English utterances) plus a macOS-only generation
    script (`scripts/generate_audio_fixtures.py`, using the OS's own `say`
    — a one-time dev tool, not a TTS capability) produce the git-ignored
    audio `scripts/benchmark_asr.py` benchmarks against. Full results in
    `ai-services/benchmark_results/asr_milestone_3b.json`.
  - `faster-whisper-large-v3-turbo` selected: 0% WER on all 4 Hindi and
    both English fixtures (the other two candidates: 38.8% and 10% mean
    Hindi WER respectively), and the best — though still imperfect —
    Hinglish result of the three. See `docs/DECISIONS.md` ADR-018,
    including a real finding along the way: auto-detecting the language
    for "hinglish" caused every candidate to transcribe romanized
    Hindi-English speech into Devanagari script instead of the intended
    Latin script; forcing English decoding fixed the script (not fully
    the accuracy — a documented, genuine Whisper-family limitation for
    code-switched Indian-language speech, not a bug in this integration).
  - `HTTPASRClient` (already built in Milestone 3a) is now wired to a real
    service: setting `VAANISETU_ASR_SERVICE_URL` on the backend switches
    it from `FakeASRClient` with no code change.
  - `docker-compose.yml`'s `ai-services` volume mount widened from
    `./models/llm` to `./models` (covers both capabilities' subdirectories);
    `backend`'s `VAANISETU_ASR_SERVICE_URL` now points at it too.
  - Tests: 9 new Python tests (`FasterWhisperEngine` request/response
    handling against a fake underlying model, `/v1/transcribe` contract
    tests, WER-calculation unit tests) plus updates to existing
    registry/`/healthz` tests for the two-capability shape — 35 total, all
    pass; `ruff check`/`ruff format --check` clean.
  - **Verified live, end to end:** the AI service loads both models and
    reports both ready; a real synthesized Hindi recording, uploaded
    through the Go backend's `/speech/transcribe`, produces a correct
    transcript, which — fed into the existing, unchanged `/chat` — produces
    a genuine LLM-generated Hindi story reply, with both turns correctly
    auto-tagged `"script":"Devanagari"`. The known Hinglish weakness was
    also verified live, not just in the benchmark, for honest reporting.
  - `docs/DEVELOPMENT.md` §5/§5.1 and its repository-structure tree
    updated for the second capability module and its scripts/fixtures.
- **Phase 4, Milestone 4a - Go `tts` capability boundary and real audio
  playback:**
  - Backend: new `internal/tts` package mirrors `internal/llm`/
    `internal/asr`'s fake/real-client shape exactly (`TTSClient`
    interface, `FakeTTSClient` — a real, playable generated WAV tone, not
    opaque stub bytes — in use now, `HTTPTTSClient` built for Milestone
    4b). New `POST /api/v1/speech/synthesize` (`{text, language}` JSON in,
    `audio/wav` bytes out, per `docs/openapi/speech.yaml` and
    `proto/tts.openapi.yaml`) has no persistence side effect.
  - Frontend: new `AudioPlaybackService` wraps the browser's `<audio>`
    element; wired directly into `ConversationRealService` so a chat
    reply triggers synthesis + playback fire-and-forget — a synthesis
    failure is logged, never surfaces as the conversation's `error` state
    (voice output is additive to the working text flow, ADR-020).
  - Tests: new Go tests for `internal/tts`'s fake/HTTP clients and the
    `handleSynthesize` handler; new frontend tests for
    `AudioPlaybackService` and the extended `ConversationRealService`/
    `SpeechService`. All pass; `go build/vet/test`, `gofmt`,
    `golangci-lint`, `ng test/lint/build`, and `prettier` all clean.
  - `docs/DECISIONS.md` ADR-020 records the transport-shape (JSON
    in/binary out, the mirror image of `asr`), fake-tone, and
    fire-and-forget-playback decisions this milestone made.
- **Phase 4, Milestone 4b - Python `tts` capability, benchmark, and real
  wiring:**
  - `ai-services/app/engines/tts/` (new capability module, hosted in the
    same FastAPI process as `llm`/`asr` per ADR-017): `TTSEngine`
    interface with three implementations built —
    `MmsVitsEngine` (`facebook/mms-tts-hin`, via `transformers`),
    `XttsEngine` (`coqui/XTTS-v2`, via `coqui-tts`), and `ParlerTTSEngine`
    (`ai4bharat/indic-parler-tts`, via `parler-tts`). `app/main.py` now
    loads all three capabilities at startup and implements
    `proto/tts.openapi.yaml`'s `POST /v1/synthesize`; `/healthz` reports
    all three models.
  - Model registry gained a `tts` section in `ai-services/models.yaml`
    with a `voices` map per candidate (per-language voice selector —
    `docs/ROADMAP.md` Phase 4's "per-language voice configuration" scope
    item), `selected: mms-tts-hin`.
  - Benchmark (`ai-services/scripts/benchmark_tts.py`) reuses
    `eval_data/asr_fixtures.yaml`'s text/language set (no new fixture
    file) and measures real-time factor plus an intelligibility proxy —
    each synthesized clip fed back through the already-selected
    `faster-whisper-large-v3-turbo` engine, WER computed against the
    input text (`docs/EVALUATION.md` §5's documented proxy metric).
    Pronunciation accuracy and naturalness (MOS) are recorded as
    explicitly **not measured** — no human listening panel exists in this
    environment. Full results in
    `ai-services/benchmark_results/tts_milestone_4b.json`.
  - `facebook/mms-tts-hin` selected: ~3x faster, less than half the peak
    memory, and 3x more accurate on Hindi (0.238 vs 0.713 proxy WER) than
    `coqui/XTTS-v2`. `ai4bharat/indic-parler-tts` — the only
    Apache-2.0-licensed candidate — could **not** be benchmarked: its
    Hugging Face repo is gated, and access was denied even after
    requesting it with a real account/token ("not in the authorized
    list"). See `docs/DECISIONS.md` ADR-021 for full reasoning and
    numbers, including a real finding along the way: the selected model's
    tokenizer vocabulary is Devanagari-phoneme only, so it cannot produce
    **any** audio for Hinglish (Latin-script) text — `MmsVitsEngine`
    raises a clear `UnsupportedTextError` for this rather than crashing
    inside `transformers` with an opaque tensor-dtype error.
  - `HTTPTTSClient` (already built in Milestone 4a) is now wired to a real
    service: setting `VAANISETU_TTS_SERVICE_URL` on the backend switches
    it from `FakeTTSClient` with no code change.
  - `docker-compose.yml`'s `ai-services` environment gained
    `VAANISETU_TTS_MODEL_STORE`; `backend`'s `VAANISETU_TTS_SERVICE_URL`
    now points at it too (the existing `./models` mount already covers
    `models/tts/`).
  - Tests: 12 new Python tests (one engine-wrapper module per candidate,
    mocking each underlying library; `/v1/synthesize` contract tests;
    registry tests for the three new engine kinds) plus the WER
    calculation extracted from `scripts/benchmark_asr.py` into a shared
    `scripts/wer.py` (now imported by both benchmark scripts, avoiding
    duplication) — 53 total, all pass; `ruff check`/`ruff format --check`
    clean.
  - **Verified live, end to end:** the AI service loads all three models
    and reports all ready; a direct `POST /v1/synthesize` call returns a
    real, valid, non-silent, playable WAV file; with the Go backend
    pointed at it (`usesFakeTTS:false` in its startup log), a real
    `POST /api/v1/chat` reply's text, sent to `POST
    /api/v1/speech/synthesize`, produces real synthesized Hindi speech —
    the full chain, actually run and inspected (duration, sample rate,
    non-zero waveform), not just unit-tested. The known Hinglish gap was
    also verified live (a 500, not a crash), for honest reporting.
  - `ai-services/pyproject.toml` gained `torch`, `transformers`,
    `parler-tts` (installed from GitHub — no PyPI release —
    `tool.hatch.metadata.allow-direct-references` set accordingly), and
    `coqui-tts` as runtime dependencies. `ai-services/.venv` was recreated
    against Python 3.12 specifically (not 3.14, this machine's default) —
    `tokenizers`' sdist hits a real, broken-metadata build failure on
    Python 3.14 in the absence of a prebuilt wheel; 3.12 has wheels for
    every dependency this milestone added. `ai-services/SETUP.md` and
    `docs/DEVELOPMENT.md` §5/§5.1 updated accordingly.

## Next

- No milestone is currently approved to start. `docs/ROADMAP.md` names
  Phase 5 (End-to-End Voice MVP) as next in order; per `AGENTS.md` §5,
  work does not begin on it until the user decides to move the project
  there. Two smaller, well-scoped follow-ups are also open whenever the
  user wants them: re-benchmarking `ai4bharat/indic-parler-tts` once its
  Hugging Face gated-repo access is granted (ADR-021), and a hands-on
  browser/microphone/speaker smoke test (still not performed by the agent
  in any phase so far — no interactive browser available).

## Not started

- End-to-end voice loop
- Indian language breadth (beyond Hindi / Hinglish scope)
- RAG
- Dataset pipeline
- Evaluation harness
- LoRA / QLoRA fine-tuning
- Real-time streaming
- Production hardening

## Repository reality

- `AGENTS.md`, `docs/`, `LICENSE`, `frontend/`, `backend/`, `proto/`, and
  now `ai-services/` all exist.
- `frontend/` builds, lints, and tests clean (117 tests). Its
  `ConversationService` runs against the real backend
  (`ConversationRealService`); `MicButton` now really records audio via
  `AudioCaptureService`/`SpeechService`; a chat reply now really plays
  back synthesized speech via `AudioPlaybackService`; only
  `VoiceSessionService` still uses a mock (see above).
- `backend/` builds, vets, lints (`golangci-lint`), and tests clean, and has
  now been run for real against a live, native PostgreSQL and a live,
  native `ai-services` instance (see above) — a developer following
  `backend/SETUP.md` and `ai-services/SETUP.md` on this machine can
  reproduce both. Its `testcontainers-go`-based Postgres integration tests
  specifically still require a Docker daemon, which remains unavailable in
  this environment — they skip themselves cleanly rather than failing, and
  have not been run for real against a container.
- `ai-services/` builds its dependencies (`uv sync` — `llama-cpp-python`
  compiles from source; `faster-whisper`/`ctranslate2`, `torch`,
  `transformers`, and `coqui-tts` use prebuilt wheels; `parler-tts`
  installs from GitHub, no PyPI release), tests (53), lints, and formats
  clean. Its `.venv` targets Python 3.12 specifically, not this machine's
  default 3.14 — `tokenizers` has no cp314 wheel yet and its sdist fails
  to build (see `ai-services/SETUP.md` Troubleshooting). Its own tests
  never load a real model (fake `LLMEngine`/`ASREngine`/`TTSEngine`
  implementations are dependency-injected); all three models actually
  running have been verified separately, live, per above.
- The `docker-compose.yml` stack (postgres + backend + ai-services, now
  covering all three capabilities) has not been run for real — Docker
  remains unavailable in this environment. Each service has instead been
  verified running natively. `backend/Dockerfile` and
  `ai-services/Dockerfile` have not been built. Worth doing on a machine
  with Docker before any milestone is treated as fully verified in every
  respect.
- Three capabilities' models are selected: `llm`
  (`llama-3.2-3b-instruct`, ADR-016), `asr`
  (`faster-whisper-large-v3-turbo`, ADR-018), and `tts`
  (`facebook/mms-tts-hin`, ADR-021 — with the Hinglish gap noted above).
  Every other capability's model choice is still `TBD` (see ADR-008).
- `frontend/node_modules/`, `frontend/dist/`, `ai-services/.venv/`, local
  Postgres data, `/models/` (downloaded weights), and
  `ai-services/eval_data/audio/` (generated ASR test fixtures) are all
  git-ignored via the repository's single root `.gitignore`.
