"""A [TTSEngine] backed by an MMS-VITS-architecture checkpoint (Meta's
`facebook/mms-tts-hin`, or a same-architecture fine-tune of it such as
`Anjan9320/fb-mms-tts-hin-ft-female` — see docs/DECISIONS.md ADR-022),
loaded via `transformers`. Loads a local snapshot directory — no network
call at synthesis time, consistent with ADR-001.

One checkpoint = one language, and its vocabulary is Devanagari-phoneme
only: measured (not assumed) against the real downloaded tokenizer, any
text with no Devanagari characters (Latin-script Hinglish or English)
tokenizes to a genuinely *empty* sequence, not merely poor-quality Hindi
phonemes as originally expected — see docs/DECISIONS.md ADR-021. This is
a real limitation shared by every checkpoint this wrapper loads, not a bug
in the wrapper itself; `synthesize` raises a clear, descriptive error for
it rather than letting an empty tensor crash several frames deep inside
`transformers` with an opaque dtype-mismatch message.
License: each checkpoint's own `license` field in `models.yaml` — both
candidates built on this architecture so far are CC-BY-NC-4.0
(non-commercial); see ADR-021/ADR-022 for how that weighs against
alternatives.
"""

from __future__ import annotations

from .base import SynthesizeRequest, SynthesizeResponse, TTSEngine, encode_wav_from_float


class UnsupportedTextError(ValueError):
    """Raised when the input text contains no characters this candidate's
    Devanagari-only vocabulary can represent at all."""


class MmsVitsEngine(TTSEngine):
    def __init__(self, model_path: str) -> None:
        # Imported lazily so importing this module never requires
        # transformers/torch to be installed/loadable (e.g. for a
        # fake-engine-only test run) — same pattern as FasterWhisperEngine.
        import os

        import torch
        from transformers import AutoTokenizer, VitsModel

        self._torch = torch
        self._name = os.path.basename(os.path.normpath(model_path))
        self._model = VitsModel.from_pretrained(model_path)
        self._tokenizer = AutoTokenizer.from_pretrained(model_path)
        self._model.eval()

    def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        inputs = self._tokenizer(request.text, return_tensors="pt")
        if inputs["input_ids"].numel() == 0:
            raise UnsupportedTextError(
                f"{self._name}: {request.text!r} contains no Devanagari characters "
                "this Hindi-only checkpoint's vocabulary can represent"
            )

        with self._torch.no_grad():
            output = self._model(**inputs).waveform

        waveform = output.squeeze().cpu().numpy()
        sample_rate = self._model.config.sampling_rate
        return SynthesizeResponse(audio=encode_wav_from_float(waveform, sample_rate=sample_rate))
