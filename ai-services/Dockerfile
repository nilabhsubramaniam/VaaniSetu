# VaaniSetu `llm` capability service (Phase 2, Milestone 2b).
#
# Model weights are NOT baked into this image — docs/ARCHITECTURE.md §6
# requires them "downloaded into a host-mounted, git-ignored volume, never
# layered into images." docker-compose.yml mounts ./models/llm read-only
# into the container; run ai-services/scripts/download_models.py on the
# host first.
FROM python:3.12-slim

# build-essential + cmake: llama-cpp-python compiles its native extension
# from source when no matching prebuilt wheel exists for the image's
# platform/Python combination.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml ./
RUN uv sync --no-dev

COPY app/ ./app/
COPY models.yaml ./

EXPOSE 8090

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
