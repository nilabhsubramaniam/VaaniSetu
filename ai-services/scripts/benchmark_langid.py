#!/usr/bin/env python3
"""The lightweight, phase-scoped `langid` benchmark docs/ROADMAP.md
Phase 6 requires before a model is selected (ADR-008): per-language
accuracy and the Hindi/English/Hinglish confusion matrix
docs/EVALUATION.md §2 asks for, against the same small fixed text set
Milestone 3b's ASR benchmark uses (eval_data/asr_fixtures.yaml) — reused
here as-is (its `language` field already labels each fixture hi/hinglish/
en), same reuse precedent as Milestone 4b's TTS benchmark.

This is NOT the automated, repeatable harness (that's Phase 9) — see
scripts/benchmark.py's identical disclaimer. Eight fixtures is a small,
directional sample, not a statistically rigorous evaluation.

Each candidate is benchmarked in its own subprocess (re-invoking this
script with --only), same pattern as scripts/benchmark_asr.py /
scripts/benchmark_tts.py, so peak memory isn't inflated by a previous
candidate's still-resident weights.

Usage: uv run scripts/benchmark_langid.py
(run scripts/download_models.py --capability langid first)
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

from app import registry  # noqa: E402 - see sys.path.insert above

_HERE = os.path.dirname(os.path.abspath(__file__))
_REGISTRY_PATH = os.path.join(_HERE, "..", "models.yaml")
_LANGID_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "langid")
_FIXTURES_PATH = os.path.join(_HERE, "..", "eval_data", "asr_fixtures.yaml")
_OUTPUT_PATH = os.path.join(_HERE, "..", "benchmark_results", "langid_milestone_6b.json")

# The three buckets docs/EVALUATION.md §2's confusion matrix cares about.
# Any prediction outside this set (including "") is bucketed as "other" —
# a real, distinct outcome (wrong or unmapped), not silently dropped.
_CONFUSION_LABELS = ("hi", "hinglish", "en", "other")


def _peak_rss_mb() -> float:
    # ru_maxrss is bytes on macOS (Darwin), KB on Linux — see
    # scripts/benchmark.py's identical note.
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return raw / (1024 * 1024)


def _bucket(language: str) -> str:
    return language if language in ("hi", "hinglish", "en") else "other"


def _build_entry(key: str, entry_dict: dict) -> registry.ModelEntry:
    return registry.ModelEntry(
        key=key,
        engine=entry_dict["engine"],
        repo_id=entry_dict["repo_id"],
        license=entry_dict.get("license", "unknown"),
        filename=entry_dict.get("filename", ""),
        download_url=entry_dict.get("download_url", ""),
        download_urls=entry_dict.get("download_urls", {}),
        bert_tokenizer=entry_dict.get("bert_tokenizer", ""),
    )


def _benchmark_one(key: str, entry_dict: dict, fixtures: list[dict]) -> dict:
    from app.engines.langid.base import DetectRequest

    entry = _build_entry(key, entry_dict)

    print(f"=== {key} ({entry.repo_id}) ===", file=sys.stderr, flush=True)

    try:
        load_start = time.monotonic()
        engine = registry.build_engine(entry, _LANGID_STORE_DIR)
        load_seconds = time.monotonic() - load_start
    except registry.RegistryError as e:
        return {"key": key, "error": str(e)}
    print(f"loaded in {load_seconds:.2f}s", file=sys.stderr, flush=True)

    confusion = {true: dict.fromkeys(_CONFUSION_LABELS, 0) for true in _CONFUSION_LABELS}
    runs = []
    for fixture in fixtures:
        true_bucket = _bucket(fixture["language"])
        try:
            start = time.monotonic()
            result = engine.detect(DetectRequest(text=fixture["text"]))
            elapsed = time.monotonic() - start
            predicted_bucket = _bucket(result.language)
            confusion[true_bucket][predicted_bucket] += 1

            correct = result.language == fixture["language"]
            print(
                f"  [{fixture['language']}] {fixture['id']}: "
                f"predicted={result.language!r} confidence={result.confidence:.2f} "
                f"{'OK' if correct else 'WRONG'} ({elapsed * 1000:.1f}ms)",
                file=sys.stderr,
                flush=True,
            )

            runs.append(
                {
                    "fixture_id": fixture["id"],
                    "language": fixture["language"],
                    "text": fixture["text"],
                    "predicted_language": result.language,
                    "confidence": round(result.confidence, 4),
                    "correct": correct,
                    "latency_seconds": round(elapsed, 4),
                }
            )
        except Exception as e:  # noqa: BLE001 - a genuine per-fixture engine
            # failure shouldn't lose every other fixture's already-measured
            # evidence for this candidate, same reasoning as
            # scripts/benchmark_tts.py's per-fixture try/except.
            confusion[true_bucket]["other"] += 1
            print(f"  [{fixture['language']}] {fixture['id']}: FAILED — {e}", file=sys.stderr)
            runs.append(
                {
                    "fixture_id": fixture["id"],
                    "language": fixture["language"],
                    "text": fixture["text"],
                    "error": str(e),
                }
            )

    correct_count = sum(1 for r in runs if r.get("correct"))
    scored = [r for r in runs if "correct" in r]
    per_language: dict[str, dict] = {}
    for language in {r["language"] for r in scored}:
        subset = [r for r in scored if r["language"] == language]
        per_language[language] = {
            "count": len(subset),
            "accuracy": round(sum(1 for r in subset if r["correct"]) / len(subset), 4),
        }

    return {
        "key": key,
        "repo_id": entry.repo_id,
        "license": entry.license,
        "load_seconds": round(load_seconds, 3),
        "overall_accuracy": round(correct_count / len(scored), 4) if scored else None,
        "per_language_accuracy": per_language,
        "confusion_matrix": confusion,
        "failed_fixture_count": sum(1 for r in runs if "error" in r),
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
    sys.stderr.write(proc.stderr)
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
    candidates = doc["langid"]["candidates"]

    with open(_FIXTURES_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)["fixtures"]

    if args.only:
        result = _benchmark_one(args.only, candidates[args.only], fixtures)
        if args.emit_json:
            print(json.dumps(result, ensure_ascii=False))
        return 0

    results = [_run_single_candidate_subprocess(key) for key in candidates]

    os.makedirs(os.path.dirname(_OUTPUT_PATH), exist_ok=True)
    with open(_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"fixtures": fixtures, "results": results}, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {_OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
