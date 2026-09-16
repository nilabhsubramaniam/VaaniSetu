#!/usr/bin/env python3
"""Synthesizes eval_data/asr_fixtures.yaml's ground-truth text into WAV
files, using macOS's built-in `say` + `afconvert` — a one-time dev-machine
tool to bootstrap ASR test fixtures, not a TTS capability (see the
manifest's own comment for why this is in scope and TTS itself isn't).

macOS-only. Run once; the output is git-ignored and regenerable, so a
missing eval_data/audio/ directory just means "run this again", not a
broken checkout.

Usage: uv run scripts/generate_audio_fixtures.py
"""

from __future__ import annotations

import os
import subprocess
import sys

import yaml

_HERE = os.path.dirname(os.path.abspath(__file__))
_MANIFEST_PATH = os.path.join(_HERE, "..", "eval_data", "asr_fixtures.yaml")
_OUTPUT_DIR = os.path.join(_HERE, "..", "eval_data", "audio")


def main() -> int:
    if sys.platform != "darwin":
        print("generate_audio_fixtures.py only works on macOS (uses `say`/`afconvert`).")
        return 1

    with open(_MANIFEST_PATH, encoding="utf-8") as f:
        manifest = yaml.safe_load(f)

    os.makedirs(_OUTPUT_DIR, exist_ok=True)

    for fixture in manifest["fixtures"]:
        wav_path = os.path.join(_OUTPUT_DIR, f"{fixture['id']}.wav")
        if os.path.isfile(wav_path):
            print(f"[skip] {fixture['id']}: already present")
            continue

        aiff_path = os.path.join(_OUTPUT_DIR, f"{fixture['id']}.aiff")
        print(f"[generate] {fixture['id']} ({fixture['voice']}): {fixture['text']!r}")
        subprocess.run(
            ["say", "-v", fixture["voice"], "-o", aiff_path, fixture["text"]],
            check=True,
        )
        # 16kHz mono 16-bit PCM — the format Whisper-family models expect
        # natively, so no resampling happens inside the engine at
        # benchmark time.
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16@16000", aiff_path, wav_path],
            check=True,
        )
        os.remove(aiff_path)

    print(f"\nFixtures written to {_OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
