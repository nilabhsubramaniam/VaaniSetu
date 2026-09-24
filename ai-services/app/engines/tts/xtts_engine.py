"""A [TTSEngine] backed by `coqui/XTTS-v2`, via the community-maintained
`coqui-tts` package (the original Coqui Inc. is defunct; this is the
actively maintained fork of the same `TTS` API). Loads a local snapshot
directory — no network call at synthesis time (ADR-001).

XTTS-v2 ships a bundled set of built-in speaker conditioning latents
(`speakers_xtts.pth` in its own repo snapshot) selected by name via
`voices`, rather than requiring a reference audio clip — see
docs/DECISIONS.md ADR-021 for which built-in speaker was used per
language in the benchmark. License: CPML (non-commercial; Coqui Inc. no
longer exists to grant a commercial license) — see ADR-021 for how this
weighs against the other two candidates.
"""

from __future__ import annotations

from .base import SynthesizeRequest, SynthesizeResponse, TTSEngine, encode_wav_from_float

_DEFAULT_SPEAKER = "Claribel Dervla"


class XttsEngine(TTSEngine):
    def __init__(self, model_path: str, voices: dict[str, str]) -> None:
        import os

        # Imported lazily — see mms_vits_engine.py's identical reasoning.
        import numpy as np
        from TTS.api import TTS

        self._np = np
        self._voices = voices
        self._tts = TTS(
            model_path=model_path,
            config_path=os.path.join(model_path, "config.json"),
            progress_bar=False,
        )

    def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        speaker = self._voices.get(request.language, _DEFAULT_SPEAKER)
        # XTTS's own language codes are ISO 639-1 with no "hinglish"
        # variant (the same gap Whisper has, ADR-018) — code-switched
        # text is passed through as Hindi, its closest phonetic match.
        xtts_language = "en" if request.language == "en" else "hi"

        waveform = self._tts.tts(text=request.text, speaker=speaker, language=xtts_language)
        sample_rate = self._tts.synthesizer.output_sample_rate

        return SynthesizeResponse(
            audio=encode_wav_from_float(self._np.asarray(waveform), sample_rate=sample_rate)
        )
