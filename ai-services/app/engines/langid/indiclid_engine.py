"""A [LangIDEngine] backed by AI4Bharat's IndicLID
(https://github.com/AI4Bharat/IndicLID, MIT). Loads three local model
files — no network call at classification time (ADR-001).

Real three-stage architecture, reimplemented here for a single text at a
time from the actual reference implementation
(`Inference/ai4bharat/IndicLID.py` in the IndicLID repo — read directly,
not assumed):
  1. `_char_percent_check` decides whether `text` looks native-script or
     romanized.
  2. Native-script text goes to the fast linear `IndicLID-FTN` model.
  3. Romanized text goes to the fast linear `IndicLID-FTR` model first;
     if its confidence is at or below `_BERT_FALLBACK_THRESHOLD`, the
     slower `IndicLID-BERT` classifier (fine-tuned on
     ai4bharat/IndicBERTv2-MLM-only) resolves it instead. This fallback is
     kept (not skipped for simplicity) because it specifically
     disambiguates uncertain romanized text — exactly the Hinglish case
     this project cares about most (docs/DECISIONS.md ADR-027).

IndicLID's own `xxx_Yyyy` (ISO 639-3 + ISO 15924 script) label space maps
onto this project's LanguageCode values via `_INDICLID_TO_LANGUAGE_CODE`.
`hin_Latn` -> `"hinglish"` is the load-bearing mapping: IndicLID's own
definition of "Hindi written in Latin script" is exactly this project's
definition of Hinglish (docs/DECISIONS.md ADR-018). Codes with no
LanguageCode equivalent (Assamese, Bodo, Kashmiri, Maithili, ...,
`"other"`) are left unmapped — detect() returns an empty language for
those rather than guessing.
"""

from __future__ import annotations

import re

from .base import DetectRequest, DetectResponse, LangIDEngine

_INDICLID_TO_LANGUAGE_CODE = {
    "hin_Deva": "hi",
    "hin_Latn": "hinglish",
    "eng_Latn": "en",
    "ben_Beng": "bn",
    "ben_Latn": "bn",
    "guj_Gujr": "gu",
    "guj_Latn": "gu",
    "mar_Deva": "mr",
    "mar_Latn": "mr",
    "tam_Tamil": "ta",
    "tam_Latn": "ta",
    "tel_Telu": "te",
    "tel_Latn": "te",
    "kan_Knda": "kn",
    "kan_Latn": "kn",
    "mal_Mlym": "ml",
    "mal_Latn": "ml",
    "pan_Guru": "pa",
    "pan_Latn": "pa",
    "ori_Orya": "or",
}

# IndicLID-BERT's classification head output index -> its own label space,
# copied verbatim from Inference/ai4bharat/IndicLID.py's
# IndicLID_lang_code_dict_reverse (the ordering is the model's own
# training-time class ordering; it must match exactly, not just contain
# the same labels).
_INDICLID_BERT_LABEL_BY_INDEX = {
    0: "asm_Latn",
    1: "ben_Latn",
    2: "brx_Latn",
    3: "guj_Latn",
    4: "hin_Latn",
    5: "kan_Latn",
    6: "kas_Latn",
    7: "kok_Latn",
    8: "mai_Latn",
    9: "mal_Latn",
    10: "mni_Latn",
    11: "mar_Latn",
    12: "nep_Latn",
    13: "ori_Latn",
    14: "pan_Latn",
    15: "san_Latn",
    16: "snd_Latn",
    17: "tam_Latn",
    18: "tel_Latn",
    19: "urd_Latn",
    20: "eng_Latn",
    21: "other",
    22: "asm_Beng",
    23: "ben_Beng",
    24: "brx_Deva",
    25: "doi_Deva",
    26: "guj_Gujr",
    27: "hin_Deva",
    28: "kan_Knda",
    29: "kas_Arab",
    30: "kas_Deva",
    31: "kok_Deva",
    32: "mai_Deva",
    33: "mal_Mlym",
    34: "mni_Beng",
    35: "mni_Meti",
    36: "mar_Deva",
    37: "nep_Deva",
    38: "ori_Orya",
    39: "pan_Guru",
    40: "san_Deva",
    41: "sat_Olch",
    42: "snd_Arab",
    43: "tam_Tamil",
    44: "tel_Telu",
    45: "urd_Arab",
}

_SPECIAL_CHAR_PATTERN = re.compile(r"[@_!#$%^&*()<>?/\|}{~:]")
_EN_CHAR_PATTERN = re.compile(r"[a-zA-Z0-9]")

