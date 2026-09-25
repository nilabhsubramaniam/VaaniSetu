"""The `langid` capability interface every engine wrapper implements.

Mirrors backend/internal/langid.LangIDClient's shape on the Go side, the
same way app.engines.asr.base.ASREngine mirrors internal/asr.ASRClient:
one interface, callers depend only on it (docs/ARCHITECTURE.md §5 /
ADR-006). Lives in its own `app/engines/langid/` subpackage, per the same
"one module per capability" convention `asr`/`tts` already follow.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class DetectRequest:
    text: str


@dataclass(frozen=True)
class DetectResponse:
    # One of this project's own LanguageCode values (see
    # frontend/src/app/core/models/language.model.ts), or "" if the
    # underlying model's prediction doesn't map to any of them.
    language: str
    confidence: float


class LangIDEngine(ABC):
    """A loaded, ready-to-classify model instance for the `langid`
    capability."""

    @abstractmethod
    def detect(self, request: DetectRequest) -> DetectResponse:
        """Classifies request.text's language. May return an empty
        language with low confidence if the underlying model's prediction
        doesn't map to a known LanguageCode — that is a successful call,
        not an error; Go's handler treats it as "no detection", the same
        way it already treats a call failure (docs/DECISIONS.md ADR-026).
        """
        raise NotImplementedError
