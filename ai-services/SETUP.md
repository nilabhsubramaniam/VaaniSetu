# AI Services Setup (`llm`, `asr`, `tts`, and `langid` capabilities)

Everything below was actually run and verified on this development
machine (Apple M5 Pro, macOS, arm64) while writing this guide. If a step
here ever stops matching reality, trust the code (`app/config.py`,
`app/main.py`) over this file and fix this file.

## Prerequisites

- **Python 3.12, specifically** (`ai-services/pyproject.toml`'s
  `requires-python` says `>=3.12`, but as of Milestone 4b use exactly
  3.12 on this machine — see "Troubleshooting" below for why a newer
  interpreter currently fails).
- [`uv`](https://docs.astral.sh/uv/) (`brew install uv`, or see its docs
  for other platforms).
- ~17GB free disk for every candidate model in `ai-services/models.yaml`
  across all four capabilities (only the `selected` ones are required to
  run the service; download the rest only to re-run a benchmark).
  `langid`'s `indiclid` candidate alone is ~1.3GB (three GitHub Releases
  zips) plus a small HF tokenizer snapshot; `fasttext-lid176` is ~131MB.
  `tts`'s `mms-tts-mal` (Malayalam, Milestone 6c) is a ~293MB HF snapshot,
  same shape as the Hindi `mms_vits` candidates.
- No GPU required. `llama-cpp-python` and `faster-whisper` use Metal
  automatically on Apple Silicon and fall back to CPU elsewhere; the
  `tts` engines run on CPU only in this milestone (see
  `docs/DECISIONS.md` ADR-021 for measured CPU real-time-factor results).

## Install dependencies

```bash
cd ai-services
uv sync
```

This also compiles `llama-cpp-python`'s native extension — expect it to
take a minute or two the first time. `faster-whisper`/`ctranslate2` ship
prebuilt wheels, no compile step. The `tts` capability's dependencies
(`torch`, `transformers`, `parler-tts`, `coqui-tts`) are a sizeable
download (~1-2GB) the first time.

## Download models

```bash
uv run scripts/download_models.py                        # every capability, every candidate
uv run scripts/download_models.py --capability llm       # just the llm candidates
uv run scripts/download_models.py --capability asr       # just the asr candidates
uv run scripts/download_models.py --capability tts       # just the tts candidates
uv run scripts/download_models.py --capability langid    # just the langid candidates
uv run scripts/download_models.py --only llama-3.2-3b-instruct  # just one candidate
```

Downloads into `../models/<capability>/` (git-ignored, never committed —
see root `.gitignore` and `docs/DEVELOPMENT.md` §15). `llm` candidates are
a single GGUF file; `asr` and `tts` candidates are each a full model
directory; `langid`'s `fasttext-lid176` is a single file fetched directly
from `dl.fbaipublicfiles.com`, and `indiclid` is three direct-URL zip
files (extracted under `models/langid/indiclid/<ftn|ftr|bert>/`) plus a
separate HF tokenizer snapshot for its BERT fallback stage. Skips
whatever is already present.

## Run the service

```bash
cd ai-services
make run
```

(equivalent to `uv run uvicorn app.main:app --port 8090`, but auto-loads
`ai-services/.env` first if one exists — same pattern as
`backend/Makefile`.)

Expected output:

```
INFO:vaanisetu.ai_services:llm model loaded: llama-3.2-3b-instruct (bartowski/Llama-3.2-3B-Instruct-GGUF)
INFO:vaanisetu.ai_services:asr model loaded: faster-whisper-large-v3-turbo (deepdml/faster-whisper-large-v3-turbo-ct2)
INFO:vaanisetu.ai_services:tts model loaded (hi/female): <selected-key> (<repo-id>)
INFO:vaanisetu.ai_services:tts model loaded (hi/male): <selected-key> (<repo-id>)
INFO:vaanisetu.ai_services:tts model loaded (ml/female): <selected-key> (<repo-id>)
INFO:vaanisetu.ai_services:langid model loaded: <selected-key> (<repo-id>)
INFO:     Uvicorn running on http://127.0.0.1:8090
```