# IndicLID's own default `input_threshold`: at or above this fraction of
# ASCII-alphanumeric characters, route to the romanized-script model
# instead of the native-script one.
_ROMAN_INPUT_THRESHOLD = 0.5
# IndicLID's own default `roman_lid_threshold`: at or below this FTR
# confidence, fall through to the slower BERT classifier instead of
# trusting the fast linear model's answer.
_BERT_FALLBACK_THRESHOLD = 0.6


def _char_percent_check(text: str) -> float:
    """Fraction of `text`'s non-special, non-whitespace characters that
    are ASCII letters/digits — IndicLID's own heuristic for routing
    between its native-script and romanized-script models."""
    special_chars = len(_SPECIAL_CHAR_PATTERN.findall(text))
    spaces_and_newlines = len(re.findall(r"\s", text))
    total_chars = len(text) - special_chars - spaces_and_newlines
    if total_chars <= 0:
        return 0.0
    en_chars = len(_EN_CHAR_PATTERN.findall(text))
    return en_chars / total_chars


class IndicLIDEngine(LangIDEngine):
    def __init__(
        self, ftn_model_path: str, ftr_model_path: str, bert_model_path: str, bert_tokenizer: str
    ) -> None:
        # Imported lazily so importing this module never requires
        # fasttext/torch/transformers to be installed/loadable (e.g. for a
        # fake-engine-only test run) — same pattern as every other engine.
        import fasttext
        import torch
        from transformers import AutoTokenizer

        self._torch = torch
        self._device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self._ftn = fasttext.load_model(ftn_model_path)
        self._ftr = fasttext.load_model(ftr_model_path)
        # IndicLID-BERT ships as a fully pickled nn.Module (not a state
        # dict), so weights_only=False is required to load it — a real,
        # accepted trust dependency on AI4Bharat's release integrity, the
        # same level of trust already extended to every other pretrained
        # checkpoint this project loads (docs/DECISIONS.md ADR-027).
        self._bert = torch.load(bert_model_path, map_location=self._device, weights_only=False)
        # The checkpoint was pickled against an older transformers version,
        # before BertModel.forward() started reading self.attn_implementation
        # (set only in __init__, which unpickling skips entirely) — without
        # this, every BERT-fallback call raises AttributeError. A real,
        # measured incompatibility (docs/DECISIONS.md ADR-027), not a
        # hypothetical one: reproduced with transformers 4.46.1/torch 2.14.
        self._bert.bert.attn_implementation = self._bert.bert.config._attn_implementation
        self._bert.eval()
        self._bert_tokenizer = AutoTokenizer.from_pretrained(bert_tokenizer)

    def detect(self, request: DetectRequest) -> DetectResponse:
        text = request.text.strip()
        if not text:
            return DetectResponse(language="", confidence=0.0)

        if _char_percent_check(text) > _ROMAN_INPUT_THRESHOLD:
            return self._detect_roman(text)
        return self._detect_native(text)

    def _detect_native(self, text: str) -> DetectResponse:
        labels, scores = self._ftn.predict(text)
        return self._map(labels[0].removeprefix("__label__"), float(scores[0]))

    def _detect_roman(self, text: str) -> DetectResponse:
        labels, scores = self._ftr.predict(text)
        score = float(scores[0])
        if score > _BERT_FALLBACK_THRESHOLD:
            return self._map(labels[0].removeprefix("__label__"), score)
        return self._detect_bert(text)

    def _detect_bert(self, text: str) -> DetectResponse:
        encoded = self._bert_tokenizer(
            text, return_tensors="pt", padding=True, truncation=True, max_length=512
        )
        encoded = {k: v.to(self._device) for k, v in encoded.items()}

        with self._torch.no_grad():
            outputs = self._bert(
                encoded["input_ids"],
                token_type_ids=encoded.get("token_type_ids"),
                attention_mask=encoded["attention_mask"],
            )

        probs = self._torch.softmax(outputs.logits, dim=1)
        confidence, predicted_index = self._torch.max(probs, dim=1)
        label = _INDICLID_BERT_LABEL_BY_INDEX[predicted_index.item()]
        return self._map(label, confidence.item())

    def _map(self, indiclid_label: str, confidence: float) -> DetectResponse:
        return DetectResponse(
            language=_INDICLID_TO_LANGUAGE_CODE.get(indiclid_label, ""), confidence=confidence
        )
