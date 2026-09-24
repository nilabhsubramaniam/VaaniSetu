"""VaaniSetu's Python AI service HTTP surface: the `llm` capability
(proto/llm.openapi.yaml, `POST /v1/generate`), the `asr` capability
(proto/asr.openapi.yaml, `POST /v1/transcribe`), and the `tts` capability
(proto/tts.openapi.yaml, `POST /v1/synthesize`), hosted in one FastAPI app
per docs/DECISIONS.md ADR-017 — "one module per capability" is a
code-organization convention (docs/DEVELOPMENT.md §5), not a
one-process-per-capability deployment rule. Plus an operational
`/healthz` that neither contract requires but
docs/ARCHITECTURE.md §3.3 asks every AI service to expose ("model warm /
ready state").

Run with: `uvicorn app.main:app --port 8090` (or `make run` — see
ai-services/Makefile).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel

from . import config, registry
from .engines.asr.base import ASREngine, TranscribeRequest
from .engines.base import GenerateRequest, LLMEngine
from .engines.tts.base import SynthesizeRequest, TTSEngine

logger = logging.getLogger("vaanisetu.ai_services")

_cfg = config.load()
logging.basicConfig(level=_cfg.log_level.upper())


class _AppState:
    """Holds both loaded engines. A plain object on `app.state`, not a
    global, so tests can swap either via FastAPI's dependency override
    instead of monkeypatching module state.
    """

    llm_engine: LLMEngine | None = None
    llm_model_key: str | None = None
    asr_engine: ASREngine | None = None
    asr_model_key: str | None = None
    tts_engine: TTSEngine | None = None
    tts_model_key: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    try:
        llm_entry = registry.load_selected_entry(_cfg.model_registry_path, "llm")
        app.state.state.llm_engine = registry.build_engine(llm_entry, _cfg.llm_model_store_dir)
        app.state.state.llm_model_key = llm_entry.key
        logger.info("llm model loaded: %s (%s)", llm_entry.key, llm_entry.repo_id)

        asr_entry = registry.load_selected_entry(_cfg.model_registry_path, "asr")
        app.state.state.asr_engine = registry.build_engine(asr_entry, _cfg.asr_model_store_dir)
        app.state.state.asr_model_key = asr_entry.key
        logger.info("asr model loaded: %s (%s)", asr_entry.key, asr_entry.repo_id)

        tts_entry = registry.load_selected_entry(_cfg.model_registry_path, "tts")
        app.state.state.tts_engine = registry.build_engine(tts_entry, _cfg.tts_model_store_dir)
        app.state.state.tts_model_key = tts_entry.key
        logger.info("tts model loaded: %s (%s)", tts_entry.key, tts_entry.repo_id)
    except registry.RegistryError as e:
        # Fail loudly at startup rather than on the first request — an
        # operator finds out immediately that a configured model isn't
        # actually present, per docs/DEVELOPMENT.md §11 "fail loudly in
        # development".
        logger.error("failed to load model: %s", e)
        raise
    yield


app = FastAPI(title="VaaniSetu AI services", lifespan=lifespan)
app.state.state = _AppState()


def get_llm_engine() -> LLMEngine:
    engine = app.state.state.llm_engine
    if engine is None:
        raise HTTPException(status_code=503, detail="llm model not loaded")
    return engine


def get_asr_engine() -> ASREngine:
    engine = app.state.state.asr_engine
    if engine is None:
        raise HTTPException(status_code=503, detail="asr model not loaded")
    return engine


def get_tts_engine() -> TTSEngine:
    engine = app.state.state.tts_engine
    if engine is None:
        raise HTTPException(status_code=503, detail="tts model not loaded")
    return engine


class GenerateRequestBody(BaseModel):
    text: str
    language: str


class GenerateResponseBody(BaseModel):
    reply: str


@app.post("/v1/generate", response_model=GenerateResponseBody)
def generate(
    body: GenerateRequestBody, engine: LLMEngine = Depends(get_llm_engine)
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


class TranscribeResponseBody(BaseModel):
    transcript: str


@app.post("/v1/transcribe", response_model=TranscribeResponseBody)
async def transcribe(
    request: Request, language: str, engine: ASREngine = Depends(get_asr_engine)
) -> TranscribeResponseBody:
    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="empty audio body")

    try:
        result = engine.transcribe(
            TranscribeRequest(
                audio=audio,
                content_type=request.headers.get("content-type", ""),
                language=language,
            )
        )
    except Exception as e:  # noqa: BLE001 - see the /v1/generate handler's identical reasoning
        # Never log the audio itself, only its size — same rule
        # backend/internal/api applies (docs/DEVELOPMENT.md §12).
        logger.error("transcribe failed (audio bytes=%d): %s", len(audio), e)
        raise HTTPException(status_code=500, detail="transcription failed") from e

    return TranscribeResponseBody(transcript=result.transcript)


class SynthesizeRequestBody(BaseModel):
    text: str
    language: str


@app.post("/v1/synthesize")
def synthesize(
    body: SynthesizeRequestBody, engine: TTSEngine = Depends(get_tts_engine)
) -> Response:
    try:
        result = engine.synthesize(SynthesizeRequest(text=body.text, language=body.language))
    except Exception as e:  # noqa: BLE001 - see the /v1/generate handler's identical reasoning
        logger.error("synthesize failed: %s", e)
        raise HTTPException(status_code=500, detail="synthesis failed") from e

    return Response(content=result.audio, media_type=result.content_type)


@app.get("/healthz")
def healthz() -> dict[str, object]:
    state = app.state.state
    return {
        "ready": (
            state.llm_engine is not None
            and state.asr_engine is not None
            and state.tts_engine is not None
        ),
        "llm_model": state.llm_model_key,
        "asr_model": state.asr_model_key,
        "tts_model": state.tts_model_key,
    }
