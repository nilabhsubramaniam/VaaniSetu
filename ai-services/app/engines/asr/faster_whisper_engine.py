"""An [ASREngine] backed by `faster-whisper` (a CTranslate2-optimized
Whisper implementation). Loads a local CTranslate2 model directory — no
network call at transcription time, consistent with ADR-001 (the voice
loop must not require network egress).

Chosen over the original `openai-whisper` package for the same reason
llama.cpp was chosen for the `llm` capability (docs/DECISIONS.md
ADR-015): CTranslate2 ships prebuilt wheels for this platform (no
from-source compile, unlike llama-cpp-python) and runs efficiently on
CPU, which is what the actual `docker compose up` deployment target
(docs/ARCHITECTURE.md §6) needs — Metal acceleration on this development
machine is a bonus, not a requirement.
"""

from __future__ import annotations

import tempfile

from .base import ASREngine, TranscribeRequest, TranscribeResponse

# Whisper's own language codes — mostly the same ISO 639-1 codes this
# project already uses. "hinglish" has no Whisper equivalent (Whisper has
# no code-switching hint). Measured, not assumed (docs/DECISIONS.md
# ADR-018): passing no hint let Whisper auto-detect on Hindi-accented
# romanized speech, which auto-detected as Hindi and transcribed into
# Devanagari — the wrong script for VaaniSetu's "hinglish", defined as
# Latin-script romanized text (WER 1.0 on every candidate in the first
# benchmark run). Forcing "en" instead makes Whisper decode in English
# orthography, which is Latin-script by construction regardless of the
# accent — see benchmark_results/asr_milestone_3b.json for the measured
# effect of this change.
_WHISPER_LANGUAGE_HINTS = {
    "hi": "hi",
    "en": "en",
    "hinglish": "en",
    "bn": "bn",
    "gu": "gu",
    "mr": "mr",
    "ta": "ta",
    "te": "te",
    "kn": "kn",
    "ml": "ml",
    "pa": "pa",
    "or": "or",
}

_CONTENT_TYPE_SUFFIXES = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
}


def _suffix_for(content_type: str) -> str:
    bare = content_type.split(";")[0].strip().lower()
    return _CONTENT_TYPE_SUFFIXES.get(bare, ".webm")


class FasterWhisperEngine(ASREngine):
    def __init__(
        self,
        model_path: str,
        compute_type: str = "int8",
        device: str = "auto",
    ) -> None:
        # Imported lazily so importing this module never requires
        # faster-whisper/ctranslate2 to be installed/loadable (e.g. for a
        # fake-engine-only test run).
        from faster_whisper import WhisperModel

        self._model = WhisperModel(model_path, device=device, compute_type=compute_type)

    def transcribe(self, request: TranscribeRequest) -> TranscribeResponse:
        # faster-whisper decodes audio itself (via the `av` package, which
        # handles webm/opus, wav, and most common containers directly —
        # docs/ARCHITECTURE.md §3.3's "own audio utilities"), given either
        # a file path or a file-like object. A temp file is the simplest
        # way to hand it browser-recorded bytes in whatever container
        # format they arrived in.
        with tempfile.NamedTemporaryFile(suffix=_suffix_for(request.content_type)) as f:
            f.write(request.audio)
            f.flush()

            language = _WHISPER_LANGUAGE_HINTS.get(request.language)
            segments, _info = self._model.transcribe(f.name, language=language, beam_size=5)
            text = "".join(segment.text for segment in segments)

        return TranscribeResponse(transcript=text.strip())
