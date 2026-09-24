#!/usr/bin/env python3
"""The lightweight, phase-scoped TTS benchmark docs/ROADMAP.md Phase 4
requires before a model is selected (ADR-008): real-time factor (RTF),
latency, memory, and an intelligibility proxy on this machine, against the
same small fixed Hindi/Hinglish/English text set Milestone 3b's ASR
benchmark uses (eval_data/asr_fixtures.yaml) — reused here as-is rather
than duplicated into a second fixture file, since it's substantively the
same prompt set.

This is NOT the automated, repeatable harness (that's Phase 9) — see
scripts/benchmark.py's identical disclaimer. Per docs/EVALUATION.md §5:
- Intelligibility is measured via the documented proxy: each synthesized
  clip is fed back through the already-selected, already-verified
  faster-whisper-large-v3-turbo ASR engine, and WER is computed against
  the fixture's own reference text.
- Pronunciation accuracy and naturalness (MOS) are NOT measured here — both
  require a human listener, which this environment doesn't have. Recorded
  as a known gap in the output, not silently omitted.

Each TTS candidate is benchmarked in its own subprocess (re-invoking this
script with --only), same pattern as scripts/benchmark_asr.py, so peak
memory isn't inflated by a previous candidate's still-resident weights.

Usage: uv run scripts/benchmark_tts.py
(run scripts/download_models.py --capability tts and
 scripts/download_models.py --capability asr first)
"""

from __future__ import annotations

import json
import os
import resource
import subprocess
import sys
import time
import wave
from io import BytesIO

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app import registry  # noqa: E402 - see sys.path.insert above
from scripts.wer import word_error_rate  # noqa: E402

_HERE = os.path.dirname(os.path.abspath(__file__))
_REGISTRY_PATH = os.path.join(_HERE, "..", "models.yaml")
_TTS_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "tts")
_ASR_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "asr")
_FIXTURES_PATH = os.path.join(_HERE, "..", "eval_data", "asr_fixtures.yaml")
_OUTPUT_PATH = os.path.join(_HERE, "..", "benchmark_results", "tts_milestone_4b.json")

_NOT_MEASURED = "not measured — requires a human listener, unavailable in this environment"


def _peak_rss_mb() -> float:
    # ru_maxrss is bytes on macOS (Darwin), KB on Linux — see
    # scripts/benchmark.py's identical note.
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return raw / (1024 * 1024)


def _wav_duration_seconds(wav_bytes: bytes) -> float:
    with wave.open(BytesIO(wav_bytes), "rb") as wav_file:
        return wav_file.getnframes() / wav_file.getframerate()


def _build_proxy_asr_engine():
    """The already-selected, already-verified ASR engine (Milestone 3b),
    reused here as the intelligibility-proxy transcriber rather than
    reimplementing WER-against-audio measurement from scratch.
    """
    entry = registry.load_selected_entry(_REGISTRY_PATH, "asr")
    return registry.build_engine(entry, _ASR_STORE_DIR)


def _benchmark_one(key: str, entry_dict: dict, fixtures: list[dict], proxy_asr) -> dict:
    from app.engines.asr.base import TranscribeRequest
    from app.registry import ModelEntry

    entry = ModelEntry(
        key=key,
        engine=entry_dict["engine"],
        repo_id=entry_dict["repo_id"],
        license=entry_dict.get("license", "unknown"),
        voices=entry_dict.get("voices", {}),
    )

    model_path = os.path.join(_TTS_STORE_DIR, key)
    if not os.path.isdir(model_path):
        return {"key": key, "error": f"model directory not found: {model_path}"}

    print(f"=== {key} ({entry.repo_id}) ===", file=sys.stderr, flush=True)

    load_start = time.monotonic()
    engine = registry.build_engine(entry, _TTS_STORE_DIR)
    load_seconds = time.monotonic() - load_start
    print(f"loaded in {load_seconds:.2f}s", file=sys.stderr, flush=True)

    from app.engines.tts.base import SynthesizeRequest

    runs = []
    for fixture in fixtures:
        try:
            start = time.monotonic()
            result = engine.synthesize(
                SynthesizeRequest(text=fixture["text"], language=fixture["language"])
            )
            elapsed = time.monotonic() - start

            audio_seconds = _wav_duration_seconds(result.audio)
            rtf = elapsed / audio_seconds if audio_seconds > 0 else None

            proxy_transcript = proxy_asr.transcribe(
                TranscribeRequest(
                    audio=result.audio, content_type="audio/wav", language=fixture["language"]
                )
            ).transcript
            proxy_wer = word_error_rate(fixture["text"], proxy_transcript)

            print(
                f"  [{fixture['language']}] {fixture['id']}: RTF={rtf:.2f} "
                f"proxy_wer={proxy_wer:.2f} ({elapsed:.2f}s synth, {audio_seconds:.2f}s audio)",
                file=sys.stderr,
                flush=True,
            )
            print(f"    text: {fixture['text']!r}", file=sys.stderr, flush=True)
            print(f"    proxy transcript: {proxy_transcript!r}", file=sys.stderr, flush=True)

            runs.append(
                {
                    "fixture_id": fixture["id"],
                    "language": fixture["language"],
                    "text": fixture["text"],
                    "proxy_transcript": proxy_transcript,
                    "proxy_wer": round(proxy_wer, 4),
                    "synthesis_seconds": round(elapsed, 3),
                    "audio_seconds": round(audio_seconds, 3),
                    "rtf": round(rtf, 4) if rtf is not None else None,
                }
            )
        except Exception as e:  # noqa: BLE001 - a genuine per-fixture engine
            # failure (e.g. mms-tts-hin's Devanagari-only vocabulary
            # rejecting Latin-script text) shouldn't lose every other
            # fixture's already-measured evidence for this candidate.
            print(
                f"  [{fixture['language']}] {fixture['id']}: FAILED — {e}",
                file=sys.stderr,
                flush=True,
            )
            runs.append(
                {
                    "fixture_id": fixture["id"],
                    "language": fixture["language"],
                    "text": fixture["text"],
                    "error": str(e),
                }
            )

    rtfs = [r["rtf"] for r in runs if r.get("rtf") is not None]
    wers = [r["proxy_wer"] for r in runs if "proxy_wer" in r]
    return {
        "key": key,
        "repo_id": entry.repo_id,
        "license": entry.license,
        "load_seconds": round(load_seconds, 3),
        "mean_rtf": round(sum(rtfs) / len(rtfs), 4) if rtfs else None,
        "max_rtf": round(max(rtfs), 4) if rtfs else None,
        "mean_proxy_wer": round(sum(wers) / len(wers), 4) if wers else None,
        "failed_fixture_count": sum(1 for r in runs if "error" in r),
        "peak_rss_mb": round(_peak_rss_mb(), 1),
        "pronunciation_accuracy": _NOT_MEASURED,
        "naturalness_mos": _NOT_MEASURED,
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
    candidates = doc["tts"]["candidates"]

    with open(_FIXTURES_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)["fixtures"]

    if args.only:
        proxy_asr = _build_proxy_asr_engine()
        result = _benchmark_one(args.only, candidates[args.only], fixtures, proxy_asr)
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
