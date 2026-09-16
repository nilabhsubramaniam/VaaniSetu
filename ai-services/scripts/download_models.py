#!/usr/bin/env python3
"""Downloads every candidate model listed in models.yaml into the
git-ignored local model store (docs/DEVELOPMENT.md §15). Run once per
machine before starting the service or running the benchmark:

    uv run scripts/download_models.py [--only KEY]

Weights are never committed (root .gitignore's `/models/`, `*.gguf`).
"""

from __future__ import annotations

import argparse
import os
import sys

import yaml
from huggingface_hub import hf_hub_download

_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_REGISTRY = os.path.join(_HERE, "..", "models.yaml")
_DEFAULT_STORE = os.path.join(_HERE, "..", "..", "models", "llm")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", default=_DEFAULT_REGISTRY)
    parser.add_argument("--store", default=_DEFAULT_STORE)
    parser.add_argument(
        "--only",
        action="append",
        help="Download only this candidate key (repeatable). Default: all candidates.",
    )
    args = parser.parse_args()

    with open(args.registry, encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    candidates = doc["llm"]["candidates"]

    keys = args.only if args.only else list(candidates.keys())
    os.makedirs(args.store, exist_ok=True)

    for key in keys:
        entry = candidates[key]
        dest = os.path.join(args.store, entry["filename"])
        if os.path.isfile(dest):
            print(f"[skip] {key}: already present at {dest}")
            continue

        print(f"[download] {key}: {entry['repo_id']}/{entry['filename']}")
        path = hf_hub_download(
            repo_id=entry["repo_id"],
            filename=entry["filename"],
            local_dir=args.store,
        )
        print(f"[done] {key}: {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
