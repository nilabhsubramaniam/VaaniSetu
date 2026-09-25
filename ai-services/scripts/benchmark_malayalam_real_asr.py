#!/usr/bin/env python3
"""Phase 6 Milestone 6d's real-audio Malayalam ASR diagnostic
(docs/DECISIONS.md ADR-029): runs the already-selected
`faster-whisper-large-v3-turbo` engine against real, human-recorded
Malayalam speech (eval_data/malayalam_real_fixtures.yaml,
eval_data/audio_malayalam_real/) and measures real WER.

This exists to answer one question `scripts/benchmark_tts.py`'s
synthesize-then-transcribe proxy couldn't: when Malayalam TTS measured a
100-150% proxy WER, was that actually faster-whisper failing to
understand real Malayalam speech, or `mms-tts-mal` producing speech that
isn't real Malayalam to begin with? This script isolates the ASR half by
removing TTS from the loop entirely — real recorded audio in, real
transcript out.

Not a candidate-selection benchmark (there's only one already-selected
ASR engine here, no candidates being compared) — no subprocess isolation
needed, unlike scripts/benchmark_asr.py.

Usage: uv run scripts/benchmark_malayalam_real_asr.py
(run scripts/download_malayalam_real_fixtures.py first)
"""

from __future__ import annotations

import json
import os
import sys

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app import registry  # noqa: E402 - see sys.path.insert above
from scripts.wer import word_error_rate  # noqa: E402

_HERE = os.path.dirname(os.path.abspath(__file__))
_REGISTRY_PATH = os.path.join(_HERE, "..", "models.yaml")
_ASR_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "asr")
_FIXTURES_PATH = os.path.join(_HERE, "..", "eval_data", "malayalam_real_fixtures.yaml")
_AUDIO_DIR = os.path.join(_HERE, "..", "eval_data", "audio_malayalam_real")
_OUTPUT_PATH = os.path.join(_HERE, "..", "benchmark_results", "malayalam_real_asr_diagnostic.json")


def main() -> int:
    from app.engines.asr.base import TranscribeRequest

    with open(_FIXTURES_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)["fixtures"]

    if not os.path.isdir(_AUDIO_DIR) or not os.listdir(_AUDIO_DIR):
        print(
            f"No audio found in {_AUDIO_DIR}. "
            "Run scripts/download_malayalam_real_fixtures.py first.",
            file=sys.stderr,
        )
        return 1

    entry = registry.load_selected_entry(_REGISTRY_PATH, "asr")
    print(f"=== {entry.key} ({entry.repo_id}) — real Malayalam audio ===", file=sys.stderr)
    engine = registry.build_engine(entry, _ASR_STORE_DIR)

    runs = []
    for fixture in fixtures:
        audio_path = os.path.join(_AUDIO_DIR, f"{fixture['id']}.wav")
        if not os.path.isfile(audio_path):
            print(f"  [skip] {fixture['id']}: no audio file", file=sys.stderr)
            continue

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        result = engine.transcribe(
            TranscribeRequest(audio=audio_bytes, content_type="audio/wav", language="ml")
        )
        wer = word_error_rate(fixture["text"], result.transcript)

        print(f"  {fixture['id']}: WER={wer:.2f}", file=sys.stderr)
        print(f"    ref: {fixture['text']!r}", file=sys.stderr)
        print(f"    hyp: {result.transcript!r}", file=sys.stderr)

        runs.append(
            {
                "fixture_id": fixture["id"],
                "reference": fixture["text"],
                "hypothesis": result.transcript,
                "wer": round(wer, 4),
            }
        )

    wers = [r["wer"] for r in runs]
    result = {
        "asr_key": entry.key,
        "asr_repo_id": entry.repo_id,
        "audio_source": "Google IndicTTS Malayalam corpus, OpenSLR resource 63, CC-BY-SA-4.0",
        "mean_wer": round(sum(wers) / len(wers), 4) if wers else None,
        "runs": runs,
    }

    os.makedirs(os.path.dirname(_OUTPUT_PATH), exist_ok=True)
    with open(_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nMean WER on real Malayalam audio: {result['mean_wer']}", file=sys.stderr)
    print(f"Wrote {_OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
