#!/usr/bin/env python3
"""Downloads a handful of real, human-recorded clips per language for the
Phase 6 Milestone 6i ASR diagnostic (docs/DECISIONS.md ADR-034) — see
eval_data/real_fixtures.yaml for why this exists and its source/license.

Generalizes scripts/download_malayalam_real_fixtures.py's one-language,
one-off pattern now that a second real use exists (Gujarati and Marathi,
the same "Google Speech Corpus" family, OpenSLR resources 78 and 64).
The original Malayalam script and its fixture manifest are left as they
are — already shipped, cited by ADR-029, not this milestone's job to
rewrite.

Downloads each language's corpus archive (one time per language, cached
locally, git-ignored — never committed, it's a dataset, AGENTS.md §12),
and extracts only eval_data/real_fixtures.yaml's clips for that language
into the git-ignored eval_data/audio_real/.

Usage: uv run scripts/download_real_fixtures.py
"""

from __future__ import annotations

import os
import sys
import zipfile

import requests
import yaml

_HERE = os.path.dirname(os.path.abspath(__file__))
_MANIFEST_PATH = os.path.join(_HERE, "..", "eval_data", "real_fixtures.yaml")
_OUTPUT_DIR = os.path.join(_HERE, "..", "eval_data", "audio_real")
_CACHE_DIR = os.path.join(_HERE, "..", ".cache")

# One entry per language this script knows how to fetch. Each is a real,
# separately-licensed OpenSLR resource — not assumed to generalize to a
# language not listed here without checking that language's own corpus
# exists first (Punjabi doesn't have one on OpenSLR, checked directly).
_CORPORA = {
    "mr": {
        "url": "https://openslr.trmal.net/resources/64/mr_in_female.zip",
        "size_hint": "~350MB",
    },
    "gu": {
        "url": "https://openslr.trmal.net/resources/78/gu_in_female.zip",
        "size_hint": "~917MB",
    },
}


def _download_corpus(language: str) -> str:
    corpus = _CORPORA[language]
    zip_path = os.path.join(_CACHE_DIR, os.path.basename(corpus["url"]))
    if os.path.isfile(zip_path):
        print(f"[skip] {language} corpus already cached at {zip_path}")
        return zip_path

    os.makedirs(_CACHE_DIR, exist_ok=True)
    print(f"[download] {corpus['url']} ({corpus['size_hint']}, one time)")
    response = requests.get(corpus["url"], stream=True, timeout=120)
    response.raise_for_status()
    with open(zip_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
    print(f"[done] cached at {zip_path}")
    return zip_path


def main() -> int:
    with open(_MANIFEST_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)["fixtures"]

    os.makedirs(_OUTPUT_DIR, exist_ok=True)

    by_language: dict[str, list[dict]] = {}
    for fixture in fixtures:
        by_language.setdefault(fixture["language"], []).append(fixture)

    for language, language_fixtures in by_language.items():
        if language not in _CORPORA:
            print(f"[skip] no known corpus for language {language!r}", file=sys.stderr)
            continue

        missing = [
            fixture
            for fixture in language_fixtures
            if not os.path.isfile(os.path.join(_OUTPUT_DIR, f"{fixture['id']}.wav"))
        ]
        if not missing:
            print(f"All {len(language_fixtures)} {language} fixture clips already present")
            continue

        zip_path = _download_corpus(language)

        print(f"[extract] {len(missing)} {language} clip(s) from {zip_path}")
        with zipfile.ZipFile(zip_path) as zf:
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
