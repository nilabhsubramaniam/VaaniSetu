"""The `embedding` capability interface every engine wrapper implements.

Mirrors backend/internal/embedding.EmbeddingClient's shape on the Go
side, the same way app.engines.langid.base.LangIDEngine mirrors
internal/langid.LangIDClient (docs/ARCHITECTURE.md §5 / ADR-006). Lives
in its own `app/engines/embedding/` subpackage, per the same "one module
per capability" convention `asr`/`tts`/`langid` already follow.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class EmbedRequest:
    # Already-chunked text (a document passage, or a query). Chunking
    # itself is not this capability's job — see
    # backend/internal/embedding's package doc comment.
    text: str


@dataclass(frozen=True)
class EmbedResponse:
    vector: list[float]
    # len(vector), carried explicitly so callers never have to infer it.
    dimensions: int


class EmbeddingEngine(ABC):
    """A loaded, ready-to-embed model instance for the `embedding`
    capability."""

    @abstractmethod
    def embed(self, request: EmbedRequest) -> EmbedResponse:
        """Vectorizes request.text. Implementations should raise rather
        than return a zero-length vector on failure."""
        raise NotImplementedError
