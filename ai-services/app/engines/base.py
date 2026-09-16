"""The `llm` capability interface every engine wrapper implements.

Mirrors backend/internal/llm.LLMClient's shape on the Go side: one
interface, callers depend only on it, and no caller type-switches on the
concrete engine (docs/ARCHITECTURE.md §5 / ADR-006).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class GenerateRequest:
    text: str
    language: str


@dataclass(frozen=True)
class GenerateResponse:
    reply: str


class LLMEngine(ABC):
    """A loaded, ready-to-generate model instance for the `llm` capability."""

    @abstractmethod
    def generate(self, request: GenerateRequest) -> GenerateResponse:
        """Produce a reply. Implementations raise on failure rather than
        returning an empty reply, so the caller can tell "the model said
        nothing" apart from "the call failed" — same rule as the Go side's
        LLMClient.Generate.
        """
        raise NotImplementedError