`tts` model lines are per `(language, voice)` pair (Milestone 6c) — a
candidate shared by more than one language (e.g. `hinglish` reusing the
Hindi checkpoints) logs once, not once per language, since it's loaded
into memory only once (see `app/main.py`'s dedup-by-key logic). `hinglish`
doesn't appear above only because both its entries resolve to the same
keys `hi` already loaded.

Startup fails loudly (not silently) if any capability's `selected` model
isn't present in its model store yet — download it first (above).

## Verify

```bash
curl http://localhost:8090/healthz
# {"ready":true,"llm_model":"llama-3.2-3b-instruct","asr_model":"faster-whisper-large-v3-turbo","tts_models":{"hi":{"female":"...","male":"..."},"hinglish":{"female":"...","male":"..."},"ml":{"female":"...","male":"..."}},"langid_model":"..."}

curl -X POST http://localhost:8090/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"नमस्ते, आप कैसे हैं?","language":"hi"}'
# {"reply":"..."} — a real, freshly generated Hindi reply

curl -X POST "http://localhost:8090/v1/transcribe?language=hi" \
  -H "Content-Type: audio/wav" \
  --data-binary @eval_data/audio/hi-weather.wav
# {"transcript":"..."} — a real transcript (generate the fixture first, below)

curl -X POST http://localhost:8090/v1/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"नमस्ते, आप कैसे हैं?","language":"hi"}' \
  --output /tmp/reply.wav
# a real, playable WAV file — `afplay /tmp/reply.wav` on macOS to listen

curl -X POST http://localhost:8090/v1/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"നമസ്കാരം, സുഖമാണോ?","language":"ml"}' \
  --output /tmp/reply-ml.wav
# a real, playable Malayalam WAV file — quality is a known, documented
# gap (proxy WER 100-150%, ADR-028), but it does synthesize real audio

curl -X POST http://localhost:8090/v1/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"hello","language":"bn"}'
# {"detail":"tts not available for language 'bn', expected one of ['hi', 'hinglish', 'ml']"}
# a clean 400 — Bengali has no configured tts.selected entry (Milestone 6c)

curl -X POST http://localhost:8090/v1/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"kal ka weather kaisa rahega"}'
# {"language":"hinglish","confidence":0.87} — a real classification
```

## Wire it into the Go backend

The backend defaults to `llm.FakeLLMClient`/`asr.FakeASRClient`/
`tts.FakeTTSClient`/`langid.FakeLangIDClient` unless the corresponding
service URL is set. With this service running on port 8090:

```bash
# in backend/.env
VAANISETU_LLM_SERVICE_URL=http://localhost:8090
VAANISETU_ASR_SERVICE_URL=http://localhost:8090
VAANISETU_TTS_SERVICE_URL=http://localhost:8090
VAANISETU_LANGID_SERVICE_URL=http://localhost:8090
```

Then `cd backend && make run` — its startup log's `"usesFakeLLM":false`,
`"usesFakeASR":false`, `"usesFakeTTS":false`, and `"usesFakeLangID":false`
confirm it picked up the real services. See `backend/SETUP.md` for the
rest of the backend's own setup.

## Run tests

```bash
cd ai-services
make test    # or: uv run pytest
make lint    # or: uv run ruff check .
make fmt-check
make check   # all of the above
```

Tests use fake `LLMEngine`/`ASREngine`/`TTSEngine`/`LangIDEngine`
implementations (dependency-injected, or fake underlying
fasttext/torch objects for `IndicLIDEngine`/`FastTextLIDEngine`) and never
load a real model — they pass with no models downloaded.

## Run the benchmarks

```bash
uv run scripts/benchmark.py          # llm — or: make benchmark
uv run scripts/generate_audio_fixtures.py   # macOS only, one time
uv run scripts/benchmark_asr.py      # asr
uv run scripts/benchmark_tts.py      # tts (needs the asr model too — see below)
uv run scripts/benchmark_langid.py   # langid
```

`benchmark.py` requires all `llm` candidates downloaded first, runs each
in its own subprocess (for accurate peak-memory measurement) against a
fixed seed and prompt set, and writes
`benchmark_results/llm_milestone_2b.json`. `benchmark_asr.py` needs all
`asr` candidates downloaded and `eval_data/audio/` populated first (via
`generate_audio_fixtures.py`, macOS-only — see
`eval_data/asr_fixtures.yaml`'s own comment for why and its limitations),
and writes `benchmark_results/asr_milestone_3b.json` (word error rate,
latency, memory per candidate). `benchmark_tts.py` needs all `tts`
candidates downloaded, plus the already-`selected` `asr` model (it
transcribes each synthesized clip back through it as an intelligibility
proxy — no new fixture audio needed, it reuses `eval_data/asr_fixtures.yaml`'s
text), and writes `benchmark_results/tts_milestone_4b.json` (real-time
factor and proxy word-error-rate per candidate; pronunciation and
naturalness/MOS are recorded as not measured — no human listening panel
in this environment). `benchmark_langid.py` needs all `langid` candidates
downloaded and reuses `eval_data/asr_fixtures.yaml`'s text (no audio
needed — text in, classification out), writing
`benchmark_results/langid_milestone_6b.json` (per-language accuracy and a
Hindi/English/Hinglish confusion matrix per candidate). The four `ml-*`
fixtures (Milestone 6c) have no `voice` field — no macOS voice exists for
Malayalam (checked directly via `say -v '?'`) — so
`generate_audio_fixtures.py` skips them (logged, not an error) and
`benchmark_asr.py` never scores them standalone; `benchmark_tts.py`
synthesizes their text directly (no pre-existing audio needed) and its
proxy-WER measurement is the *only* Malayalam ASR+TTS evidence this
project has. See `docs/DECISIONS.md`
ADR-016/ADR-018/ADR-021/ADR-027/ADR-028 for how this evidence was used to
select each model.

## Troubleshooting

**`registry: model file not found: .../models/llm/<file>.gguf`** or
**`registry: model directory not found: .../models/<asr|tts>/<key>/`** or
**`registry: indiclid model files not found under .../models/langid/<key>`**
The selected model for that capability hasn't been downloaded yet. Run
`uv run scripts/download_models.py --capability <llm|asr|tts|langid>`.

**`registry: malformed models.yaml for capability 'tts' (language=None, voice='female'): ...`**
(Milestone 6c) `tts.selected` is a two-level `{language: {voice: key}}`
map, not the older flat `{voice: key}` shape — every caller of
`load_selected_entry(..., "tts", ...)` must now pass both `voice` and
`language`.

**Startup is slow the first time / `uv sync` takes a while**
`llama-cpp-python` compiles from source (cmake + a C++ compiler) unless a
prebuilt wheel matches your platform exactly. This is a one-time cost per
environment, not per run. `faster-whisper` has no such step.

**`uv sync` fails building `tokenizers` with a TOML/`pyproject.toml`
metadata parse error** (Milestone 4b, added with the `tts` capability's
`transformers` dependency)
This happens on a Python interpreter newer than the ecosystem has
prebuilt `tokenizers` wheels for yet (observed on Python 3.14: no cp314
wheel exists, so `uv` falls back to a source build that hits a genuine
broken-metadata bug in that sdist). Recreate the venv against Python 3.12
instead — already within `requires-python`'s `>=3.12` floor, and has
prebuilt wheels for every dependency in this project as of Milestone 4b:
```bash
rm -rf .venv
uv venv --python 3.12
uv sync
```

**`uv sync` fails with `Dependency #N ... cannot be a direct reference
unless field 'tool.hatch.metadata.allow-direct-references' is set`**
`parler-tts` (the `ai4bharat/indic-parler-tts` candidate's package) has no
PyPI release; `pyproject.toml` installs it straight from GitHub, which
Hatchling refuses without `[tool.hatch.metadata] allow-direct-references
= true` — already set in this project's `pyproject.toml`. If you see this
error, check that setting hasn't been reverted.

**Port 8090 already in use**
Another instance is already running, or the port collides with something
else. Set `VAANISETU_LLM_PORT` to something else, or find and stop the
other process.

**`generate_audio_fixtures.py` says it only works on macOS**
Correct — it shells out to `say`/`afconvert`. On another platform, either
run it on a Mac once and copy `eval_data/audio/` over, or supply your own
WAV files matching `eval_data/asr_fixtures.yaml`'s fixture ids.

## Docker (optional)

```bash
docker compose up
```

`docker-compose.yml`'s `ai-services` entry mounts `./models` read-only
into the container — download models on the host first (above); they are
never baked into the image. This has been reviewed for consistency with
the native setup but has not been run end-to-end in the environment this
guide was written in, since Docker wasn't available there. Verify it
yourself before relying on it.
