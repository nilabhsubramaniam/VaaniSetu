# AI Services Setup (`llm` capability)

Everything below was actually run and verified on this development
machine (Apple M5 Pro, macOS, arm64) while writing this guide. If a step
here ever stops matching reality, trust the code (`app/config.py`,
`app/main.py`) over this file and fix this file.

## Prerequisites

- Python 3.12+ (`ai-services/pyproject.toml`'s `requires-python`).
- [`uv`](https://docs.astral.sh/uv/) (`brew install uv`, or see its docs
  for other platforms).
- ~6GB free disk for the three candidate models in
  `ai-services/models.yaml` (only the `selected` one is required to run
  the service; download the rest only to re-run the benchmark).
- No GPU required. `llama-cpp-python` uses Metal automatically on Apple
  Silicon and falls back to CPU elsewhere; both work, Metal is faster.

## Install dependencies

```bash
cd ai-services
uv sync
```

This also compiles `llama-cpp-python`'s native extension — expect it to
take a minute or two the first time.

## Download the model

```bash
uv run scripts/download_models.py            # all registry candidates
uv run scripts/download_models.py --only llama-3.2-3b-instruct   # just the selected one
```

Downloads into `../models/llm/` (git-ignored, never committed — see root
`.gitignore` and `docs/DEVELOPMENT.md` §15). Skips a file that's already
present.

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
INFO:vaanisetu.llm:model loaded: llama-3.2-3b-instruct (bartowski/Llama-3.2-3B-Instruct-GGUF)
INFO:     Uvicorn running on http://127.0.0.1:8090
```

Startup fails loudly (not silently) if `ai-services/models.yaml`'s
`selected` model file isn't present in the model store yet — download it
first (above).

## Verify

```bash
curl http://localhost:8090/healthz
# {"ready":true,"model":"llama-3.2-3b-instruct"}

curl -X POST http://localhost:8090/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"नमस्ते, आप कैसे हैं?","language":"hi"}'
# {"reply":"..."} — a real, freshly generated Hindi reply
```

## Wire it into the Go backend

The backend defaults to `llm.FakeLLMClient` unless
`VAANISETU_LLM_SERVICE_URL` is set. With this service running on port
8090:

```bash
# in backend/.env
VAANISETU_LLM_SERVICE_URL=http://localhost:8090
```

Then `cd backend && make run` — its startup log's `"usesFakeLLM":false`
confirms it picked up the real service. See `backend/SETUP.md` for the
rest of the backend's own setup.

## Run tests

```bash
cd ai-services
make test    # or: uv run pytest
make lint    # or: uv run ruff check .
make fmt-check
make check   # all of the above
```

Tests use a fake `LLMEngine` (dependency-injected) and never load a real
model — they pass with no models downloaded.

## Run the benchmark

```bash
uv run scripts/benchmark.py   # or: make benchmark
```

Requires all three `models.yaml` candidates downloaded first. Runs each
candidate in its own subprocess (for accurate peak-memory measurement),
against a fixed seed and fixed Hindi/Hinglish prompt set, and writes
`benchmark_results/llm_milestone_2b.json`. See `docs/DECISIONS.md`
ADR-016 for how this evidence was used to select a model.

## Troubleshooting

**`registry: model file not found: .../models/llm/<file>.gguf`**
The selected model hasn't been downloaded yet. Run
`uv run scripts/download_models.py`.

**Startup is slow the first time / `uv sync` takes a while**
`llama-cpp-python` compiles from source (cmake + a C++ compiler) unless a
prebuilt wheel matches your platform exactly. This is a one-time cost per
environment, not per run.

**Port 8090 already in use**
Another instance is already running, or the port collides with something
else. Set `VAANISETU_LLM_PORT` to something else, or find and stop the
other process.

## Docker (optional)

```bash
docker compose up
```

`docker-compose.yml`'s `ai-services` entry mounts `./models/llm`
read-only into the container — download models on the host first (above);
they are never baked into the image. This has been reviewed for
consistency with the native setup but has not been run end-to-end in the
environment this guide was written in, since Docker wasn't available
there. Verify it yourself before relying on it.
