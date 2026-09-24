"""Unit tests for XttsEngine's request/response handling, its per-language
built-in-speaker lookup, and its language-code mapping (XTTS has no
"hinglish" code, same gap Whisper has — ADR-018), using a fake underlying
`TTS` object instead of the real coqui-tts package — no model directory or
network access required. Constructed via `__new__` to skip `__init__`,
the same technique used for FasterWhisperEngine's tests.
"""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np

from app.engines.tts.base import SynthesizeRequest
from app.engines.tts.xtts_engine import _DEFAULT_SPEAKER, XttsEngine


class _FakeTTS:
    def __init__(self, waveform: list[float], sample_rate: int = 24000) -> None:
        self.synthesizer = SimpleNamespace(output_sample_rate=sample_rate)
        self._waveform = waveform
        self.calls: list[dict] = []

    def tts(self, text: str, speaker: str, language: str) -> list[float]:
        self.calls.append({"text": text, "speaker": speaker, "language": language})
        return self._waveform


def _engine_with_fake(fake: _FakeTTS, voices: dict[str, str]) -> XttsEngine:
    engine = XttsEngine.__new__(XttsEngine)
    engine._np = np  # noqa: SLF001
    engine._voices = voices  # noqa: SLF001
    engine._tts = fake  # noqa: SLF001
    return engine


def test_synthesize_uses_the_configured_speaker_for_the_requests_language() -> None:
    fake = _FakeTTS([0.0, 0.5])
    engine = _engine_with_fake(fake, voices={"hi": "Ana Florence"})

    engine.synthesize(SynthesizeRequest(text="नमस्ते", language="hi"))

    assert fake.calls[0]["speaker"] == "Ana Florence"
    assert fake.calls[0]["language"] == "hi"


def test_synthesize_falls_back_to_the_default_speaker_for_an_unconfigured_language() -> None:
    fake = _FakeTTS([0.0, 0.5])
    engine = _engine_with_fake(fake, voices={})

    engine.synthesize(SynthesizeRequest(text="hello", language="en"))

    assert fake.calls[0]["speaker"] == _DEFAULT_SPEAKER


def test_synthesize_maps_hinglish_to_the_hindi_language_code() -> None:
    # XTTS has no code-switching variant; Hinglish text is spoken with
    # Hindi phonetics as the closest available match.
    fake = _FakeTTS([0.0])
    engine = _engine_with_fake(fake, voices={})

    engine.synthesize(SynthesizeRequest(text="kaisa hai", language="hinglish"))

    assert fake.calls[0]["language"] == "hi"


def test_synthesize_maps_english_to_the_english_language_code() -> None:
    fake = _FakeTTS([0.0])
    engine = _engine_with_fake(fake, voices={})

    engine.synthesize(SynthesizeRequest(text="hello", language="en"))

    assert fake.calls[0]["language"] == "en"


def test_synthesize_returns_wav_bytes() -> None:
    fake = _FakeTTS([0.0, 0.5, -0.5])
    engine = _engine_with_fake(fake, voices={})

    result = engine.synthesize(SynthesizeRequest(text="hello", language="en"))

    assert result.content_type == "audio/wav"
    assert result.audio.startswith(b"RIFF")
