"""An [EmbeddingEngine] backed by `sentence-transformers`, the standard,
well-tested wrapper for pooling/normalizing a transformer's hidden states
into a single dense vector — used here instead of hand-rolling pooling
logic on top of bare `transformers` (already a dependency via TTS/langid)
for exactly this reason. Loads a local snapshot directory — no network
call at embedding time (ADR-001).

Treats `request.text` as opaque: this wrapper applies no query/passage
prefix convention (some candidates, e.g. the E5 family, are trained with
`"query: "`/`"passage: "` prefixes for best retrieval quality). Milestone
7b's own benchmark (scripts/benchmark_embedding.py) applies the
appropriate prefix itself when constructing its own test calls, per
candidate, via `models.yaml`'s optional `query_prefix`/`passage_prefix`
fields — whether the real request path needs the same distinction is a
question for whichever future milestone actually builds query-time
retrieval (7c/7d), not decided here.
"""

from __future__ import annotations

from .base import EmbeddingEngine, EmbedRequest, EmbedResponse


class SentenceTransformersEngine(EmbeddingEngine):
    def __init__(self, model_path: str) -> None:
        # Imported lazily so importing this module never requires
        # sentence-transformers/torch to be installed/loadable — same
        # pattern as every other engine wrapper.
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_path)

    def embed(self, request: EmbedRequest) -> EmbedResponse:
        vector = self._model.encode(request.text, normalize_embeddings=True)
        values = vector.tolist()
        return EmbedResponse(vector=values, dimensions=len(values))
