"""Contract tests for the `llm`, `asr`, `tts`, and `langid` capabilities'
HTTP surfaces (proto/llm.openapi.yaml, proto/asr.openapi.yaml,
proto/tts.openapi.yaml, proto/langid.openapi.yaml). Uses fake engines via
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
from app.engines.langid.base import DetectRequest, DetectResponse, LangIDEngine
from app.engines.tts.base import SynthesizeRequest, SynthesizeResponse, TTSEngine
from app.main import app, get_asr_engine, get_langid_engine, get_llm_engine


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


class FakeTTS(TTSEngine):
    def __init__(self, audio: bytes = b"fake wav bytes", fail: bool = False) -> None:
        self.audio = audio
        self.fail = fail
        self.last_request: SynthesizeRequest | None = None

    def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        self.last_request = request
        if self.fail:
            raise RuntimeError("boom")
        return SynthesizeResponse(audio=self.audio)


class FakeLangID(LangIDEngine):
    def __init__(self, language: str = "hi", confidence: float = 0.9, fail: bool = False) -> None:
        self.language = language
        self.confidence = confidence
        self.fail = fail
        self.last_request: DetectRequest | None = None

    def detect(self, request: DetectRequest) -> DetectResponse:
        self.last_request = request
        if self.fail:
            raise RuntimeError("boom")
        return DetectResponse(language=self.language, confidence=self.confidence)


def _client_with_llm(engine: LLMEngine) -> TestClient:
    app.dependency_overrides[get_llm_engine] = lambda: engine
    return TestClient(app)


def _client_with_asr(engine: ASREngine) -> TestClient:
    app.dependency_overrides[get_asr_engine] = lambda: engine
    return TestClient(app)


def _client_with_langid(engine: LangIDEngine) -> TestClient:
    app.dependency_overrides[get_langid_engine] = lambda: engine
    return TestClient(app)


def _client_with_tts(engines_by_language: dict[str, dict[str, TTSEngine]]) -> TestClient:
    # get_tts_engine looks up app.state.state.tts_engines directly (not a
    # FastAPI Depends) since the language/voice keys are only known once
    # the request body is parsed — dependency_overrides can't intercept
    # it, so tests set app state directly instead, same as test_healthz's
    # approach. Nested by language then voice (Milestone 6c).
    app.state.state.tts_engines = engines_by_language
    app.state.state.tts_model_keys = {
        language: dict.fromkeys(voices, "fake-checkpoint")
        for language, voices in engines_by_language.items()
    }
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()
    app.state.state.tts_engines = None
    app.state.state.tts_model_keys = None


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


def test_synthesize_defaults_to_the_female_voice() -> None:
    female = FakeTTS(audio=b"RIFF....female...")
    male = FakeTTS(audio=b"RIFF....male.....")
    client = _client_with_tts({"hi": {"female": female, "male": male}})

    resp = client.post("/v1/synthesize", json={"text": "नमस्ते", "language": "hi"})

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert resp.content == b"RIFF....female..."
    assert female.last_request == SynthesizeRequest(text="नमस्ते", language="hi")
    assert male.last_request is None


def test_synthesize_dispatches_to_the_requested_voice() -> None:
    female = FakeTTS(audio=b"RIFF....female...")
    male = FakeTTS(audio=b"RIFF....male.....")
    client = _client_with_tts({"hi": {"female": female, "male": male}})

    resp = client.post("/v1/synthesize", json={"text": "नमस्ते", "language": "hi", "voice": "male"})

    assert resp.status_code == 200
    assert resp.content == b"RIFF....male....."
    assert male.last_request == SynthesizeRequest(text="नमस्ते", language="hi")
    assert female.last_request is None


def test_synthesize_dispatches_to_the_requested_language() -> None:
    # Milestone 6c: `language` now selects between distinct loaded engines
    # (e.g. Hindi vs. Malayalam), not just a per-engine internal detail.
    hindi = FakeTTS(audio=b"RIFF....hindi....")
    malayalam = FakeTTS(audio=b"RIFF....malayalam")
    client = _client_with_tts(
        {"hi": {"female": hindi}, "ml": {"female": malayalam}},
    )

    resp = client.post("/v1/synthesize", json={"text": "നമസ്കാരം", "language": "ml"})

    assert resp.status_code == 200
    assert resp.content == b"RIFF....malayalam"
    assert malayalam.last_request == SynthesizeRequest(text="നമസ്കാരം", language="ml")
    assert hindi.last_request is None


def test_synthesize_rejects_an_unconfigured_language() -> None:
    # Not a 503 (transient/not-loaded-yet) — this language was never
    # given a TTS engine at all, a permanent configuration fact.
    client = _client_with_tts({"hi": {"female": FakeTTS()}})

    resp = client.post("/v1/synthesize", json={"text": "hello", "language": "bn"})

    assert resp.status_code == 400


def test_synthesize_rejects_an_unknown_voice() -> None:
    client = _client_with_tts({"en": {"female": FakeTTS()}})

    resp = client.post("/v1/synthesize", json={"text": "hello", "language": "en", "voice": "robot"})

    assert resp.status_code == 400


def test_synthesize_returns_503_when_no_tts_voices_loaded() -> None:
    client = _client_with_tts({})

    resp = client.post("/v1/synthesize", json={"text": "hello", "language": "en"})

    assert resp.status_code == 503


def test_synthesize_rejects_a_malformed_body() -> None:
    client = _client_with_tts({"en": {"female": FakeTTS()}})

    resp = client.post("/v1/synthesize", json={"text": "hello"})  # missing "language"

    assert resp.status_code == 422


def test_synthesize_maps_engine_failure_to_5xx() -> None:
    fake = FakeTTS(fail=True)
    client = _client_with_tts({"en": {"female": fake}})

    resp = client.post("/v1/synthesize", json={"text": "hello", "language": "en"})

    # proto/tts.openapi.yaml only requires a non-2xx status on failure —
    # Go's HTTPTTSClient treats every such response identically.
    assert resp.status_code >= 500


def test_detect_returns_the_engines_classification() -> None:
    fake = FakeLangID(language="hinglish", confidence=0.82)
    client = _client_with_langid(fake)

    resp = client.post("/v1/detect", json={"text": "kal ka weather kaisa rahega"})

    assert resp.status_code == 200
    assert resp.json() == {"language": "hinglish", "confidence": 0.82}
    assert fake.last_request == DetectRequest(text="kal ka weather kaisa rahega")


def test_detect_maps_engine_failure_to_5xx() -> None:
    fake = FakeLangID(fail=True)
    client = _client_with_langid(fake)

    resp = client.post("/v1/detect", json={"text": "hello"})

    # proto/langid.openapi.yaml only requires a non-2xx status on failure —
    # Go's HTTPLangIDClient treats every such response identically
    # (docs/DECISIONS.md ADR-026).
    assert resp.status_code >= 500


def test_detect_rejects_a_malformed_body() -> None:
    fake = FakeLangID()
    client = _client_with_langid(fake)

    resp = client.post("/v1/detect", json={})  # missing "text"

    assert resp.status_code == 422


def test_detect_returns_503_when_no_langid_model_loaded() -> None:
    client = TestClient(app)

    resp = client.post("/v1/detect", json={"text": "hello"})

    assert resp.status_code == 503


def test_healthz_reports_not_ready_when_no_engines_loaded() -> None:
    # No dependency override and no lifespan run (TestClient here is used
    # without entering it as a context manager, so startup never fires) —
    # app.state.state's engines are genuinely None, as they would be if a
    # real startup failed.
    client = TestClient(app)

    resp = client.get("/healthz")

    assert resp.status_code == 200
    assert resp.json() == {
        "ready": False,
        "llm_model": None,
        "asr_model": None,
        "tts_models": {},
        "langid_model": None,
    }


def test_healthz_reports_tts_models_per_language_and_voice_when_all_are_loaded() -> None:
    client = _client_with_tts(
        {
            "hi": {"female": FakeTTS(), "male": FakeTTS()},
            "ml": {"female": FakeTTS(), "male": FakeTTS()},
        }
    )

    resp = client.get("/healthz")

    assert resp.json()["tts_models"] == {
        "hi": {"female": "fake-checkpoint", "male": "fake-checkpoint"},
        "ml": {"female": "fake-checkpoint", "male": "fake-checkpoint"},
    }
    # llm/asr/langid are still unloaded in this test, so overall readiness is still False.
    assert resp.json()["ready"] is False


def test_healthz_reports_tts_not_ready_when_a_configured_language_is_missing_a_voice() -> None:
    client = _client_with_tts(
        {"hi": {"female": FakeTTS(), "male": FakeTTS()}, "ml": {"female": FakeTTS()}}
    )

    resp = client.get("/healthz")

    assert resp.json()["ready"] is False
