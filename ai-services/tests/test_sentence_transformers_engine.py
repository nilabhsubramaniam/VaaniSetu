"""Unit tests for SentenceTransformersEngine's request/response handling,
using a fake underlying model instead of a real downloaded checkpoint —
no model file or network access required. Constructed via `__new__` to
skip `__init__`, the same technique test_fasttext_lid_engine.py uses.
"""

from __future__ import annotations

import numpy as np

from app.engines.embedding.base import EmbedRequest
from app.engines.embedding.sentence_transformers_engine import SentenceTransformersEngine


class _FakeSentenceTransformer:
    def __init__(self, vector: list[float]) -> None:
        self._vector = np.array(vector)
        self.calls: list[tuple[str, bool]] = []

    def encode(self, text: str, normalize_embeddings: bool = False):
        self.calls.append((text, normalize_embeddings))
        return self._vector


def _engine_with_fake(model: _FakeSentenceTransformer) -> SentenceTransformersEngine:
    engine = SentenceTransformersEngine.__new__(SentenceTransformersEngine)
    engine._model = model  # noqa: SLF001
    return engine


def test_embed_returns_the_vector_and_its_dimensions() -> None:
    engine = _engine_with_fake(_FakeSentenceTransformer([0.1, 0.2, 0.3]))

    result = engine.embed(EmbedRequest(text="कुछ पाठ"))

    assert result.vector == [0.1, 0.2, 0.3]
    assert result.dimensions == 3


def test_embed_passes_text_through_unchanged() -> None:
    model = _FakeSentenceTransformer([0.0])
    engine = _engine_with_fake(model)

    engine.embed(EmbedRequest(text="passage: some real text"))

    assert model.calls == [("passage: some real text", True)]


def test_embed_requests_normalized_embeddings() -> None:
    # Cosine similarity is what this project's own retrieval-quality
    # benchmark uses (scripts/benchmark_embedding.py) — normalizing here
    # keeps that consistent regardless of which candidate is selected.
    model = _FakeSentenceTransformer([1.0, 0.0])
    engine = _engine_with_fake(model)

    engine.embed(EmbedRequest(text="text"))

    assert model.calls[0][1] is True
