#!/usr/bin/env python3
"""The lightweight, phase-scoped LLM benchmark docs/ROADMAP.md Phase 2
requires before a model is selected (ADR-008): latency and memory on this
machine, plus each candidate's raw replies to a small fixed Hindi /
Hinglish prompt set for a qualitative read.

This is NOT the automated, repeatable harness (that's Phase 9) — it is the
one-time, phase-scoped measurement Phase 2's own Definition of Done asks
for, per docs/ROADMAP.md's ordering note. Quality here is judged by
reading the model's actual output, not a human panel or an LLM-judge
pipeline; docs/EVALUATION.md's real, provisional targets are unchanged and
still apply in full once Phase 9 exists.

Each candidate is benchmarked in its own subprocess (re-invoking this
script with --only) so peak-memory measurement isn't inflated by a
previous candidate's still-resident weights in the same process.

Usage: uv run scripts/benchmark.py
(models must already be downloaded — see scripts/download_models.py)
"""

from __future__ import annotations

import json
import os
import resource
import subprocess
import sys
import time

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

_HERE = os.path.dirname(os.path.abspath(__file__))
_REGISTRY_PATH = os.path.join(_HERE, "..", "models.yaml")
_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "llm")
_OUTPUT_PATH = os.path.join(_HERE, "..", "benchmark_results", "llm_milestone_2b.json")

# Fixed so every candidate's results (and a re-run for comparison) are
# reproducible — the live service does NOT fix this (see
# app/engines/llama_cpp_engine.py), only this benchmark does.
_BENCHMARK_SEED = 42

# A small, fixed Hindi + Hinglish prompt set representative of a voice
# assistant's expected queries. Not a substitute for docs/EVALUATION.md's
# held-out set (Phase 9) — deliberately small and hand-picked for a
# one-time phase-scoped read, per the module docstring above.
_PROMPTS = [
    {"language": "hi", "text": "आज मौसम कैसा है?"},
    {"language": "hi", "text": "भारत की राजधानी क्या है?"},
    {"language": "hinglish", "text": "kal ka weather kaisa rahega, bata sakte ho?"},
    {"language": "hinglish", "text": "mujhe ek chhoti si joke sunao"},
    {"language": "en", "text": "What's a good way to learn Hindi quickly?"},
]


def _peak_rss_mb() -> float:
    # ru_maxrss is bytes on macOS (Darwin), KB on Linux — this benchmark
    # runs on macOS dev hardware, so we assume bytes here. Revisit if this
    # script is ever run to benchmark inside the Linux container instead.
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return raw / (1024 * 1024)


def _benchmark_one(key: str, entry: dict) -> dict:
    """Runs in a fresh subprocess (one candidate, one process) so
    _peak_rss_mb reflects only this candidate's model.
    """
    from app.engines.base import GenerateRequest
    from app.engines.llama_cpp_engine import LlamaCppEngine

    model_path = os.path.join(_STORE_DIR, entry["filename"])
    if not os.path.isfile(model_path):
        return {"key": key, "error": f"model file not found: {model_path}"}

    print(f"=== {key} ({entry['repo_id']}) ===", file=sys.stderr, flush=True)

    load_start = time.monotonic()
    engine = LlamaCppEngine(
        model_path=model_path,
        context_length=entry.get("context_length", 4096),
        max_tokens=entry.get("max_tokens", 512),
        seed=_BENCHMARK_SEED,
    )
    load_seconds = time.monotonic() - load_start
    print(f"loaded in {load_seconds:.2f}s", file=sys.stderr, flush=True)

    runs = []
    for prompt in _PROMPTS:
        start = time.monotonic()
        response = engine.generate(
            GenerateRequest(text=prompt["text"], language=prompt["language"])
        )
        elapsed = time.monotonic() - start
        print(
            f"  [{prompt['language']}] {prompt['text']!r} -> {elapsed:.2f}s",
            file=sys.stderr,
            flush=True,
        )
        print(f"    reply: {response.reply!r}", file=sys.stderr, flush=True)
        runs.append(
            {
                "language": prompt["language"],
                "prompt": prompt["text"],
                "reply": response.reply,
                "latency_seconds": round(elapsed, 3),
            }
        )

    latencies = [r["latency_seconds"] for r in runs]
    return {
        "key": key,
        "repo_id": entry["repo_id"],
        "filename": entry["filename"],
        "license": entry.get("license", "unknown"),
        "load_seconds": round(load_seconds, 3),
        "mean_latency_seconds": round(sum(latencies) / len(latencies), 3),
        "max_latency_seconds": round(max(latencies), 3),
        "peak_rss_mb": round(_peak_rss_mb(), 1),
        "runs": runs,
    }


def _run_single_candidate_subprocess(key: str) -> dict:
    proc = subprocess.run(
        [sys.executable, __file__, "--only", key, "--emit-json"],
        capture_output=True,
        text=True,
        cwd=os.path.join(_HERE, ".."),
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        return {"key": key, "error": f"subprocess exited {proc.returncode}"}
    sys.stderr.write(proc.stderr)  # relay the child's progress output
    return json.loads(proc.stdout)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="Benchmark only this candidate key, in-process.")
    parser.add_argument(
        "--emit-json",
        action="store_true",
        help="Print the single candidate's result as JSON to stdout (used by the orchestrator).",
    )
    args = parser.parse_args()

    with open(_REGISTRY_PATH, encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    candidates = doc["llm"]["candidates"]

    if args.only:
        result = _benchmark_one(args.only, candidates[args.only])
        if args.emit_json:
            print(json.dumps(result, ensure_ascii=False))
        return 0

    results = [_run_single_candidate_subprocess(key) for key in candidates]

    os.makedirs(os.path.dirname(_OUTPUT_PATH), exist_ok=True)
    with open(_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"prompts": _PROMPTS, "results": results}, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {_OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
