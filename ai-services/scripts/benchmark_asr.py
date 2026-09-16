#!/usr/bin/env python3
"""The lightweight, phase-scoped ASR benchmark docs/ROADMAP.md Phase 3
requires before a model is selected (ADR-008): word error rate (WER),
latency, and memory on this machine, against the small fixed Hindi/
Hinglish audio set in eval_data/asr_fixtures.yaml.

This is NOT the automated, repeatable harness (that's Phase 9) — see
scripts/benchmark.py's identical disclaimer for the LLM benchmark. WER
here is measured against synthetic (TTS-generated), not real human,
speech — see eval_data/asr_fixtures.yaml's own caveat; treat the absolute
numbers as directional, not as docs/EVALUATION.md's real target
measurement.

Each candidate is benchmarked in its own subprocess (re-invoking this
script with --only) so peak-memory measurement isn't inflated by a
previous candidate's still-resident weights in the same process — same
pattern as scripts/benchmark.py.

Usage: uv run scripts/benchmark_asr.py
(run scripts/generate_audio_fixtures.py and download the asr models first)
"""

from __future__ import annotations

import json
import os
import re
import resource
import subprocess
import sys
import time

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

_HERE = os.path.dirname(os.path.abspath(__file__))
_REGISTRY_PATH = os.path.join(_HERE, "..", "models.yaml")
_ASR_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "asr")
_FIXTURES_PATH = os.path.join(_HERE, "..", "eval_data", "asr_fixtures.yaml")
_AUDIO_DIR = os.path.join(_HERE, "..", "eval_data", "audio")
_OUTPUT_PATH = os.path.join(_HERE, "..", "benchmark_results", "asr_milestone_3b.json")

_PUNCTUATION = re.compile(r"[.,!?؟।॥\"'’—\-:;]")


def _normalize(text: str) -> list[str]:
    return _PUNCTUATION.sub("", text.lower()).split()


def _word_error_rate(reference: str, hypothesis: str) -> float:
    """Standard word-level Levenshtein-distance WER: (substitutions +
    deletions + insertions) / len(reference words). Case- and
    light-punctuation-insensitive (see _normalize) so trivial formatting
    differences aren't counted as errors.
    """
    ref = _normalize(reference)
    hyp = _normalize(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0

    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[n][m] / n


def _peak_rss_mb() -> float:
    # ru_maxrss is bytes on macOS (Darwin), KB on Linux — see
    # scripts/benchmark.py's identical note.
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return raw / (1024 * 1024)


def _benchmark_one(key: str, entry: dict, fixtures: list[dict]) -> dict:
    from app.engines.asr.base import TranscribeRequest
    from app.engines.asr.faster_whisper_engine import FasterWhisperEngine

    model_path = os.path.join(_ASR_STORE_DIR, key)
    if not os.path.isdir(model_path):
        return {"key": key, "error": f"model directory not found: {model_path}"}

    print(f"=== {key} ({entry['repo_id']}) ===", file=sys.stderr, flush=True)

    load_start = time.monotonic()
    engine = FasterWhisperEngine(
        model_path=model_path,
        compute_type=entry.get("compute_type", "int8"),
        device=entry.get("device", "auto"),
    )
    load_seconds = time.monotonic() - load_start
    print(f"loaded in {load_seconds:.2f}s", file=sys.stderr, flush=True)

    runs = []
    for fixture in fixtures:
        audio_path = os.path.join(_AUDIO_DIR, f"{fixture['id']}.wav")
        if not os.path.isfile(audio_path):
            print(f"  [skip] {fixture['id']}: no audio file", file=sys.stderr, flush=True)
            continue

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        start = time.monotonic()
        result = engine.transcribe(
            TranscribeRequest(
                audio=audio_bytes, content_type="audio/wav", language=fixture["language"]
            )
        )
        elapsed = time.monotonic() - start
        wer = _word_error_rate(fixture["text"], result.transcript)

        print(
            f"  [{fixture['language']}] {fixture['id']}: WER={wer:.2f} ({elapsed:.2f}s)",
            file=sys.stderr,
            flush=True,
        )
        print(f"    ref: {fixture['text']!r}", file=sys.stderr, flush=True)
        print(f"    hyp: {result.transcript!r}", file=sys.stderr, flush=True)

        runs.append(
            {
                "fixture_id": fixture["id"],
                "language": fixture["language"],
                "reference": fixture["text"],
                "hypothesis": result.transcript,
                "wer": round(wer, 4),
                "latency_seconds": round(elapsed, 3),
            }
        )

    wers = [r["wer"] for r in runs]
    latencies = [r["latency_seconds"] for r in runs]
    return {
        "key": key,
        "repo_id": entry["repo_id"],
        "license": entry.get("license", "unknown"),
        "load_seconds": round(load_seconds, 3),
        "mean_wer": round(sum(wers) / len(wers), 4) if wers else None,
        "mean_latency_seconds": round(sum(latencies) / len(latencies), 3) if latencies else None,
        "max_latency_seconds": round(max(latencies), 3) if latencies else None,
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
    candidates = doc["asr"]["candidates"]

    with open(_FIXTURES_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)["fixtures"]

    if not os.path.isdir(_AUDIO_DIR) or not os.listdir(_AUDIO_DIR):
        print(
            f"No audio fixtures found in {_AUDIO_DIR}. "
            "Run scripts/generate_audio_fixtures.py first.",
            file=sys.stderr,
        )
        return 1

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
