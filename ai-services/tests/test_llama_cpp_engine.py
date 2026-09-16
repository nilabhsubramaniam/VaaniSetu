"""Unit tests for LlamaCppEngine's message-building/fallback logic, using a
fake `_llama` (duck-typing `create_chat_completion`) instead of a real
model — no GGUF file or native extension load required. Constructed via
`__new__` to skip `__init__` (which would otherwise require a real model
path), a standard technique for testing a small piece of an object that
does expensive work in its constructor.
"""

from __future__ import annotations

from app.engines.base import GenerateRequest
from app.engines.llama_cpp_engine import LlamaCppEngine


class _FakeLlama:
    def __init__(self, replies: list[dict], raise_no_system_role_first: bool = False) -> None:
        self._replies = list(replies)
        self._raise_first = raise_no_system_role_first
        self.calls: list[list[dict]] = []

    def create_chat_completion(self, messages: list[dict], max_tokens: int) -> dict:
        self.calls.append(messages)
        if self._raise_first and len(self.calls) == 1:
            raise ValueError("System role not supported")
        content = self._replies.pop(0)
        return {"choices": [{"message": {"content": content}}]}


def _engine_with_fake(fake: _FakeLlama, max_tokens: int = 512) -> LlamaCppEngine:
    engine = LlamaCppEngine.__new__(LlamaCppEngine)
    engine._llama = fake  # noqa: SLF001 - test-only direct field injection
    engine._max_tokens = max_tokens  # noqa: SLF001
    return engine


def test_generate_sends_a_system_and_user_message_by_default() -> None:
    fake = _FakeLlama(replies=["नमस्ते"])
    engine = _engine_with_fake(fake)

    result = engine.generate(GenerateRequest(text="hi", language="hi"))

    assert result.reply == "नमस्ते"
    assert len(fake.calls) == 1
    roles = [m["role"] for m in fake.calls[0]]
    assert roles == ["system", "user"]
    assert fake.calls[0][1]["content"] == "hi"


def test_generate_falls_back_to_a_single_user_message_when_system_role_unsupported() -> None:
    fake = _FakeLlama(replies=["ok"], raise_no_system_role_first=True)
    engine = _engine_with_fake(fake)

    result = engine.generate(GenerateRequest(text="hi", language="en"))

    assert result.reply == "ok"
    assert len(fake.calls) == 2
    # First (failed) attempt used a system role...
    assert fake.calls[0][0]["role"] == "system"
    # ...the retry folds the system prompt into one user message instead.
    assert [m["role"] for m in fake.calls[1]] == ["user"]
    assert "hi" in fake.calls[1][0]["content"]


def test_generate_reraises_unrelated_value_errors() -> None:
    class _BrokenLlama:
        def create_chat_completion(self, **kwargs):
            raise ValueError("some other failure")

    engine = _engine_with_fake(_BrokenLlama())  # type: ignore[arg-type]

    try:
        engine.generate(GenerateRequest(text="hi", language="en"))
    except ValueError as e:
        assert "some other failure" in str(e)
    else:
        raise AssertionError("expected a ValueError to propagate")
