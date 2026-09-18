"""Contract tests for the `llm` and `asr` capabilities' HTTP surfaces
(proto/llm.openapi.yaml, proto/asr.openapi.yaml). Uses fake engines via
FastAPI's dependency-override mechanism — no real model file or lifespan
startup required, the same "depend on the interface, fake it in tests"
pattern used on the Go side (internal/api's handler tests against a fake
ConversationService).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.engines.asr.base import ASREngine
from app.engines.asr.base import TranscribeRequest as ASRTranscribeRequest
from app.engines.asr.base import TranscribeResponse as ASRTranscribeResponse
from app.engines.base import GenerateRequest, GenerateResponse, LLMEngine
from app.main import app, get_asr_engine, get_llm_engine


class FakeLLM(LLMEngine):
    def __init__(self, reply: str = "fake reply", fail: bool = False) -> None:
        self.reply = reply
        self.fail = fail
        self.last_request: GenerateRequest | None = None

    def generate(self, request: GenerateRequest) -> GenerateResponse:
        self.last_request = request
        if self.fail:
            raise RuntimeError("boom")
        return GenerateResponse(reply=self.reply)


class FakeASR(ASREngine):
    def __init__(self, transcript: str = "fake transcript", fail: bool = False) -> None:
        self.transcript = transcript
        self.fail = fail
        self.last_request: ASRTranscribeRequest | None = None

    def transcribe(self, request: ASRTranscribeRequest) -> ASRTranscribeResponse:
        self.last_request = request
        if self.fail:
            raise RuntimeError("boom")
        return ASRTranscribeResponse(transcript=self.transcript)


def _client_with_llm(engine: LLMEngine) -> TestClient:
    app.dependency_overrides[get_llm_engine] = lambda: engine
    return TestClient(app)


def _client_with_asr(engine: ASREngine) -> TestClient:
    app.dependency_overrides[get_asr_engine] = lambda: engine
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_generate_returns_the_engines_reply() -> None:
    fake = FakeLLM(reply="नमस्ते")
    client = _client_with_llm(fake)

    resp = client.post("/v1/generate", json={"text": "आज मौसम कैसा है?", "language": "hi"})

    assert resp.status_code == 200
    assert resp.json() == {"reply": "नमस्ते"}
    assert fake.last_request == GenerateRequest(text="आज मौसम कैसा है?", language="hi")


def test_generate_passes_through_language_and_text_unchanged() -> None:
    fake = FakeLLM()
    client = _client_with_llm(fake)

    client.post("/v1/generate", json={"text": "kaisa hai", "language": "hinglish"})

    assert fake.last_request is not None
    assert fake.last_request.language == "hinglish"
    assert fake.last_request.text == "kaisa hai"


def test_generate_maps_engine_failure_to_5xx() -> None:
    fake = FakeLLM(fail=True)
    client = _client_with_llm(fake)

    resp = client.post("/v1/generate", json={"text": "hello", "language": "en"})

    # proto/llm.openapi.yaml only requires a non-2xx status on failure — Go's
    # HTTPLLMClient treats every such response identically, so no specific
    # error body shape is contractually required.
    assert resp.status_code >= 500


def test_generate_rejects_a_malformed_body() -> None:
    fake = FakeLLM()
    client = _client_with_llm(fake)

    resp = client.post("/v1/generate", json={"text": "hello"})  # missing "language"

    assert resp.status_code == 422


def test_transcribe_returns_the_engines_transcript() -> None:
    fake = FakeASR(transcript="आज मौसम कैसा है?")
    client = _client_with_asr(fake)

    resp = client.post(
        "/v1/transcribe?language=hi",
        content=b"fake audio bytes",
        headers={"Content-Type": "audio/webm"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"transcript": "आज मौसम कैसा है?"}
    assert fake.last_request is not None
    assert fake.last_request.audio == b"fake audio bytes"
    assert fake.last_request.content_type == "audio/webm"
    assert fake.last_request.language == "hi"


def test_transcribe_rejects_an_empty_audio_body() -> None:
    fake = FakeASR()
    client = _client_with_asr(fake)

    resp = client.post("/v1/transcribe?language=en", content=b"")

    assert resp.status_code == 400
    assert fake.last_request is None


def test_transcribe_requires_a_language_query_param() -> None:
    fake = FakeASR()
    client = _client_with_asr(fake)

    resp = client.post("/v1/transcribe", content=b"audio")

    assert resp.status_code == 422


def test_transcribe_maps_engine_failure_to_5xx() -> None:
    fake = FakeASR(fail=True)
    client = _client_with_asr(fake)

    resp = client.post("/v1/transcribe?language=en", content=b"audio")

    # proto/asr.openapi.yaml only requires a non-2xx status on failure —
    # Go's HTTPASRClient treats every such response identically.
    assert resp.status_code >= 500


def test_transcribe_can_return_an_empty_transcript_without_erroring() -> None:
    # Silence is a valid outcome of a successful call — Go's handler (not
    # this service) is what turns an empty transcript into a 400.
    fake = FakeASR(transcript="")
    client = _client_with_asr(fake)

    resp = client.post("/v1/transcribe?language=en", content=b"audio")

    assert resp.status_code == 200
    assert resp.json() == {"transcript": ""}


def test_healthz_reports_not_ready_when_no_engines_loaded() -> None:
    # No dependency override and no lifespan run (TestClient here is used
    # without entering it as a context manager, so startup never fires) —
    # app.state.state's engines are genuinely None, as they would be if a
    # real startup failed.
    client = TestClient(app)

    resp = client.get("/healthz")

    assert resp.status_code == 200
    assert resp.json() == {"ready": False, "llm_model": None, "asr_model": None}
