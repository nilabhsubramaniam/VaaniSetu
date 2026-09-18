"""Unit tests for FasterWhisperEngine's request/response handling, using a
fake underlying `_model` (duck-typing `transcribe`) instead of a real
CTranslate2 model — no model directory or native extension load required.
Constructed via `__new__` to skip `__init__`, the same technique used for
LlamaCppEngine's tests.
"""

from __future__ import annotations

from app.engines.asr.base import TranscribeRequest
from app.engines.asr.faster_whisper_engine import FasterWhisperEngine


class _FakeSegment:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeWhisperModel:
    def __init__(self, segments: list[str]) -> None:
        self._segments = [_FakeSegment(s) for s in segments]
        self.calls: list[dict] = []

    def transcribe(self, path: str, language, beam_size: int):
        self.calls.append({"path": path, "language": language, "beam_size": beam_size})
        return self._segments, object()  # (segments, info) — info is unused


def _engine_with_fake(fake: _FakeWhisperModel) -> FasterWhisperEngine:
    engine = FasterWhisperEngine.__new__(FasterWhisperEngine)
    engine._model = fake  # noqa: SLF001 - test-only direct field injection
    return engine


def test_transcribe_joins_segments_and_strips_whitespace() -> None:
    fake = _FakeWhisperModel([" आज मौसम ", "कैसा है?"])
    engine = _engine_with_fake(fake)

    result = engine.transcribe(
        TranscribeRequest(audio=b"x", content_type="audio/webm", language="hi")
    )

    assert result.transcript == "आज मौसम कैसा है?"


def test_transcribe_passes_a_known_language_hint() -> None:
    fake = _FakeWhisperModel(["ok"])
    engine = _engine_with_fake(fake)

    engine.transcribe(TranscribeRequest(audio=b"x", content_type="audio/wav", language="hi"))

    assert fake.calls[0]["language"] == "hi"


def test_transcribe_forces_english_for_hinglish() -> None:
    # Not auto-detect (None) — measured to auto-detect as Hindi and
    # transcribe into the wrong script; see the module's own comment and
    # docs/DECISIONS.md ADR-018.
    fake = _FakeWhisperModel(["ok"])
    engine = _engine_with_fake(fake)

    engine.transcribe(TranscribeRequest(audio=b"x", content_type="audio/webm", language="hinglish"))

    assert fake.calls[0]["language"] == "en"


def test_transcribe_passes_no_hint_for_an_unrecognized_language_code() -> None:
    fake = _FakeWhisperModel(["ok"])
    engine = _engine_with_fake(fake)

    engine.transcribe(TranscribeRequest(audio=b"x", content_type="audio/webm", language="xx"))

    assert fake.calls[0]["language"] is None


def test_transcribe_writes_audio_to_a_temp_file_with_a_matching_suffix() -> None:
    fake = _FakeWhisperModel(["ok"])
    engine = _engine_with_fake(fake)

    engine.transcribe(TranscribeRequest(audio=b"x", content_type="audio/wav", language="en"))

    assert fake.calls[0]["path"].endswith(".wav")


def test_transcribe_returns_empty_string_for_no_segments() -> None:
    fake = _FakeWhisperModel([])
    engine = _engine_with_fake(fake)

    result = engine.transcribe(
        TranscribeRequest(audio=b"x", content_type="audio/webm", language="en")
    )

    assert result.transcript == ""
