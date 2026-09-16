"""Contract tests for the `llm` capability's HTTP surface
(proto/llm.openapi.yaml). Uses a fake [LLMEngine] via FastAPI's
dependency-override mechanism — no real model file or lifespan startup
required, the same "depend on the interface, fake it in tests" pattern
used on the Go side (internal/api's handler tests against a fake
ConversationService).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.engines.base import GenerateRequest, GenerateResponse, LLMEngine
from app.main import app, get_engine


class FakeEngine(LLMEngine):
    def __init__(self, reply: str = "fake reply", fail: bool = False) -> None:
        self.reply = reply
        self.fail = fail
        self.last_request: GenerateRequest | None = None

    def generate(self, request: GenerateRequest) -> GenerateResponse:
        self.last_request = request
        if self.fail:
            raise RuntimeError("boom")
        return GenerateResponse(reply=self.reply)


def _client_with_engine(engine: LLMEngine) -> TestClient:
    app.dependency_overrides[get_engine] = lambda: engine
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_generate_returns_the_engines_reply() -> None:
    fake = FakeEngine(reply="नमस्ते")
    client = _client_with_engine(fake)

    resp = client.post("/v1/generate", json={"text": "आज मौसम कैसा है?", "language": "hi"})

    assert resp.status_code == 200
    assert resp.json() == {"reply": "नमस्ते"}
    assert fake.last_request == GenerateRequest(text="आज मौसम कैसा है?", language="hi")


def test_generate_passes_through_language_and_text_unchanged() -> None:
    fake = FakeEngine()
    client = _client_with_engine(fake)

    client.post("/v1/generate", json={"text": "kaisa hai", "language": "hinglish"})

    assert fake.last_request is not None
    assert fake.last_request.language == "hinglish"
    assert fake.last_request.text == "kaisa hai"


def test_generate_maps_engine_failure_to_5xx() -> None:
    fake = FakeEngine(fail=True)
    client = _client_with_engine(fake)

    resp = client.post("/v1/generate", json={"text": "hello", "language": "en"})

    # proto/llm.openapi.yaml only requires a non-2xx status on failure — Go's
    # HTTPLLMClient treats every such response identically, so no specific
    # error body shape is contractually required.
    assert resp.status_code >= 500


def test_generate_rejects_a_malformed_body() -> None:
    fake = FakeEngine()
    client = _client_with_engine(fake)

    resp = client.post("/v1/generate", json={"text": "hello"})  # missing "language"

    assert resp.status_code == 422


def test_healthz_reports_not_ready_when_no_engine_loaded() -> None:
    # No dependency override and no lifespan run (TestClient here is used
    # without entering it as a context manager, so startup never fires) —
    # app.state.state.engine is genuinely None, as it would be if a real
    # startup failed.
    client = TestClient(app)

    resp = client.get("/healthz")

    assert resp.status_code == 200
    assert resp.json() == {"ready": False, "model": None}
