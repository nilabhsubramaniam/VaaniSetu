"""The `tts` capability interface every engine wrapper implements.

Mirrors backend/internal/tts.TTSClient's shape on the Go side and
app.engines.asr.base.ASREngine's shape on this one: one interface, callers
depend only on it (docs/ARCHITECTURE.md §5 / ADR-006). Lives in its own
`app/engines/tts/` subpackage per the same "one module per capability"
convention ASR's engine already follows (docs/DEVELOPMENT.md §5).
"""

from __future__ import annotations

import io
import wave
from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class SynthesizeRequest:
    text: str
    language: str


@dataclass(frozen=True)
class SynthesizeResponse:
    audio: bytes
    content_type: str = "audio/wav"


class TTSEngine(ABC):
    """A loaded, ready-to-synthesize model instance for the `tts`
    capability."""

    @abstractmethod
    def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        """Produce a complete WAV clip for the given text. No
        streaming/sentence-level chunking in Phase 4 (deferred to Phase
        11) — one call in, one complete audio clip out, per
        proto/tts.openapi.yaml.
        """
        raise NotImplementedError


def encode_wav_from_float(waveform: np.ndarray, *, sample_rate: int) -> bytes:
    """Encodes a float waveform (values roughly in [-1, 1], the shape all
    three candidate libraries return) as 16-bit PCM mono WAV bytes. Shared
    by all three engine wrappers rather than each repeating the
    float->int16->`wave`-module boilerplate.
    """
    clipped = np.clip(waveform, -1.0, 1.0)
    pcm16 = (clipped * 32767).astype("<i2").tobytes()

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm16)
    return buffer.getvalue()
