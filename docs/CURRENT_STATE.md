# CURRENT_STATE.md

Short, always-current snapshot of where the project is. Update this whenever the
project moves between milestones or a phase's status changes.

---

- **Current phase:** Phase 2 - Local LLM, **DONE**. Phase 3 - Speech-to-Text,
  **DONE** (Milestones 3a and 3b both complete). Phase 4 - Text-to-Speech,
  **DONE** (Milestones 4a and 4b both complete, with a known Hinglish gap
  — see below). Phase 5 - End-to-End Voice MVP, **DONE** (with a known
  latency gap — see below). Phase 6 - Indian Language Support,
  **IN PROGRESS** (Milestones 6a, 6b — the `langid` capability —, 6c —
  Malayalam enabled end to end —, 6d — Hinglish TTS fixed via
  transliteration, Malayalam's real bottleneck diagnosed —, 6e —
  auto-detection now drives typed-chat behavior, opt-in —, 6f —
  Maithili real evidence gathered across all four capabilities, **not
  enabled** (LLM never replies in Maithili, ADR-031) —, 6h — Bengali,
  Tamil, Telugu, and Kannada evaluated across all four capabilities and
  **enabled** (ADR-033), plus a real, independent Odia ASR bug found and
  fixed —, 6i — Gujarati, Marathi, and Punjabi evaluated and **enabled**
  (ADR-034) —, and 6j — Odia evaluated and **not enabled** (broken LLM
  generation plus a hard ASR capability gap, the same class of blocker
  Maithili has — ADR-035) — all complete, with known remaining gaps, see
  below; this closes evidence-gathering for all eight of the phase's
  originally-named languages. Milestone 6g (closing Maithili's
  LLM-generation and ASR-capability blockers) is **in progress, paused
  mid-milestone** — see below; it is the only work remaining in Phase 6's
  currently-scoped work, with no milestone approved yet to resume it.
- **Current focus:** none of Phase 6's remaining scope is currently
  approved to start (Milestone 6g's resume is the only thing left named)
  — see `AGENTS.md` §5. Milestone 6g is paused, not abandoned — its
  LLM-generation experiments concluded negative (see below); its
  ASR-capability search found two real, MIT-licensed candidates
  (`ai4bharat/indic-conformer-600m-multilingual`, `ARTPARK-IISc/
  SraVaani-1.0`), both gated on Hugging Face, paused pending a decision
  on whether a real account/token is available to attempt access (the
  same wall `indic-parler-tts` hit in ADR-021).
- **Last updated:** 2026-09-29 (Phase 6 Milestone 6j: evaluated Odia, the
  last of the phase's originally-named eight languages — **not enabled**,
  a genuinely different outcome from Milestones 6h/6i's six enabled
  languages, not a rubber-stamped continuation of that pattern.
  **langid**: 100% accurate (4/4) — real Odia training data, cleanly
  distinguished, same strong result every script-distinct language has
  had. **LLM**: broken, not just wrong-language — unlike Maithili
  (fluent, just replies in Hindi), `llama-3.2-3b-instruct`'s Odia output
  degenerates into repetitive token loops and, on two of four fixtures,
  mixes in stray characters from unrelated scripts entirely; none of the
  four fixtures produced a coherent, on-topic reply. **ASR**: no real
  Whisper support at all (confirmed directly, the same hard capability
  gap Maithili has) — demonstrated dramatically: with Milestone 6h's
  hint-dict bug fix in place, Whisper's auto-detection fallback
  hallucinated a **different, unrelated script for every single clip**
  (romanized Latin, Devanagari, Gujarati, Arabic) when asked to
  transcribe the TTS-proxy audio, not mere mispronunciation but
  essentially a random guess. Unlike Bengali/Telugu/Gujarati/Marathi/
  Punjabi/Kannada/Tamil (all working LLM + a real, if imperfect, ASR
  path — a voice-*quality* gap, the accepted shippable category since
  Malayalam), Odia has neither a reliable LLM nor any ASR path at all —
  the same "non-functional, not degraded" reasoning ADR-031 used for
  Maithili, so it stays disabled rather than extending the last two
  milestones' enable-by-default pattern. `LANGUAGE_OPTIONS`'s `or.enabled`
  stays `false`. See `docs/DECISIONS.md` ADR-035 for the full evidence.
  This closes evidence-gathering for all eight of Phase 6's
  originally-named languages (Bengali, Gujarati, Marathi, Tamil, Telugu,
  Kannada, Punjabi, Odia) — seven enabled (all but Odia), on top of
  Malayalam's earlier, separate Milestone 6c enablement. Only Maithili's
  own gap-closing (Milestone 6g, paused) remains open in Phase 6.
- **Last updated:** 2026-09-29 (Phase 6 Milestone 6i: evaluated Gujarati,
  Marathi, and Punjabi the same way Milestone 6h evaluated its four
  languages, and enabled all three. **LLM**: fluent, on-topic, correct
  script for all three, 4/4 each. **langid**: 100% accurate for all three
  (12/12) — including Marathi, correctly distinguished from Hindi despite
  sharing Devanagari, a stronger result than the Hindi/Hinglish/Maithili
  confusion ADR-031 already documented. **ASR/TTS**: real, uneven quality
  gaps again, not a capability gap. A real sourcing improvement this
  time: Gujarati and Marathi both have real, human-recorded OpenSLR
  corpora (resources 78/64, the same family Milestone 6d used for
  Malayalam), so their ASR could be measured against genuine speech, not
  just a TTS-round-trip proxy — Gujarati measured 0.333 real-audio WER /
  0.585 TTS-proxy WER; Marathi measured 0.5375 / 1.00, with one real clip
  transcribed entirely into **romanized Latin script** instead of
  Devanagari, a genuine script-fidelity failure distinct from anything
  seen before. Punjabi has no equivalent real corpus (checked directly
  against OpenSLR's resource list), so it rests on the TTS-proxy metric
  alone (0.983) — including one transcript that **hallucinated
  characters from unrelated scripts** (Armenian- and CJK-looking glyphs),
  a more severe failure than Kannada's repetitive-syllable breakdown
  (ADR-033). Generalized the Malayalam-only real-fixture download/
  benchmark scripts into `scripts/download_real_fixtures.py`/
  `scripts/benchmark_real_asr.py` (a real second use, not speculative);
  the original Malayalam scripts are untouched. Given the pattern is now
  well-established, enabled all three directly rather than pausing for a
  separate confirmation round — same reasoning as Milestone 6h's
  recommendation, this time stated once rather than re-litigated. This
  again surfaced the same class of gap 6h found: none of the three had a
  self-hosted, script-specific font — fixed the same way (two new fonts,
  `Noto Sans Gujarati`/`Noto Sans Gurmukhi`; Marathi reuses the existing
  Devanagari font), verified live via a real font-file network fetch and
  computed `font-family`. See `docs/DECISIONS.md` ADR-034 for the full
  evidence.
- **Last updated:** 2026-09-28 (Phase 6 Milestone 6h: evaluated Bengali,
  Tamil, Telugu, and Kannada across langid/LLM/ASR/TTS, the same process
  Milestones 6b/6c/6d/6f established. **LLM**: fluent, on-topic, correct
  script for all four, 4/4 each — no code change needed, the same
  generic-prompt result Malayalam had (ADR-028). **langid**: 100%
  accurate for all four (16/16) — tied with Malayalam for the strongest
  result measured, since each has its own unambiguous Unicode script
  block. **ASR/TTS**: real, uneven, language-specific quality gaps, not
  a capability gap — Tamil measured best (WER 0.36 real-audio / 0.34
  TTS-proxy), Kannada's real-audio ASR was reasonable (0.42) but its
  `mms-tts-kan` TTS candidate showed an actual synthesis breakdown (proxy
  WER 1.00, repetitive-syllable gibberish, not just mispronunciation),
  and Bengali/Telugu both measured poorly two independent ways (~0.83-
  0.94 across real-audio ASR and TTS-proxy alike, converging evidence of
  a genuine weakness). None meet `docs/EVALUATION.md`'s targets, but all
  four are in the same "ship with a known, non-fatal quality gap" class
  Malayalam/Hinglish already shipped in — recommendation put to the user
  rather than decided silently, per `AGENTS.md` §14, and **accepted: all
  four enabled** in `language.model.ts`. This surfaced a real gap none of
  the four had a self-hosted, script-specific font the way Devanagari/
  Malayalam already do, so their chat replies would have silently
  rendered in the generic Latin stack — fixed the same way Malayalam was
  (four new self-hosted Noto Sans fonts, SIL OFL 1.1, four new `[lang=]`
  rules), verified live via a real network request and computed
  `font-family` per language, not assumed from unit tests alone. See
  `docs/DECISIONS.md` ADR-033 for the full evidence.
  **Also that day**: found and fixed a real, independent, previously-
  live bug while evaluating Odia for this same batch — `ai-services`'s
  `_WHISPER_LANGUAGE_HINTS` incorrectly asserted Odia (`"or"`) is a valid
  Whisper language; it isn't (confirmed directly against `faster_whisper.
  tokenizer._LANGUAGE_CODES`), and the incorrect entry would have raised
  an opaque `500` (not Maithili's clean `400`) the first time anyone
  actually requested Odia voice input. Fixed at the source and generalized
  the Go-layer guard (`dto.go`'s `maithiliLanguage` constant is now a
  `noASRLanguages` set covering both `mai` and `or`) so the same bug
  class can't recur for a future language silently.
  Earlier that day (Milestone 6g, paused): tested whether a strengthened
  system prompt could fix Maithili's LLM-generation gap (ADR-031) —
  negative, `llama-3.2-3b-instruct` still replied in Hindi 0/4 times,
  identical to the unmodified prompt. Tested the two other
  already-benchmarked LLM candidates (Qwen2.5-3B, Gemma-2-2B) against an
  expanded 8-fixture Maithili set — an initial small-sample read looked
  promising for Gemma (real Maithili copula grammar in 2 of 4 replies),
  but the larger sample showed neither alternate model is usable: both
  frequently produced incoherent text or drifted into a third language
  entirely (Qwen into Nepali, Gemma into Marathi) — worse than Llama's
  clean, fluent, wrong-language fallback, not better. Swapping the
  selected LLM is not a fix. Searched for a Maithili-capable ASR engine:
  found two real, MIT-licensed, transformers-compatible candidates from
  credible sources (AI4Bharat, ARTPARK-IISc), one of which
  (`indic-conformer`) explicitly supports a per-language hint the way
  this project's architecture needs and could also close Odia's gap —
  both are gated on Hugging Face, the same real obstacle ADR-021 already
  hit with `indic-parler-tts`. Paused here, not concluded, when the user
  directed a pivot to evaluating the other languages instead.
  The day before (2026-09-27): Phase 6 Milestone 6f: Maithili added to
  `AGENTS.md`/`docs/PROJECT_GOAL.md`'s long-term language list at the
  user's request, then wired into the same per-language scaffolding
  every prior language uses and measured for real across all four
  capabilities — **not enabled**. **LLM**: `llama-3.2-3b-instruct`
  understood every Maithili prompt correctly but replied in standard
  Hindi every time (0/4 language fidelity) — categorically different
  from Malayalam's "fluent, on-topic" result (ADR-028); comprehension
  works, generation doesn't. **langid**: real but weak — the
  already-selected `fasttext-lid176` scored 50% (2/4) on Maithili,
  confusing it with Nepali and Hindi in short phrases. **TTS**: a real
  candidate, `facebook/mms-tts-mai`, was found, downloaded, and
  benchmarked — proxy WER 100-150%, the same failure range Malayalam's
  own TTS candidate hit (ADR-028). **ASR**: a genuine capability gap, not
  an accuracy one — `faster-whisper` has no Maithili language code at
  all, and (checked directly, not assumed) this project's own engine
  wrapper silently falls back to wrong-language auto-detection for an
  unmapped code rather than erroring, so `/voice/turn` and
  `/speech/transcribe` now explicitly reject `"mai"` with a clean 400.
  Unlike Hinglish/Malayalam's "ship anyway" precedent (ADR-020/ADR-028),
  the failure here is in the *primary* typed-chat channel, not a
  secondary one — `LANGUAGE_OPTIONS`'s `mai.enabled` stays `false`
  pending the user's explicit call. See `docs/DECISIONS.md` ADR-031.
  The day before (2026-09-25): Phase 6 Milestone 6e: auto-detection now
  drives typed-chat behavior — the deferred half of ADR-026. `POST
  /api/v1/chat`'s `language` field accepts a new `"auto"` sentinel;
  `conversation.Service.SendMessage` resolves it to the message's own
  detected language (reusing the detection call already made for
  `detectedLanguage`, no second `langid` call) before the LLM runs,
  falling back to Hindi if detection fails or returns a language outside
  the 12 supported codes. A manual, concrete `language` is unaffected.
  Frontend: a new, persisted, **opt-in, off-by-default**
  `SettingsStore.autoDetectLanguage` toggle — existing users see zero
  behavior change unless they turn it on — surfaced as a new
  "Auto-detect" entry in both the header language selector and the
  Settings page, above the 12 language options. `speakReply` already read
  the backend-returned turn's language rather than `SettingsStore` again,
  so TTS voice selection auto-corrects with no TTS code change at all.
  Fixed one real bug this surfaced along the way: the optimistically-
  appended user turn would otherwise have displayed the literal string
  `"auto"` as its language, permanently (it was never reconciled with the
  server's response) — now it shows the current pin as a placeholder and
  gets swapped for the server-resolved turn once the response arrives.
  Deliberately **typed chat only**: `/voice/turn`, `/speech/transcribe`,
  and `/speech/synthesize` all explicitly reject `"auto"` with a clean
  400 — ADR-018 already found that un-hinted Whisper auto-detection
  mistranscribes romanized Hinglish into the wrong script, a real,
  separate problem deliberately left unsolved rather than worked around.
  See `docs/DECISIONS.md` ADR-030.
  The day before (2026-09-25, earlier): Phase 6 Milestone 6d closed two known
  gaps, on explicit direction. **Hinglish TTS** — total failure since
  ADR-021 — now transliterates romanized Hindi to Devanagari (ITRANS,
  `indic-transliteration`) before synthesis: both Hindi voices now
  produce real audio for 100% of Hinglish fixtures (was 0%), though word
  accuracy stays poor for the genuinely English-mixed portions (an
  accepted, inherent limit of rule-based transliteration, not a bug).
  **Malayalam** — a real diagnostic, not just a guess: downloaded five
  real, human-recorded clips from Google's IndicTTS Malayalam corpus
  (OpenSLR 63, CC-BY-SA-4.0) and ran the already-selected
  `faster-whisper-large-v3-turbo` against them directly, with no TTS
  involved. Result: mean WER **0.96** on real speech — nearly as bad as
  the TTS proxy's 100-150%, meaning Whisper's own Malayalam recognition
  is a real, independent weak point, not just `mms-tts-mal`'s synthesis
  quality. One of five clips was transcribed entirely into **Devanagari**
  script instead of Malayalam despite the language being forced — a
  genuine script-confusion bug specific to Malayalam. No further fix is
  available within this project's existing tools (no better Malayalam
  TTS or ASR candidate has been found or benchmarked) — this is a
  properly diagnosed, honestly recorded root cause, not a resolved
  metric. See `docs/DECISIONS.md` ADR-029.
  The day before (2026-09-25, earlier): Phase 6 Milestone 6c enabled
  Malayalam end to end. `models.yaml`'s `tts.selected` gained a real language axis
  (`{language: {voice: key}}`, was flat `{voice: key}`) — the piece
  `docs/ARCHITECTURE.md` §3.6 called "later each language" but never
  built — with `facebook/mms-tts-mal` added as Malayalam's TTS candidate.
  Real, measured evidence per capability: langid **100% accurate** for
  both candidates (Malayalam's own Unicode block makes it trivially
  distinguishable — the strongest language-detection result in this
  project so far); the already-selected LLM produces fluent, on-topic
  Malayalam with no code change needed; TTS fails badly (proxy WER
  100-150% against the <10% target — `facebook/mms-tts-mal` was the only
  viable candidate found, no macOS system voice exists for Malayalam
  either, so this is the only, circularity-caveated Malayalam ASR+TTS
  evidence available). This surfaced a real policy question — put to the
  user rather than decided silently (`AGENTS.md` §14): `docs/ROADMAP.md`'s
  literal Definition of Done says a failing threshold keeps a language
  disabled, but Hinglish already ships enabled despite its own TTS
  failing completely. The user chose to enable Malayalam, consistent with
  the Hinglish precedent (a TTS failure degrades non-fatally, per
  ADR-020). Self-hosted Malayalam typography added
  (`Noto Sans Malayalam`, SIL OFL 1.1). Verified live end to end: `POST
  /api/v1/chat` with Malayalam text returns a real Malayalam reply
  (`script: "Malayalam"`, `detectedLanguage: "ml"`), and both
  `POST /v1/synthesize` (direct) and `POST /api/v1/speech/synthesize`
  (via Go) return real synthesized Malayalam audio. See
  `docs/DECISIONS.md` ADR-028 for full reasoning and numbers.
  The day before (2026-09-25, earlier): Phase 6 Milestone 6b built the real Python
  `langid` capability — `ai-services/app/engines/langid/` with two real
  candidates benchmarked, `IndicLIDEngine` (`ai4bharat/IndicLID`, MIT) and
  `FastTextLIDEngine` (the original `lid.176.bin`, CC-BY-SA-3.0).
  `fasttext-lid176` selected — a real, counter-intuitive result: it
  measured *higher* accuracy (75% vs 50% on this project's 8-fixture set)
  than the Indic-specific `indiclid` candidate, and neither correctly
  classified either Hinglish fixture, a real gap recorded honestly rather
  than hidden. `HTTPLangIDClient` (built in Milestone 6a) is now wired to
  this real service; verified live end to end through `POST /api/v1/chat`
  with `usesFakeLangID:false`. See `docs/DECISIONS.md` ADR-027 for the
  full benchmark evidence, including a real `transformers`-version
  incompatibility found and fixed in `IndicLIDEngine`'s BERT-fallback
  stage. Detection still drives nothing (no LLM prompt, no TTS voice, no
  UI) — that boundary, set in ADR-026, is unchanged.
  The day before (2026-09-25, earlier): Phase 6 Milestone 6a built the Go
  `langid` capability boundary against a placeholder heuristic
  (`FakeLangIDClient`) — see ADR-026.
  Before that (2026-09-24): ADR-025 gave the mic button an automatic
  silence-based auto-stop — the user asked for it to detect automatically
  when they've finished speaking. A real, benchmarked VAD model is Phase
  11's scope (ADR-017), so this is deliberately narrower: a coarse
  client-side amplitude heuristic in `AudioCaptureService` (Web Audio API,
  no model), wired into the same `stopListeningAndSend()` path manual tap
  and the 30s max-duration timer already use. Feature-detected — falls
  back to manual tap-to-stop if the browser has no usable Web Audio API.
  Also that day: Phase 5 landed a real Go turn orchestrator
  (`backend/internal/orchestrator`, `POST /api/v1/voice/turn`), verified
  live end to end against real recorded audio, with a known,
  documented latency gap (measured p50 5.09s against a <3s target —
  see `docs/DECISIONS.md` ADR-024); Phase 4 gained a real Female/Male
  voice choice (ADR-022/ADR-023). See `docs/DECISIONS.md`
  ADR-020 through ADR-031 and `docs/ROADMAP.md` Phases 4/5/6 for that full
  history, including the still-open Hinglish English-loanword and langid
  detection gaps, the still-open Malayalam ASR/TTS gap (now properly
  diagnosed, not just measured), and the still-gated
  `ai4bharat/indic-parler-tts` candidate)

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
- **Phase 5 — Go turn orchestrator, End-to-End Voice MVP:**
  - `backend/internal/orchestrator` (new package): `Orchestrator.RunTurn`
    composes the three already-existing capability clients
    (`asr.ASRClient`, `ConversationService`, `tts.TTSClient`) into one
    transcribe -> think -> speak sequence — no new capability, pure
    composition. A synthesis failure is non-fatal (`SynthesisFailed`
    flag, `Audio` stays nil) — ADR-020's "voice is additive" rule, moved
    from Angular into Go. Per-stage wall-clock latency
    (`TranscribeMs`/`ThinkMs`/`SpeakMs`) is captured and returned.
  - `POST /api/v1/voice/turn` (`docs/openapi/voice.yaml`, new): raw audio
    body + `language`/`voice` query params in, one JSON response —
    `{userTurn, assistantTurn, audio: {contentType, base64} | null}` —
    out. Chosen over multipart or a second follow-up call so the whole
    turn stays one HTTP round trip (docs/DECISIONS.md ADR-024). The
    existing `/chat`, `/speech/transcribe`, `/speech/synthesize`
    endpoints are unchanged and still used elsewhere.
  - Frontend: `mic-button.ts` now calls
    `ConversationService.sendVoiceTurn(blob, language, voice)` — one
    call, replacing the transcribe-then-sendUserTurn sequence that used
    to live in the component itself
    (`docs/ARCHITECTURE.md` §4 forbids orchestration logic in Angular).
    `SpeechService` is no longer a `MicButton` dependency.
    `ConversationRealService` decodes the returned base64 audio and
    plays it; `ConversationMockService` gained a trivial stub (no real
    ASR) purely so the abstract `ConversationService` contract compiles.
  - `docker-compose.yml`: `ai-services` gained a `/healthz`-based
    healthcheck (it had none, despite exposing the endpoint); `backend`'s
    `depends_on.ai-services` condition changed from `service_started` to
    `service_healthy`, so backend can no longer come up before models
    finish loading. Not run for real — Docker remains unavailable in this
    environment; fixed and verified by code review only.
  - Tests: 6 new Go tests in `internal/orchestrator` (happy path, ASR
    failure, no-speech, LLM failure, non-fatal TTS failure, latency
    fields) plus 8 new `internal/api` handler tests for
    `/api/v1/voice/turn`; 4 new frontend tests
    (`ConversationRealService.sendVoiceTurn` success/no-audio/failure,
    `MicButton`'s single-call flow). All pass; `go build/vet/test`,
    `gofmt`, `golangci-lint`, `ng test/lint/build` all clean.
  - **Verified live, end to end, against real recorded audio** (all 8
    `ai-services/eval_data/asr_fixtures.yaml` fixtures, not simulated): a
    real Hindi utterance produces a real transcript, a real
    context-appropriate LLM reply, and real synthesized audio, in one
    call; a Hinglish request correctly returns 200 with
    `synthesisFailed: true` and no audio, degrading to text-only rather
    than failing — the same known gap ADR-021 already documented,
    reconfirmed here rather than newly discovered.
  - **Known gap, not blocking (see `docs/DECISIONS.md` ADR-024 for the
    full measured breakdown):** real p50 end-to-end latency across those
    8 live calls is **5.09s** (mean 5.50s, p95 ~8.85s) against
    `docs/EVALUATION.md`'s "p50 < 3s non-streaming MVP" target — not met.
    Per-request stage timing shows `faster-whisper-large-v3-turbo`
    transcription alone takes ~4.0-4.3s, already exceeding the whole
    budget before the LLM (0.28-2.77s) or TTS (0-1.9s) stage runs. This
    is ADR-018's already-known ASR latency, now shown for the first time
    to be the dominant bottleneck against a real end-to-end target;
    closing it means reopening ADR-018's accuracy-vs-latency tradeoff
    with new evidence, which this phase deliberately does not do.
    Flagged for a future phase (most likely Phase 11's streaming work).
- **Silence-based mic auto-stop (ADR-025):** `AudioCaptureService.start()`
  gained an optional `onAutoStop` callback — a coarse, non-ML amplitude
  heuristic (Web Audio API `AnalyserNode`, no model), not the real VAD
  model Phase 11 owns. Fires once, at most, when real speech has been
  heard followed by ~1.5s of continued silence, wired into
  `mic-button.ts`'s existing `stopListeningAndSend()` path — the same
  handler manual tap and the 30s max-duration timer already use.
  Feature-detected: falls back to manual tap-to-stop only, with no
  behavior change, when the browser has no usable Web Audio API. 6 new
  tests in `audio-capture.service.spec.ts` (fires after
  speech-then-silence; never fires on silence alone; fires at most once;
  torn down by `stop()`/`cancel()`; still works with no `AudioContext`)
  plus 1 in `mic-button.spec.ts`. `ng lint`/`test`/`build` all clean.
- **Phase 6, Milestone 6a - Go `langid` capability boundary:**
  - `backend/internal/langid` (new package, mirrors `internal/asr`/
    `internal/tts` exactly): `LangIDClient` interface
    (`Detect(ctx, DetectRequest{Text}) (DetectResponse{Language,
    Confidence}, error)`), `FakeLangIDClient` (in use now — a
    self-contained Devanagari-vs-not Unicode check, not a language-ID
    algorithm), `HTTPLangIDClient` (built now, wired to a real service
    only in Milestone 6b). `proto/langid.openapi.yaml` records the
    Go<->Python contract, written before the Python side exists.
  - Wired into `internal/conversation.Service.SendMessage` — not the
    Phase 5 orchestrator — right alongside the existing `DetectScript`
    call, for both the user's text and the LLM's reply, on every turn,
    typed or spoken. One integration point covers both `/chat` and
    `/voice/turn` (the orchestrator already calls `SendMessage`
    unchanged). `Service` gained a `logger` field (it previously logged
    nothing itself) so a detection failure is observable; the failure
    itself is always non-fatal to the turn (same "additive" rule ADR-020
    established for TTS).
  - New migration `0003_add_detected_language.sql`
    (`turns.detected_language`, nullable); `internal/db` regenerated via
    `sqlc generate`. Returned over the API as
    `turnDTO.detectedLanguage`/`docs/openapi/chat.yaml`, and carried
    through (unused) in the frontend's `Turn` model — the same "compute
    and carry, don't render yet" pattern `script` followed before any UI
    used it. Does **not** yet drive the LLM prompt language, the TTS
    voice, or any UI, per `docs/PROJECT_GOAL.md`'s "a manual language pin
    always wins over auto-detection."
  - `config.Config` gained `LangIDServiceURL`/`UsesFakeLangID`, mirroring
    `TTSServiceURL`/`UsesFakeTTS` exactly; `cmd/api/main.go` wires the fake
    client (no `VAANISETU_LANGID_SERVICE_URL` set — no Python `langid`
    capability exists yet).
  - Tests: 8 new Go tests in `internal/langid` (fake + HTTP client
    behavior, including the fake's honest inability to distinguish
    Hinglish from English) plus 2 new Docker-gated integration tests in
    `internal/conversation` (detected-language round-trip; a langid
    failure doesn't fail the turn). All pass; `go build/vet/test`,
    `gofmt`, `golangci-lint` clean. Frontend model/service changes:
    `ng lint`/`test`/`build` clean, no new tests needed (no new logic,
    just a wire field carried through).
- **Phase 6, Milestone 6b - Python `langid` capability, benchmark, and
  real wiring:**
  - `ai-services/app/engines/langid/` (new capability module, hosted in
    the same FastAPI process as `llm`/`asr`/`tts` per ADR-017):
    `LangIDEngine` interface with two real implementations —
    `IndicLIDEngine` (`ai4bharat/IndicLID`'s full three-stage pipeline:
    character-percent script routing -> native/romanized fastText model
    -> a BERT fallback for low-confidence romanized predictions) and
    `FastTextLIDEngine` (the original `lid.176.bin`). `app/main.py` now
    loads all four capabilities at startup and implements
    `proto/langid.openapi.yaml`'s `POST /v1/detect`; `/healthz` reports
    all four models.
  - Model registry gained a `langid` section in `ai-services/models.yaml`
    (`ModelEntry` gained `download_url`/`download_urls`/`bert_tokenizer`
    for direct-URL, non-HF-repo downloads); `scripts/download_models.py`
    gained matching direct-URL single-file and zip-plus-HF-tokenizer
    download paths.
  - Benchmark (`ai-services/scripts/benchmark_langid.py`) reuses
    `eval_data/asr_fixtures.yaml`'s text/language set and measures
    per-language accuracy plus a Hindi/English/Hinglish confusion matrix
    (`docs/EVALUATION.md` §2's documented metric). Full results in
    `ai-services/benchmark_results/langid_milestone_6b.json`.
  - `fasttext-lid176` selected — a real, counter-intuitive result:
    75% (6/8) overall accuracy versus `indiclid`'s 50% (4/8), verified by
    hand against the raw downloaded models (IndicLID's own native-script
    model confidently mispredicted two Hindi fixtures as Maithili/Dogri;
    its romanized model confidently mispredicted both Hinglish fixtures as
    romanized Bengali/Nepali). **Neither candidate correctly classified
    either Hinglish fixture** — `fasttext-lid176` predicted English at low
    confidence for both (expected: no code-mixed class exists in its
    label space), a real, honestly-recorded gap, not hidden. See
    `docs/DECISIONS.md` ADR-027 for the full evidence, reasoning, and a
    real `transformers`-version incompatibility found and fixed along the
    way (`IndicLID-BERT`'s pickled checkpoint was missing an attribute
    only set in `__init__`, which unpickling skips — fixed by copying it
    from the loaded model's own config right after `torch.load`).
  - `HTTPLangIDClient` (already built in Milestone 6a) is now wired to a
    real service: setting `VAANISETU_LANGID_SERVICE_URL` on the backend
    switches it from `FakeLangIDClient` with no code change.
  - `docker-compose.yml`'s `ai-services` environment gained
    `VAANISETU_LANGID_MODEL_STORE`; `backend`'s
    `VAANISETU_LANGID_SERVICE_URL` now points at it too (the existing
    `./models` mount already covers `models/langid/`).
  - Tests: 16 new Python tests (`IndicLIDEngine`/`FastTextLIDEngine`
    request/response and dispatch-logic tests against fake underlying
    fasttext/torch objects; `/v1/detect` contract tests; registry tests
    for the two new engine kinds and their download-field variants) — 75
    total, all pass; `ruff check`/`ruff format --check` clean.
  - **Verified live, end to end:** the AI service loads all four models
    and reports all ready; a direct `POST /v1/detect` call correctly
    classifies real Hindi and English text (and reproduces the documented
    Hinglish gap); with the Go backend pointed at it
    (`usesFakeLangID:false` in its startup log), a real `POST
    /api/v1/chat` call returns a genuine `detectedLanguage` for both
    Hindi (`"hi"`) and Hinglish (`"en"`, the known gap) input — the full
    chain, actually run and inspected, not just unit-tested.
  - `ai-services/pyproject.toml` gained `fasttext` and `requests`
    (`torch`/`transformers` already present since Milestone 4b) as
    runtime/dev dependencies respectively. `ai-services/SETUP.md` and
    `docker-compose.yml` updated accordingly.
- **Phase 6, Milestone 6c - Malayalam enabled end to end:**
  - `ai-services/models.yaml`'s `tts.selected` gained a real language axis
    (`{language: {voice: key}}`, was flat `{voice: key}` since ADR-023) —
    `docs/ARCHITECTURE.md` §3.6's "later each language" piece, never
    built until now. `app/registry.py`'s `load_selected_entry` gained a
    `language` parameter for `tts`; a new `tts_languages()` helper reads
    the configured set from config, not a hardcoded list. `app/main.py`'s
    startup loop now loads one engine per `(language, voice)` pair,
    de-duplicated by candidate key (Hindi/Hinglish share the same
    checkpoints, loaded once). An unconfigured language now gets a clean
    `400`, not a silent, confusing route into the Hindi engine.
  - `facebook/mms-tts-mal` (CC-BY-NC-4.0) added as Malayalam's TTS
    candidate — the only viable one found (other Malayalam TTS projects
    surveyed use unrelated architectures that would need new engine
    wrappers and dependencies for unverified quality). Both "female" and
    "male" voice keys point at the same engine — one real Malayalam
    voice, a real asymmetry with Hindi's two.
  - Real, measured evidence per capability (four new `ml-*` fixtures in
    `eval_data/asr_fixtures.yaml`, no macOS system voice exists for
    Malayalam so they carry no independent audio):
    - **langid: 100% accurate**, both candidates — the strongest
      language-detection result measured in this project, since
      Malayalam's own Unicode block makes it unambiguous.
    - **LLM: fluent, on-topic Malayalam**, no code change needed —
      `llama_cpp_engine.py`'s language-name mapping and system prompt
      were already written generically for every `LanguageCode`.
    - **TTS: fails badly** — proxy WER (synthesize -> transcribe with the
      already-selected ASR -> compare) measured 100-150% against the
      <10% target. The only available Malayalam ASR+TTS evidence, and a
      real, stated circularity (no independent recording exists to
      isolate which component is at fault).
  - This surfaced a genuine policy conflict, put to the user rather than
    decided silently (`AGENTS.md` §14): `docs/ROADMAP.md`'s literal
    Definition of Done keeps a language disabled if any threshold fails,
    but Hinglish already ships enabled despite its own TTS failing
    *completely* (ADR-021), because TTS failure is non-fatal by design
    (ADR-020). The user chose to enable Malayalam, matching the Hinglish
    precedent — `frontend/.../language.model.ts`'s `ml.enabled` is now
    `true`. See `docs/DECISIONS.md` ADR-028 for the full reasoning.
  - Self-hosted `Noto Sans Malayalam` (SIL OFL 1.1,
    `public/fonts/OFL-Malayalam.txt`) added alongside the existing
    Devanagari font; `message-bubble.ts`'s `langAttr` (previously a
    single Hindi-only ternary) generalized to a small set lookup.
  - Tests: 7 new Python tests (registry language-axis coverage,
    `/v1/synthesize`/`/healthz` nested-shape contract tests) — 82 total,
    all pass; `ruff check`/`ruff format --check` clean. 1 new frontend
    test (Malayalam `lang` attribute) — 136 total, all pass; `ng
    lint`/`build` clean. No Go source change — `language`/`voice` were
    already required, validated, end-to-end fields.
  - **Verified live, end to end:** `/healthz` reports the new nested
    `tts_models` shape correctly; a direct `POST /v1/synthesize` call
    with Malayalam text and language returns real, valid, non-silent
    audio; requesting an unconfigured language (e.g. Bengali) now returns
    a clean `400` instead of a confusing in-engine failure; with the Go
    backend pointed at the real service, a real `POST /api/v1/chat` call
    with Malayalam text returns a genuine Malayalam reply tagged
    `script: "Malayalam"` and `detectedLanguage: "ml"`, and both `POST
    /v1/synthesize` (direct) and `POST /api/v1/speech/synthesize` (via
    Go) return real synthesized Malayalam audio.
- **Phase 6, Milestone 6d - Hinglish TTS fixed via transliteration;
  Malayalam's real bottleneck diagnosed:**
  - `MmsVitsEngine.synthesize()` now transliterates `hinglish`-language
    text from romanized Hindi to Devanagari (ITRANS scheme, new
    `indic-transliteration` dependency, MIT) before tokenizing, instead
    of immediately raising `UnsupportedTextError` for every Hinglish
    request. No other language is transliterated.
  - Real result: both Hindi voices went from **0% to 100%** of Hinglish
    fixtures producing real audio (a genuine crash-to-audio fix).
    Word-level quality stays poor (WER ~1.0-1.25) specifically because
    both fixtures mix in genuine English words ("weather", "joke") that
    transliterate to meaningless Devanagari phonemes — an accepted,
    inherent limit of a rule-based scheme, not a bug, stated up front
    before implementation.
  - Built the project's **first real, human-recorded audio fixture set**:
    `eval_data/malayalam_real_fixtures.yaml` (five short utterances from
    Google's IndicTTS Malayalam corpus, OpenSLR resource 63,
    CC-BY-SA-4.0), downloaded on demand by
    `scripts/download_malayalam_real_fixtures.py` (~710MB one-time, never
    committed — a dataset, per `AGENTS.md` §12).
    `scripts/benchmark_malayalam_real_asr.py` ran the already-selected
    `faster-whisper-large-v3-turbo` directly against this real audio, no
    TTS involved.
  - **Real, important finding**: mean WER on real Malayalam speech was
    **0.96** — nearly as bad as Milestone 6c's TTS proxy WER
    (100-150%). This means `faster-whisper-large-v3-turbo`'s own
    Malayalam recognition is a genuine, independent weak point, not
    primarily `mms-tts-mal`'s synthesis quality as Milestone 6c's proxy
    metric alone suggested. One of five real clips was transcribed
    entirely into **Devanagari script** instead of Malayalam despite
    `language="ml"` being forced — a genuine script-confusion limitation
    specific to Malayalam (Hindi/English don't show this, ADR-018). No
    further fix is available within this project's existing tools (no
    better Malayalam ASR or TTS candidate has been found/benchmarked) —
    this milestone's honest deliverable is a properly diagnosed root
    cause, not a resolved metric.
  - Tests: 2 new + 1 fixed Python tests in `test_mms_vits_engine.py`
    (transliteration-path coverage; one existing test's `language` moved
    from `"hinglish"` to `"en"` since it no longer represents genuinely
    unsupported text) — 84 total, all pass; `ruff check`/`ruff format
    --check` clean. No Go or frontend change.
  - **Verified live, end to end:** `POST /v1/synthesize` with real
    Hinglish fixture text now returns a valid, non-silent WAV (was a
    500); Hindi and Malayalam synthesis unaffected.
  - See `docs/DECISIONS.md` ADR-029 for full reasoning, real numbers, and
    alternatives considered (including why the heavier neural
    `ai4bharat-transliteration` and re-requesting `indic-parler-tts`'s
    gated access were not pursued this milestone).
- **Phase 6, Milestone 6e - auto-detection drives typed-chat behavior,
  opt-in:**
  - `backend/internal/conversation`: new `resolveLanguage(language,
    detected)` resolves the `"auto"` sentinel to a real, supported
    language — reusing the `detectLanguage` call `SendMessage` already
    made for `Turn.DetectedLanguage`, not a second `langid` call —
    falling back to a `defaultLanguage` constant (`"hi"`) when detection
    failed or returned a `fasttext-lid176` label outside this app's 12
    supported codes. `Turn.DetectedLanguage` keeps recording the raw,
    unclamped result regardless. A manual, concrete `language` is
    completely unaffected.
  - `backend/internal/api`: `isValidLanguage` now also accepts `"auto"`;
    `handleVoiceTurn`, `handleTranscribe`, and `handleSynthesize` each
    gained an explicit rejection (`400 invalid_request`) so the new,
    more permissive check can't silently let `"auto"` reach any of the
    three endpoints that need a concrete language.
  - `docs/openapi/chat.yaml`: `"auto"` documented as an accepted
    `ChatRequest.language` value (with a new example); the
    `detectedLanguage` doc comment — stale since Milestone 6a, still
    describing the original placeholder heuristic — corrected to
    describe the real `fasttext-lid176` model (ADR-027).
    `docs/openapi/voice.yaml`: explicit note + 400 case that `"auto"` is
    rejected.
  - Frontend: `SettingsStore` gained a persisted, **opt-in, off by
    default** `autoDetectLanguage` signal and a computed
    `effectiveChatLanguage()` (`"auto"` when on, else the pinned
    `preferredLanguage`) — only `text-input-bar.ts` reads it;
    `mic-button.ts` is unchanged (comment only), since voice-turn
    auto-detection is out of scope (see Reason below). The header
    `LanguageSelector` and the Settings page's `LanguagePreferences` each
    gained one new "Auto-detect" entry above the 12 language options;
    picking it sets `autoDetectLanguage(true)` without touching the
    stored pin, so turning it back off restores the last concrete
    choice. `speakReply` already read the backend-*returned* turn's
    language rather than `SettingsStore` again, so TTS voice selection
    auto-corrects with no TTS code change at all.
  - **A real bug fixed along the way, not optional polish**:
    `ConversationRealService.sendUserTurn` appends the user's turn to
    the UI optimistically, before the backend responds. Passing the raw
    `"auto"` value straight into that optimistic turn's `language` would
    have made `message-bubble.ts` render the literal string `"auto"` —
    and since that turn was never previously reconciled with the
    server's response, it would have stayed wrong permanently. Fixed by
    showing the current `preferredLanguage()` pin as a placeholder
    instead (never the literal `"auto"` — `Turn.language` is typed
    `LanguageCode` and never includes it), and adding a `replaceTurn`
    step that swaps that placeholder for the server's resolved turn once
    the response arrives.
  - **Deliberately typed-chat only**: `POST /voice/turn` (and
    `/speech/transcribe`, `/speech/synthesize`) reject `"auto"` outright.
    ADR-018 already found that letting Whisper auto-detect the spoken
    language transcribes romanized Hinglish into the wrong script —
    voice auto-detection needs the language *before* transcription even
    runs, a real, separate, harder problem left unsolved on purpose
    rather than worked around.
  - Tests: new Go unit tests for `resolveLanguage` (no Docker needed) in
    a new `conversation_test.go`; 3 new Docker-gated integration tests in
    `conversation_integration_test.go` (auto resolves to a real detected
    language; falls back to the default on a detection failure; a
    manual pin is provably unaffected); 4 new `internal/api` handler
    tests (`/chat` accepts `"auto"`; `/voice/turn`, `/speech/transcribe`,
    `/speech/synthesize` each reject it with a clean 400). All Go tests
    pass; `go build/vet/test`, `gofmt` clean (`golangci-lint` not
    installed in this environment, same as prior milestones). New/updated
    frontend tests for `SettingsStore`, `LanguageSelector`,
    `LanguagePreferences`, `TextInputBar`, and `ConversationRealService`
    (including the optimistic-turn placeholder/reconciliation fix) — 143
    total, all pass; `ng lint`/`build` clean.
  - **Verified live, end to end** against the real, already-running
    `ai-services` stack and a native `backend` (all four capabilities
    real, `usesFake*:false`): `POST /api/v1/chat` with
    `language: "auto"` and English text resolves to `userTurn.language:
    "en"`/`assistantTurn.language: "en"` with a genuine, on-topic English
    LLM reply; the same request with Hindi (Devanagari) text resolves to
    `"hi"` with a genuine Hindi reply. A manual `language: "hi"` pin sent
    alongside English text stays `"hi"` throughout (`detectedLanguage`
    still honestly records `"en"`) — proving a pin is unaffected by
    auto-resolution. `POST /voice/turn`, `/speech/transcribe`, and
    `/speech/synthesize` each returned a clean 400 for `language=auto`,
    not a crash. `POST /speech/synthesize` with the auto-resolved `"hi"`
    produced a real, valid, non-silent WAV.
  - **A real, honest finding from this live check, not a regression**:
    `POST /speech/synthesize` with the auto-resolved `"en"` returned
    `502 tts_unavailable` — English has no configured TTS voice at all
    (`/healthz`'s `tts_models` only lists `hi`/`hinglish`/`ml`); the
    frontend's language selector never exposes "en" as a pin, so this
    path was previously unreachable in practice. Auto-detection makes it
    newly reachable for genuinely English typed text. Non-fatal by
    design (ADR-020, the same precedent Hinglish TTS already set before
    ADR-029 fixed it) — the chat turn itself still fully succeeds, only
    that turn's spoken output silently doesn't happen. Not fixed this
    milestone; flagged below.
  - See `docs/DECISIONS.md` ADR-030 for full reasoning and alternatives
    considered (including why default-on and wiring `/voice/turn` too
    were both rejected this milestone).
- **Phase 6, Milestone 6f - Maithili: real evidence gathered, not
  enabled:**
  - Maithili was added to `AGENTS.md`/`docs/PROJECT_GOAL.md`'s long-term
    language list at the user's request, then wired into the exact same
    per-language scaffolding every prior language uses:
    `backend/internal/api/dto.go`'s `validLanguages`,
    `internal/conversation`'s `supportedLanguages`,
    `docs/openapi/chat.yaml`'s `LanguageCode` enum, the frontend's
    `LanguageCode` union (net-new, unlike the other still-disabled
    languages, which were already listed) + `LANGUAGE_OPTIONS` (added
    disabled), the compiler-forced `Record<LanguageCode, string>`
    cascades in `example-prompt.model.ts`/`conversation.mock.service.ts`,
    the `[lang='mai']` Devanagari font rule (Maithili uses the same
    script as Hindi — no new font needed), and a new `mms-tts-mai`
    candidate in `ai-services/models.yaml`.
  - **Measured all four capabilities for real, not assumed** — the same
    rigor every prior language got:
    - **LLM: fails outright.** `llama-3.2-3b-instruct` understood every
      Maithili prompt correctly (a factual answer, an on-topic story, an
      appropriate greeting) but replied in standard Hindi every single
      time — 0/4 language fidelity, against `docs/EVALUATION.md` §3's
      >95% target. Categorically different from Malayalam's "fluent,
      on-topic" result (ADR-028): comprehension works, generation
      doesn't. (Also fixed a real gap found along the way:
      `llama_cpp_engine.py`'s `_LANGUAGE_NAMES` map had no `"mai"` entry
      — every language including `ml` needed one added when introduced.)
    - **langid: real, but the weakest result measured with the selected
      model.** Loaded `models/langid/lid.176.bin` directly and confirmed
      it does have a real `mai` label; `fasttext-lid176` (ADR-027)
      scored 50% (2/4) on real Maithili fixtures, confusing it with
      Nepali and Hindi — plausible given how closely related those
      languages are in short phrases.
    - **TTS: a real candidate found, downloaded, and benchmarked —
      fails the same way Malayalam's did.** `facebook/mms-tts-mai`
      (CC-BY-NC-4.0) is real and was actually downloaded and run;
      synthesize-then-transcribe proxy WER measured 100%, 125%, 100%,
      150% (mean 118.75%) against the <10% target — the same 100-150%
      failure range Malayalam's own TTS candidate hit.
    - **ASR: a capability gap, and — checked directly — a silently
      dangerous one.** `faster-whisper` has no `"mai"` language code at
      all (confirmed against its tokenizer and upstream Whisper's own).
      Checked, not assumed: this project's own ASR engine wrapper
      doesn't error on an unmapped code — it silently falls back to
      Whisper's own auto-detection, the exact wrong-script failure mode
      ADR-018 already documented for un-hinted Hinglish. `/voice/turn`
      and `/speech/transcribe` now explicitly reject `"mai"` with a
      clean `400` because of this, rather than letting a request through
      to produce a silently wrong-language transcript.
  - **Not enabled, and why this differs from the Hinglish/Malayalam
    "ship with a known gap" precedent** (ADR-020/ADR-028): that
    precedent was always about a *secondary* channel (voice output, or
    an ASR accuracy weakness) while the *primary* channel — typed chat
    replying in the right language — still worked. Here the primary
    channel is what fails. `LANGUAGE_OPTIONS`'s `mai.enabled` stays
    `false`; the enable/don't-enable call is put to the user explicitly,
    per `AGENTS.md` §14, rather than decided silently either way.
  - Tests: no new Go/Python tests beyond what already generically
    covers this (a deliberate choice, not an oversight — see below); 1
    new frontend test for the `lang="mai"` attribute (mirroring
    Malayalam's) — 144 total, all pass; `ng lint`/`build` clean.
    `go build/vet/test`, `gofmt` clean; new Go handler tests confirming
    `/chat`/`/speech/synthesize` accept `"mai"` and `/voice/turn`/
    `/speech/transcribe` reject it with a clean 400. No new
    `test_registry.py`/`test_main.py` coverage: the existing
    `test_synthesize_dispatches_to_the_requested_language` test already
    proves the language-dispatch mechanism generically (using `"ml"` as
    its example second language); no registry/dispatch code changed
    this milestone, so a `"mai"`-specific copy of that same test would
    have added zero real coverage — `AGENTS.md` §4's anti-duplication
    rule, applied rather than padding the test count.
  - Real, honest provenance note: the plan intended to source benchmark
    text from FLORES-200's `mai_Deva` split (Meta, CC-BY-SA-4.0,
    professionally translated) — every hosting mirror checked
    (`openlanguagedata/flores_plus`, `facebook/flores`) turned out to be
    gated behind Hugging Face authentication unavailable in this
    environment. Fell back to four directly-composed fixtures using
    well-documented Maithili grammar instead, stated explicitly in
    `eval_data/asr_fixtures.yaml` rather than overclaiming a source that
    wasn't actually used — a native-speaker review of these four
    sentences before treating any result above as fully final would be
    a reasonable next step.
  - See `docs/DECISIONS.md` ADR-031 for full reasoning, real numbers, and
    alternatives considered.

## Next

- No milestone is currently approved to start. Milestones 6a/6b/6c/6d/6e/6f
  (`langid`, Malayalam end to end, Hinglish TTS fix + Malayalam
  diagnostic, auto-detection driving typed-chat behavior, Maithili
  evidence gathering) are complete; Phase 6's broader scope
  (Bengali/Gujarati/Marathi/Tamil/Telugu/Kannada/Punjabi/Odia — each needs
  this same per-language ASR/TTS/LLM/UI treatment individually) has no
  milestone named or approved yet. Per `AGENTS.md` §5, work does not
  begin on it until the user decides to move the project there.
  **Awaiting a decision, not blocking**: whether to enable Maithili
  anyway despite its LLM never replying in the language (0/4 fidelity,
  ADR-031) — `LANGUAGE_OPTIONS`'s `mai.enabled` stays `false` until the
  user says otherwise. Open follow-ups, none blocking, whenever the user
  wants them: Malayalam's
  diagnosed ASR weakness (mean WER 0.96 on real speech, ADR-029) has no
  available fix within this project's current tools — would need a
  dedicated ASR-candidate re-benchmark for Malayalam specifically, a real,
  separate effort; Hinglish TTS's remaining English-loanword
  mispronunciation could be narrowed further by a real neural
  transliterator (`ai4bharat-transliteration`), rejected this milestone
  for its dependency weight, or by revisiting `indic-parler-tts`'s gated
  access; re-benchmarking `indiclid` for `langid` against a larger fixture
  set, and specifically investigating the still-open Hinglish detection
  gap neither candidate closed (ADR-027); closing the Phase 5 latency gap
  (ADR-024), most likely as part of Phase 11's streaming work; **English
  has no configured TTS voice at all** — newly reachable (not newly
  created) by Milestone 6e's auto-detection for genuinely English typed
  text, verified live to degrade non-fatally (`502 tts_unavailable`, text
  reply unaffected) rather than break the turn, same precedent Hinglish
  TTS set before ADR-029; voice-turn auto-detection (ADR-018's ASR-hint
  problem, ADR-030); and a hands-on browser/microphone/speaker smoke test
  (still not performed by the agent in any phase so far — no interactive
  browser available).

## Not started

- Indian language breadth beyond Hindi/Hinglish/English/Malayalam
  (Bengali, Gujarati, Marathi, Tamil, Telugu, Kannada, Punjabi, Odia) —
  Maithili was evidence-gathered in Milestone 6f (ADR-031) but not
  enabled, so it's tracked under "Next" above, not here
- RAG
- Dataset pipeline
- Evaluation harness
- LoRA / QLoRA fine-tuning
- Real-time streaming
- Production hardening

## Repository reality

- `AGENTS.md`, `docs/`, `LICENSE`, `frontend/`, `backend/`, `proto/`, and
  now `ai-services/` all exist.
- `frontend/` builds, lints, and tests clean (144 tests). Its
  `ConversationService` runs against the real backend
  (`ConversationRealService`); `MicButton` now records audio and sends
  the whole spoken turn through `ConversationService.sendVoiceTurn` in
  one call (Phase 5, ADR-024) — it no longer depends on `SpeechService`
  directly — and auto-stops recording on detected silence (ADR-025),
  falling back to manual tap-to-stop where that's unsupported. A voice
  turn's reply plays back synthesized speech via
  `AudioPlaybackService`, in the user's chosen voice
  (`SettingsStore.preferredVoice`, ADR-023); only `VoiceSessionService`
  still uses a mock (see above).
- `backend/` builds, vets, lints (`golangci-lint`), and tests clean (now
  including `internal/orchestrator`, Phase 5's new package, and
  `internal/langid`, Phase 6 Milestone 6a's new package, now wired to a
  real Python service as of Milestone 6b — Milestone 6c added no Go
  source change at all, since `language`/`voice` were already required,
  validated, end-to-end fields), and has been
  run for real against a live, native PostgreSQL and a live, native
  `ai-services` instance (see above) — a developer following
  `backend/SETUP.md` and `ai-services/SETUP.md` on this machine can
  reproduce both. Its `testcontainers-go`-based Postgres integration tests
  specifically still require a Docker daemon, which remains unavailable in
  this environment — they skip themselves cleanly rather than failing, and
  have not been run for real against a container. `docker-compose.yml`
  itself was fixed (ai-services healthcheck, backend's `depends_on`
  condition — see ADR-024) but likewise not run for real, same Docker
  constraint.
- `ai-services/` builds its dependencies (`uv sync` — `llama-cpp-python`
  compiles from source; `faster-whisper`/`ctranslate2`, `torch`,
  `transformers`, `coqui-tts`, `fasttext`, and `indic-transliteration` use
  prebuilt wheels/compile cleanly or are pure Python; `parler-tts`
  installs from GitHub, no PyPI release), tests (84), lints, and formats
  clean. Its `.venv` targets Python 3.12
  specifically, not this machine's default 3.14 — `tokenizers` has no
  cp314 wheel yet and its sdist fails to build (see
  `ai-services/SETUP.md` Troubleshooting). Its own tests never load a
  real model (fake `LLMEngine`/`ASREngine`/`TTSEngine`/`LangIDEngine`
  implementations are dependency-injected, or fake underlying
  fasttext/torch objects for `IndicLIDEngine`/`FastTextLIDEngine`); all
  four capabilities' selected models actually running have been verified
  separately, live, per above.
- The `docker-compose.yml` stack (postgres + backend + ai-services, now
  covering all four capabilities) has not been run for real — Docker
  remains unavailable in this environment. Each service has instead been
  verified running natively. `backend/Dockerfile` and
  `ai-services/Dockerfile` have not been built. Worth doing on a machine
  with Docker before any milestone is treated as fully verified in every
  respect.
- All four capabilities' models are selected: `llm`
  (`llama-3.2-3b-instruct`, ADR-016), `asr`
  (`faster-whisper-large-v3-turbo`, ADR-018 — now also known, per
  ADR-029, to have a real Malayalam-recognition weakness including
  occasional Devanagari-script confusion), `tts` — as of Milestone 6c,
  a *per-language* map: two simultaneously-loaded voices for `hi`/
  `hinglish` (`female: mms-tts-hin-ft-female`, `male: mms-tts-hin`,
  ADR-021/ADR-022/ADR-023 — Hinglish now produces real audio via
  transliteration, ADR-029, though English-mixed portions still
  mispronounce), one voice (used for both) for `ml` (`mms-tts-mal`,
  ADR-028 — proxy WER 100-150%, now understood via ADR-029 to be at least
  partly an ASR-side weakness, not purely this candidate's synthesis
  quality), and one voice (used for both) for `mai` (`mms-tts-mai`,
  ADR-031 — proxy WER 100-150%, same failure range as Malayalam's;
  configured but not enabled in the UI, since Maithili's LLM result
  fails independently of TTS) — and `langid` (`fasttext-lid176`, ADR-027
  — 100% accurate on Malayalam, 50% on Maithili (ADR-031), its own,
  different Hinglish gap noted above; `indiclid`
  stays listed, unselected, as a real candidate for re-benchmarking).
- `frontend/node_modules/`, `frontend/dist/`, `ai-services/.venv/`, local
  Postgres data, `/models/` (downloaded weights), and
  `ai-services/eval_data/audio/` (generated ASR test fixtures) are all
  git-ignored via the repository's single root `.gitignore`.
- Phase 5's no-egress check was verified by code review, not by an actual
  network capture inside a running container (Docker unavailable here):
  `ai-services` makes no outbound HTTP calls at request time in any
  capability's code path — the only network code (`huggingface_hub`) is
  in dev-only download/benchmark scripts, never imported by `app/main.py`.
