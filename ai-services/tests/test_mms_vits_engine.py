"""Unit tests for MmsVitsEngine's request/response handling, using fake
underlying tokenizer/model/torch objects instead of real transformers/torch
— no model directory or network access required. Constructed via
`__new__` to skip `__init__`, the same technique used for
FasterWhisperEngine's tests.
"""

from __future__ import annotations

import contextlib
import wave
from io import BytesIO
from types import SimpleNamespace

import numpy as np
import pytest

from app.engines.tts.base import SynthesizeRequest
from app.engines.tts.mms_vits_engine import MmsVitsEngine, UnsupportedTextError


class _FakeTensor:
    def __init__(self, array: np.ndarray) -> None:
        self._array = array

    def squeeze(self) -> _FakeTensor:
        return self

    def cpu(self) -> _FakeTensor:
        return self

    def numpy(self) -> np.ndarray:
        return self._array


class _FakeInputIds:
    def __init__(self, count: int) -> None:
        self._count = count

    def numel(self) -> int:
        return self._count


class _FakeTokenizer:
    def __init__(self, input_id_count: int = 1) -> None:
        self.calls: list[str] = []
        self._input_id_count = input_id_count

    def __call__(self, text: str, return_tensors: str) -> dict:
        self.calls.append(text)
        return {"input_ids": _FakeInputIds(self._input_id_count)}


class _FakeVitsModel:
    def __init__(self, waveform: np.ndarray, sampling_rate: int = 16000) -> None:
        self.config = SimpleNamespace(sampling_rate=sampling_rate)
        self._waveform = waveform
        self.calls: list[dict] = []

    def __call__(self, **kwargs) -> SimpleNamespace:
        self.calls.append(kwargs)
        return SimpleNamespace(waveform=_FakeTensor(self._waveform))


def _engine_with_fakes(model: _FakeVitsModel, tokenizer: _FakeTokenizer) -> MmsVitsEngine:
    engine = MmsVitsEngine.__new__(MmsVitsEngine)
    engine._torch = SimpleNamespace(no_grad=contextlib.nullcontext)  # noqa: SLF001
    engine._model = model  # noqa: SLF001
    engine._tokenizer = tokenizer  # noqa: SLF001
    return engine


def test_synthesize_passes_text_to_the_tokenizer() -> None:
    model = _FakeVitsModel(np.array([0.0, 0.5, -0.5], dtype=np.float32))
    tokenizer = _FakeTokenizer()
    engine = _engine_with_fakes(model, tokenizer)

    engine.synthesize(SynthesizeRequest(text="नमस्ते", language="hi"))

    assert tokenizer.calls == ["नमस्ते"]


def test_synthesize_raises_a_clear_error_for_text_the_vocabulary_cannot_represent() -> None:
    # Measured against the real downloaded tokenizer (docs/DECISIONS.md
    # ADR-021): Latin-script text tokenizes to a genuinely empty sequence
    # for this Devanagari-only checkpoint, not just poor-quality output.
    model = _FakeVitsModel(np.array([0.0]))
    engine = _engine_with_fakes(model, _FakeTokenizer(input_id_count=0))

    with pytest.raises(UnsupportedTextError):
        engine.synthesize(SynthesizeRequest(text="kaisa hai", language="hinglish"))

    assert model.calls == []  # never reaches the model


def test_synthesize_returns_a_valid_wav_at_the_models_sample_rate() -> None:
    model = _FakeVitsModel(np.array([0.0, 0.5, -0.5], dtype=np.float32), sampling_rate=16000)
    engine = _engine_with_fakes(model, _FakeTokenizer())

    result = engine.synthesize(SynthesizeRequest(text="नमस्ते", language="hi"))

    assert result.content_type == "audio/wav"
    with wave.open(BytesIO(result.audio), "rb") as wav_file:
        assert wav_file.getframerate() == 16000
        assert wav_file.getnchannels() == 1
        assert wav_file.getnframes() == 3
