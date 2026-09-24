"""Unit tests for ParlerTTSEngine's request/response handling and its
per-language voice-description lookup, using fake underlying
tokenizer/model/torch objects instead of real parler-tts/torch — no model
directory or network access required. Constructed via `__new__` to skip
`__init__`, the same technique used for FasterWhisperEngine's tests.
"""

from __future__ import annotations

import contextlib
from types import SimpleNamespace

import numpy as np

from app.engines.tts.base import SynthesizeRequest
from app.engines.tts.parler_engine import _DEFAULT_VOICE_DESCRIPTION, ParlerTTSEngine


class _FakeTokenIds:
    def __init__(self, value: str) -> None:
        self.input_ids = value


class _FakeTokenizer:
    def __init__(self, label: str) -> None:
        self._label = label
        self.calls: list[str] = []

    def __call__(self, text: str, return_tensors: str) -> _FakeTokenIds:
        self.calls.append(text)
        return _FakeTokenIds(f"{self._label}:{text}")


class _FakeGeneration:
    def __init__(self, array: np.ndarray) -> None:
        self._array = array

    def cpu(self) -> _FakeGeneration:
        return self

    def numpy(self) -> np.ndarray:
        return self._array


class _FakeModel:
    def __init__(self, waveform: np.ndarray, sampling_rate: int = 44100) -> None:
        self.config = SimpleNamespace(sampling_rate=sampling_rate)
        self._waveform = waveform
        self.calls: list[dict] = []

    def generate(self, **kwargs) -> _FakeGeneration:
        self.calls.append(kwargs)
        return _FakeGeneration(self._waveform)


def _engine_with_fakes(model: _FakeModel, voices: dict[str, str]) -> ParlerTTSEngine:
    engine = ParlerTTSEngine.__new__(ParlerTTSEngine)
    engine._torch = SimpleNamespace(no_grad=contextlib.nullcontext)  # noqa: SLF001
    engine._voices = voices  # noqa: SLF001
    engine._model = model  # noqa: SLF001
    engine._prompt_tokenizer = _FakeTokenizer("prompt")  # noqa: SLF001
    engine._description_tokenizer = _FakeTokenizer("description")  # noqa: SLF001
    return engine


def test_synthesize_uses_the_configured_voice_for_the_requests_language() -> None:
    model = _FakeModel(np.array([0.0, 0.5], dtype=np.float32))
    engine = _engine_with_fakes(model, voices={"hi": "A calm male voice, slow pace."})

    engine.synthesize(SynthesizeRequest(text="नमस्ते", language="hi"))

    assert model.calls[0]["input_ids"] == "description:A calm male voice, slow pace."
    assert model.calls[0]["prompt_input_ids"] == "prompt:नमस्ते"


def test_synthesize_falls_back_to_the_default_description_for_an_unconfigured_language() -> None:
    model = _FakeModel(np.array([0.0, 0.5], dtype=np.float32))
    engine = _engine_with_fakes(model, voices={"hi": "A calm male voice, slow pace."})

    engine.synthesize(SynthesizeRequest(text="hello", language="en"))

    assert model.calls[0]["input_ids"] == f"description:{_DEFAULT_VOICE_DESCRIPTION}"


def test_synthesize_returns_wav_bytes() -> None:
    model = _FakeModel(np.array([0.0, 0.5, -0.5], dtype=np.float32))
    engine = _engine_with_fakes(model, voices={})

    result = engine.synthesize(SynthesizeRequest(text="hello", language="en"))

    assert result.content_type == "audio/wav"
    assert result.audio.startswith(b"RIFF")
