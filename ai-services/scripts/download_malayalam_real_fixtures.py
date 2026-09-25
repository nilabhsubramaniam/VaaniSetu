#!/usr/bin/env python3
"""Downloads a handful of real, human-recorded Malayalam clips for the
Phase 6 Milestone 6d ASR diagnostic (docs/DECISIONS.md ADR-029) — see
eval_data/malayalam_real_fixtures.yaml for why this exists and its
source/license.

Downloads Google's IndicTTS Malayalam corpus (~710MB, one time,
CC-BY-SA-4.0, no auth) from OpenSLR resource 63, caches the archive
locally (git-ignored — never committed, it's a dataset, AGENTS.md §12),
and extracts only the fixture manifest's five clips into the git-ignored
eval_data/audio_malayalam_real/.

Usage: uv run scripts/download_malayalam_real_fixtures.py
"""

from __future__ import annotations

import os
import sys
import zipfile

import requests
import yaml

_HERE = os.path.dirname(os.path.abspath(__file__))
_MANIFEST_PATH = os.path.join(_HERE, "..", "eval_data", "malayalam_real_fixtures.yaml")
_OUTPUT_DIR = os.path.join(_HERE, "..", "eval_data", "audio_malayalam_real")
_CACHE_DIR = os.path.join(_HERE, "..", ".cache")
_CORPUS_URL = "https://openslr.trmal.net/resources/63/ml_in_female.zip"
_CORPUS_ZIP_PATH = os.path.join(_CACHE_DIR, "ml_in_female.zip")


def _download_corpus() -> None:
    if os.path.isfile(_CORPUS_ZIP_PATH):
        print(f"[skip] corpus already cached at {_CORPUS_ZIP_PATH}")
        return

    os.makedirs(_CACHE_DIR, exist_ok=True)
    print(f"[download] {_CORPUS_URL} (~710MB, one time)")
    response = requests.get(_CORPUS_URL, stream=True, timeout=120)
    response.raise_for_status()
    with open(_CORPUS_ZIP_PATH, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
    print(f"[done] cached at {_CORPUS_ZIP_PATH}")


def main() -> int:
    with open(_MANIFEST_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)["fixtures"]

    os.makedirs(_OUTPUT_DIR, exist_ok=True)

    missing = [
        fixture
        for fixture in fixtures
        if not os.path.isfile(os.path.join(_OUTPUT_DIR, f"{fixture['id']}.wav"))
    ]
    if not missing:
        print(f"All {len(fixtures)} fixture clips already present in {_OUTPUT_DIR}")
        return 0

    _download_corpus()

    print(f"[extract] {len(missing)} clip(s) from {_CORPUS_ZIP_PATH}")
    with zipfile.ZipFile(_CORPUS_ZIP_PATH) as zf:
        names_by_basename = {os.path.basename(name): name for name in zf.namelist()}
        for fixture in missing:
            wav_filename = f"{fixture['id']}.wav"
            member_name = names_by_basename.get(wav_filename)
            if member_name is None:
                print(f"  [missing] {wav_filename} not found in corpus archive")
                continue
            dest_path = os.path.join(_OUTPUT_DIR, wav_filename)
            with zf.open(member_name) as src, open(dest_path, "wb") as dst:
                dst.write(src.read())
            print(f"  [extracted] {wav_filename}")

    print(f"\nFixtures written to {_OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
