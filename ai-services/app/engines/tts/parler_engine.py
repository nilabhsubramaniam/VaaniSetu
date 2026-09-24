"""A [TTSEngine] backed by `ai4bharat/indic-parler-tts`, via the
`parler-tts` package. Loads a local snapshot directory — no network call
at synthesis time (ADR-001).

Parler-TTS conditions generation on a natural-language voice description
("a female speaker with a clear voice speaks at a moderate pace...") in
addition to the text to speak. `voices` (per docs/ARCHITECTURE.md §3.6's
"per-language voice configuration", ModelEntry.voices in app/registry.py)
supplies that description per `SynthesizeRequest.language`, so it is
config, not a hardcoded string here — mirrors
faster_whisper_engine.py's `_WHISPER_LANGUAGE_HINTS`, now driven by the
model registry instead. License: Apache-2.0.
"""

from __future__ import annotations

from .base import SynthesizeRequest, SynthesizeResponse, TTSEngine, encode_wav_from_float

# Used when `voices` has no entry for the request's language — a plain,
# clear, moderate-pace description Indic Parler-TTS's own model card uses
# as a default example.
_DEFAULT_VOICE_DESCRIPTION = (
    "A clear, neutral speaker delivers the text at a moderate pace with high quality audio."
)


class ParlerTTSEngine(TTSEngine):
    def __init__(self, model_path: str, voices: dict[str, str]) -> None:
        # Imported lazily — see mms_vits_engine.py's identical reasoning.
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        self._torch = torch
        self._voices = voices
        self._model = ParlerTTSForConditionalGeneration.from_pretrained(model_path)
        self._prompt_tokenizer = AutoTokenizer.from_pretrained(model_path)
        self._description_tokenizer = AutoTokenizer.from_pretrained(
            self._model.config.text_encoder._name_or_path
        )
        self._model.eval()

    def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        description = self._voices.get(request.language, _DEFAULT_VOICE_DESCRIPTION)

        description_ids = self._description_tokenizer(description, return_tensors="pt").input_ids
        prompt_ids = self._prompt_tokenizer(request.text, return_tensors="pt").input_ids

        with self._torch.no_grad():
            generation = self._model.generate(
                input_ids=description_ids, prompt_input_ids=prompt_ids
            )

        waveform = generation.cpu().numpy().squeeze()
        sample_rate = self._model.config.sampling_rate
        return SynthesizeResponse(audio=encode_wav_from_float(waveform, sample_rate=sample_rate))
