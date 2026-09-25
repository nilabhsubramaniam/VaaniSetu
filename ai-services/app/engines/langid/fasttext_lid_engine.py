"""A [LangIDEngine] backed by the original fastText language-identification
model (`lid.176.bin`, downloaded directly from
dl.fbaipublicfiles.com — CC-BY-SA-3.0, not the non-commercial
`facebook/fasttext-language-identification` Hugging Face repackaging).
Loads a local file — no network call at classification time (ADR-001).

General-purpose, not Indic-specific: 176 languages, flat ISO-639 codes,
no romanized/code-mixed awareness at all. Included as the real baseline
Milestone 6b's benchmark measures `indiclid`'s Hinglish handling against
(docs/DECISIONS.md ADR-027).
"""

from __future__ import annotations

from .base import DetectRequest, DetectResponse, LangIDEngine


class FastTextLIDEngine(LangIDEngine):
    def __init__(self, model_path: str) -> None:
        # Imported lazily so importing this module never requires
        # fasttext to be installed/loadable (e.g. for a fake-engine-only
        # test run) — same pattern as every other engine wrapper.
        import fasttext

        # fastText's own loader is chatty on stderr about a deprecated
        # `FastText.py` load path; harmless, not something this project's
        # code controls.
        self._model = fasttext.load_model(model_path)

    def detect(self, request: DetectRequest) -> DetectResponse:
        # predict() takes a single line of text (no embedded newlines) and
        # returns ((label,), (score,)) for k=1 (the default).
        text = request.text.replace("\n", " ").strip()
        if not text:
            return DetectResponse(language="", confidence=0.0)

        labels, scores = self._model.predict(text)
        # Labels come back as "__label__xx" — fastText's own ISO-639-1/639-3
        # codes, which already match this project's LanguageCode values
        # for every language it cares about (hi, bn, gu, mr, ta, te, kn,
        # ml, pa, or, en) — no mapping table needed, unlike IndicLID's
        # script-suffixed codes.
        language = labels[0].removeprefix("__label__")
        return DetectResponse(language=language, confidence=float(scores[0]))
