"""Unit tests for IndicLIDEngine's three-stage dispatch (char-percent
routing -> native/roman fastText -> BERT fallback on low roman
confidence) and its label-to-LanguageCode mapping, using fake underlying
fastText/BERT/tokenizer/torch objects instead of the real ~1.3GB of
downloaded model files — no model files or network access required.
Constructed via `__new__` to skip `__init__`, the same technique used for
FasterWhisperEngine's tests; `_torch` is a fake namespace rather than the
real package, same choice every other engine test with a torch dependency
already makes (e.g. MmsVitsEngine's tests).
"""

from __future__ import annotations

import contextlib
from types import SimpleNamespace

from app.engines.langid.base import DetectRequest
from app.engines.langid.indiclid_engine import IndicLIDEngine


class _FakeFastTextModel:
    def __init__(self, label: str, score: float) -> None:
        self._label = label
        self._score = score
        self.calls: list[str] = []

    def predict(self, text: str) -> tuple[tuple[str, ...], tuple[float, ...]]:
        self.calls.append(text)
        return ((f"__label__{self._label}",), (self._score,))


class _FakeScalar:
    def __init__(self, value: float) -> None:
        self._value = value

    def item(self) -> float:
        return self._value


class _FakeTensor:
    def to(self, device: object) -> _FakeTensor:
        return self


class _FakeTokenizer:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def __call__(self, text: str, **kwargs: object) -> dict[str, _FakeTensor]:
        self.calls.append(text)
        return {"input_ids": _FakeTensor(), "attention_mask": _FakeTensor()}


class _FakeBert:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def __call__(self, input_ids: object, **kwargs: object) -> SimpleNamespace:
        self.calls.append({"input_ids": input_ids, **kwargs})
        return SimpleNamespace(logits="fake-logits")


class _FakeTorch:
    """A fake standing in for the `torch` module: `no_grad()` is a no-op
    context manager, `softmax` is the identity (its output is never
    inspected directly, only threaded through to `max`), and `max` returns
    a pre-configured (confidence, predicted_index) pair — the actual
    numeric routing this engine cares about."""

    def __init__(self, confidence: float, predicted_index: int) -> None:
        self._confidence = confidence
        self._predicted_index = predicted_index

    def no_grad(self) -> contextlib.AbstractContextManager:
        return contextlib.nullcontext()

    def softmax(self, logits: object, dim: int) -> object:
        return logits

    def max(self, probs: object, dim: int) -> tuple[_FakeScalar, _FakeScalar]:
        return _FakeScalar(self._confidence), _FakeScalar(self._predicted_index)


def _engine_with_fakes(
    ftn: _FakeFastTextModel,
    ftr: _FakeFastTextModel,
    bert_confidence: float = 1.0,
    bert_index: int = 4,  # hin_Latn, in _INDICLID_BERT_LABEL_BY_INDEX
) -> IndicLIDEngine:
    engine = IndicLIDEngine.__new__(IndicLIDEngine)
    engine._torch = _FakeTorch(bert_confidence, bert_index)  # noqa: SLF001
    engine._device = "cpu"  # noqa: SLF001
    engine._ftn = ftn  # noqa: SLF001
    engine._ftr = ftr  # noqa: SLF001
    engine._bert = _FakeBert()  # noqa: SLF001
    engine._bert_tokenizer = _FakeTokenizer()  # noqa: SLF001
    return engine


def test_detect_returns_empty_for_empty_text() -> None:
    engine = _engine_with_fakes(_FakeFastTextModel("hin_Deva", 0.9), _FakeFastTextModel("x", 0.9))

    result = engine.detect(DetectRequest(text="   "))

    assert result.language == ""
    assert result.confidence == 0.0


def test_detect_routes_native_script_text_to_the_ftn_model() -> None:
    ftn = _FakeFastTextModel("hin_Deva", 0.95)
    ftr = _FakeFastTextModel("hin_Latn", 0.95)
    engine = _engine_with_fakes(ftn, ftr)

    result = engine.detect(DetectRequest(text="आज मौसम कैसा है"))

    assert ftn.calls == ["आज मौसम कैसा है"]
    assert ftr.calls == []
    assert result.language == "hi"
    assert result.confidence == 0.95


def test_detect_uses_the_ftr_prediction_directly_when_confident() -> None:
    ftn = _FakeFastTextModel("hin_Deva", 0.9)
    ftr = _FakeFastTextModel("eng_Latn", 0.99)
    engine = _engine_with_fakes(ftn, ftr)

    result = engine.detect(DetectRequest(text="what is the weather today"))

    assert ftn.calls == []
    assert ftr.calls == ["what is the weather today"]
    assert result.language == "en"
    assert result.confidence == 0.99


def test_detect_falls_back_to_bert_when_ftr_confidence_is_low() -> None:
    # IndicLID's own default roman_lid_threshold is 0.6 — at or below it,
    # the fast romanized model isn't trusted and BERT resolves it instead
    # (this is exactly the Hinglish-disambiguation case ADR-027 cares
    # about).
    ftn = _FakeFastTextModel("hin_Deva", 0.9)
    ftr = _FakeFastTextModel("eng_Latn", 0.55)
    engine = _engine_with_fakes(ftn, ftr, bert_confidence=0.87, bert_index=4)

    result = engine.detect(DetectRequest(text="kal ka weather kaisa rahega"))

    assert ftr.calls == ["kal ka weather kaisa rahega"]
    assert engine._bert.calls  # noqa: SLF001 - BERT was actually invoked
    # index 4 in _INDICLID_BERT_LABEL_BY_INDEX is "hin_Latn" -> "hinglish",
    # IndicLID's own definition of romanized Hindi matching this project's
    # definition of Hinglish (docs/DECISIONS.md ADR-018).
    assert result.language == "hinglish"
    assert result.confidence == 0.87


def test_detect_maps_an_unmapped_bert_label_to_an_empty_language() -> None:
    ftn = _FakeFastTextModel("hin_Deva", 0.9)
    ftr = _FakeFastTextModel("x", 0.1)
    # index 21 in _INDICLID_BERT_LABEL_BY_INDEX is "other", which has no
    # LanguageCode equivalent.
    engine = _engine_with_fakes(ftn, ftr, bert_confidence=0.7, bert_index=21)

    result = engine.detect(DetectRequest(text="some ambiguous romanized text"))

    assert result.language == ""
    assert result.confidence == 0.7
