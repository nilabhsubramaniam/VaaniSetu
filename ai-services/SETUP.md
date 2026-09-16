# AI Services Setup (`llm` and `asr` capabilities)

Everything below was actually run and verified on this development
machine (Apple M5 Pro, macOS, arm64) while writing this guide. If a step
here ever stops matching reality, trust the code (`app/config.py`,
`app/main.py`) over this file and fix this file.

## Prerequisites

- Python 3.12+ (`ai-services/pyproject.toml`'s `requires-python`).
- [`uv`](https://docs.astral.sh/uv/) (`brew install uv`, or see its docs
  for other platforms).
- ~9GB free disk for every candidate model in `ai-services/models.yaml`
  across both capabilities (only the two `selected` ones are required to
  run the service; download the rest only to re-run a benchmark).
- No GPU required. Both `llama-cpp-python` and `faster-whisper` use Metal
  automatically on Apple Silicon and fall back to CPU elsewhere; both work,
  Metal is faster.

## Install dependencies

```bash
cd ai-services
uv sync
```

This also compiles `llama-cpp-python`'s native extension — expect it to
take a minute or two the first time. `faster-whisper`/`ctranslate2` ship
prebuilt wheels, no compile step.

## Download models

```bash
uv run scripts/download_models.py                        # every capability, every candidate
uv run scripts/download_models.py --capability llm       # just the llm candidates
uv run scripts/download_models.py --capability asr       # just the asr candidates
uv run scripts/download_models.py --only llama-3.2-3b-instruct  # just one candidate
```

Downloads into `../models/<capability>/` (git-ignored, never committed —
see root `.gitignore` and `docs/DEVELOPMENT.md` §15). `llm` candidates are
a single GGUF file; `asr` candidates are a full model directory. Skips
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
INFO:     Uvicorn running on http://127.0.0.1:8090
```

Startup fails loudly (not silently) if either capability's `selected`
model isn't present in its model store yet — download it first (above).

## Verify

```bash
curl http://localhost:8090/healthz
# {"ready":true,"llm_model":"llama-3.2-3b-instruct","asr_model":"faster-whisper-large-v3-turbo"}

curl -X POST http://localhost:8090/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"नमस्ते, आप कैसे हैं?","language":"hi"}'
# {"reply":"..."} — a real, freshly generated Hindi reply

curl -X POST "http://localhost:8090/v1/transcribe?language=hi" \
  -H "Content-Type: audio/wav" \
  --data-binary @eval_data/audio/hi-weather.wav
# {"transcript":"..."} — a real transcript (generate the fixture first, below)
```

## Wire it into the Go backend

The backend defaults to `llm.FakeLLMClient`/`asr.FakeASRClient` unless
their service URLs are set. With this service running on port 8090:

```bash
# in backend/.env
VAANISETU_LLM_SERVICE_URL=http://localhost:8090
VAANISETU_ASR_SERVICE_URL=http://localhost:8090
```

Then `cd backend && make run` — its startup log's `"usesFakeLLM":false`
and `"usesFakeASR":false` confirm it picked up the real services. See
`backend/SETUP.md` for the rest of the backend's own setup.

## Run tests

```bash
cd ai-services
make test    # or: uv run pytest
make lint    # or: uv run ruff check .
make fmt-check
make check   # all of the above
```

Tests use fake `LLMEngine`/`ASREngine` implementations (dependency-
injected) and never load a real model — they pass with no models
downloaded.

## Run the benchmarks

```bash
uv run scripts/benchmark.py          # llm — or: make benchmark
uv run scripts/generate_audio_fixtures.py   # macOS only, one time
uv run scripts/benchmark_asr.py      # asr
```

`benchmark.py` requires all `llm` candidates downloaded first, runs each
in its own subprocess (for accurate peak-memory measurement) against a
fixed seed and prompt set, and writes
`benchmark_results/llm_milestone_2b.json`. `benchmark_asr.py` needs all
`asr` candidates downloaded and `eval_data/audio/` populated first (via
`generate_audio_fixtures.py`, macOS-only — see
`eval_data/asr_fixtures.yaml`'s own comment for why and its limitations),
and writes `benchmark_results/asr_milestone_3b.json` (word error rate,
latency, memory per candidate). See `docs/DECISIONS.md` ADR-016/ADR-018
for how this evidence was used to select each model.

## Troubleshooting

**`registry: model file not found: .../models/llm/<file>.gguf`** or
**`registry: model directory not found: .../models/asr/<key>/`**
The selected model for that capability hasn't been downloaded yet. Run
`uv run scripts/download_models.py --capability <llm|asr>`.

**Startup is slow the first time / `uv sync` takes a while**
`llama-cpp-python` compiles from source (cmake + a C++ compiler) unless a
prebuilt wheel matches your platform exactly. This is a one-time cost per
environment, not per run. `faster-whisper` has no such step.

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
