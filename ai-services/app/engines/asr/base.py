"""The `asr` capability interface every engine wrapper implements.

Mirrors backend/internal/asr.ASRClient's shape on the Go side, the same
way app.engines.base.LLMEngine mirrors internal/llm.LLMClient: one
interface, callers depend only on it (docs/ARCHITECTURE.md §5 / ADR-006).

Lives in its own `app/engines/asr/` subpackage rather than flat in
`app/engines/` like the `llm` capability's files — the convention
`docs/DEVELOPMENT.md` §5 actually asks for ("one module per capability").
The `llm` files predate that being written down this explicitly; left as
they are rather than moved, to avoid touching stable, tested Milestone 2b
code for a purely cosmetic reason (docs/DECISIONS.md ADR-018).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class TranscribeRequest:
    audio: bytes
    content_type: str
    language: str


@dataclass(frozen=True)
class TranscribeResponse:
    transcript: str


class ASREngine(ABC):
    """A loaded, ready-to-transcribe model instance for the `asr`
    capability."""

    @abstractmethod
    def transcribe(self, request: TranscribeRequest) -> TranscribeResponse:
        """Produce a transcript. May return an empty/whitespace transcript
        if nothing was recognized (e.g. silence) — that is a successful
        call, not an error; Go's handler treats an empty result as a 400,
        distinct from this method raising on an actual failure.
        """
        raise NotImplementedError
