"""Unit tests for FastTextLIDEngine's request/response handling, using a
fake underlying fasttext model instead of a real `lid.176.bin` file — no
model file or network access required. Constructed via `__new__` to skip
`__init__`, the same technique used for FasterWhisperEngine's tests.
"""

from __future__ import annotations

from app.engines.langid.base import DetectRequest
from app.engines.langid.fasttext_lid_engine import FastTextLIDEngine


class _FakeFastTextModel:
    def __init__(self, label: str, score: float) -> None:
        self._label = label
        self._score = score
        self.calls: list[str] = []

    def predict(self, text: str) -> tuple[tuple[str, ...], tuple[float, ...]]:
        self.calls.append(text)
        return ((f"__label__{self._label}",), (self._score,))


def _engine_with_fake(model: _FakeFastTextModel) -> FastTextLIDEngine:
    engine = FastTextLIDEngine.__new__(FastTextLIDEngine)
    engine._model = model  # noqa: SLF001
    return engine


def test_detect_strips_the_fasttext_label_prefix() -> None:
    engine = _engine_with_fake(_FakeFastTextModel("hi", 0.98))

    result = engine.detect(DetectRequest(text="आज मौसम कैसा है?"))

    assert result.language == "hi"
    assert result.confidence == 0.98


def test_detect_returns_empty_for_empty_text_without_calling_the_model() -> None:
    model = _FakeFastTextModel("en", 0.9)
    engine = _engine_with_fake(model)

    result = engine.detect(DetectRequest(text="   "))

    assert result.language == ""
    assert result.confidence == 0.0
    assert model.calls == []


def test_detect_replaces_embedded_newlines_before_predicting() -> None:
    model = _FakeFastTextModel("en", 0.9)
    engine = _engine_with_fake(model)

    engine.detect(DetectRequest(text="hello\nworld"))

    assert model.calls == ["hello world"]
