"""The `llm` capability's HTTP surface — implements proto/llm.openapi.yaml
exactly (one route, `POST /v1/generate`) plus an operational `/healthz`
that the contract doesn't require but docs/ARCHITECTURE.md §3.3 asks every
AI service to expose ("model warm / ready state").

Run with: `uvicorn app.main:app --port 8090` (or `make run` — see
ai-services/Makefile).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from . import config, registry
from .engines.base import GenerateRequest, LLMEngine

logger = logging.getLogger("vaanisetu.llm")

_cfg = config.load()
logging.basicConfig(level=_cfg.log_level.upper())


class _AppState:
    """Holds the loaded engine. A plain object on `app.state`, not a
    global, so tests can swap it via FastAPI's dependency override instead
    of monkeypatching module state.
    """

    engine: LLMEngine | None = None
    selected_model_key: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    try:
        entry = registry.load_selected_entry(_cfg.model_registry_path)
        app.state.state.engine = registry.build_engine(entry, _cfg.model_store_dir)
        app.state.state.selected_model_key = entry.key
        logger.info("model loaded: %s (%s)", entry.key, entry.repo_id)
    except registry.RegistryError as e:
        # Fail loudly at startup rather than on the first request — an
        # operator finds out immediately that the configured model isn't
        # actually present, per docs/DEVELOPMENT.md §11 "fail loudly in
        # development".
        logger.error("failed to load model: %s", e)
        raise
    yield


app = FastAPI(title="VaaniSetu llm capability service", lifespan=lifespan)
app.state.state = _AppState()


def get_engine() -> LLMEngine:
    engine = app.state.state.engine
    if engine is None:
        raise HTTPException(status_code=503, detail="model not loaded")
    return engine


class GenerateRequestBody(BaseModel):
    text: str
    language: str


class GenerateResponseBody(BaseModel):
    reply: str


@app.post("/v1/generate", response_model=GenerateResponseBody)
def generate(
    body: GenerateRequestBody, engine: LLMEngine = Depends(get_engine)
) -> GenerateResponseBody:
    try:
        result = engine.generate(GenerateRequest(text=body.text, language=body.language))
    except Exception as e:  # noqa: BLE001 - any engine failure maps to a 500;
        # Go's HTTPLLMClient treats every non-200 identically (see
        # proto/llm.openapi.yaml's "5XX" response), so no error envelope
        # is required here — only the status code matters to the caller.
        logger.error("generate failed: %s", e)
        raise HTTPException(status_code=500, detail="generation failed") from e

    return GenerateResponseBody(reply=result.reply)


@app.get("/healthz")
def healthz() -> dict[str, object]:
    return {
        "ready": app.state.state.engine is not None,
        "model": app.state.state.selected_model_key,
    }
