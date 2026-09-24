#!/usr/bin/env python3
"""Downloads every candidate model listed in models.yaml, for every
capability the registry defines, into the git-ignored local model store
(docs/DEVELOPMENT.md §15). Run once per machine before starting the
service or running a benchmark:

    uv run scripts/download_models.py [--only KEY]

`llama_cpp` candidates (the "llm" capability) are a single GGUF file;
`faster_whisper` (the "asr" capability) and `mms_vits`/`parler_tts`/`xtts`
(the "tts" capability) candidates are each a full repo snapshot downloaded
as a directory — see app/registry.py for how each is resolved back into a
model path. Weights are never committed (root .gitignore's `/models/`,
`*.gguf`).
"""

from __future__ import annotations

import argparse
import os
import sys

import yaml
from huggingface_hub import hf_hub_download, snapshot_download

_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_REGISTRY = os.path.join(_HERE, "..", "models.yaml")
_DEFAULT_MODELS_ROOT = os.path.join(_HERE, "..", "..", "models")


def _download_one(capability: str, key: str, entry: dict, store_dir: str) -> None:
    if entry["engine"] == "llama_cpp":
        dest = os.path.join(store_dir, entry["filename"])
        if os.path.isfile(dest):
            print(f"[skip] {capability}/{key}: already present at {dest}")
            return
        print(f"[download] {capability}/{key}: {entry['repo_id']}/{entry['filename']}")
        path = hf_hub_download(
            repo_id=entry["repo_id"], filename=entry["filename"], local_dir=store_dir
        )
        print(f"[done] {capability}/{key}: {path}")
        return

    if entry["engine"] in ("faster_whisper", "mms_vits", "parler_tts", "xtts"):
        dest_dir = os.path.join(store_dir, key)
        if os.path.isdir(dest_dir) and os.listdir(dest_dir):
            print(f"[skip] {capability}/{key}: already present at {dest_dir}")
            return
        print(f"[download] {capability}/{key}: {entry['repo_id']} (full snapshot)")
        path = snapshot_download(repo_id=entry["repo_id"], local_dir=dest_dir)
        print(f"[done] {capability}/{key}: {path}")
        return

    print(f"[skip] {capability}/{key}: unknown engine {entry['engine']!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", default=_DEFAULT_REGISTRY)
    parser.add_argument("--models-root", default=_DEFAULT_MODELS_ROOT)
    parser.add_argument(
        "--capability",
        action="append",
        help="Download only this capability (e.g. --capability asr). Default: all.",
    )
    parser.add_argument(
        "--only",
        action="append",
        help="Download only this candidate key (repeatable). Default: all candidates.",
    )
    args = parser.parse_args()

    with open(args.registry, encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    capabilities = args.capability if args.capability else list(doc.keys())

    for capability in capabilities:
        if capability not in doc:
            print(f"[skip] unknown capability {capability!r}")
            continue

        candidates = doc[capability]["candidates"]
        store_dir = os.path.join(args.models_root, capability)
        os.makedirs(store_dir, exist_ok=True)

        keys = args.only if args.only else list(candidates.keys())
        for key in keys:
            if key not in candidates:
                continue
            _download_one(capability, key, candidates[key], store_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
