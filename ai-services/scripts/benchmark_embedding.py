#!/usr/bin/env python3
"""The lightweight, phase-scoped `embedding` benchmark docs/ROADMAP.md
Phase 7 requires before a model is selected (ADR-008): retrieval quality
(overall and cross-lingual-only), latency, memory, and dimension, against
a small, fixed, composed query/passage set (eval_data/
embedding_fixtures.yaml).

Retrieval (the pgvector SQL query, rerank, full pipeline) doesn't exist
yet — a later milestone builds it. This measures retrieval quality
directly with cosine similarity instead, the same kind of standalone,
phase-scoped proxy metric scripts/benchmark_tts.py's "proxy WER" already
established: embed every passage and query, rank passages per query by
cosine similarity, and check whether the correct passage ranks first
among the others. Not the automated, repeatable harness (that's Phase
9) — see scripts/benchmark.py's identical disclaimer.

Each candidate is benchmarked in its own subprocess (re-invoking this
script with --only), same pattern as scripts/benchmark_langid.py, so
peak memory isn't inflated by a previous candidate's still-resident
weights.

Usage: uv run scripts/benchmark_embedding.py
(run scripts/download_models.py --capability embedding first)
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
_EMBEDDING_STORE_DIR = os.path.join(_HERE, "..", "..", "models", "embedding")
_FIXTURES_PATH = os.path.join(_HERE, "..", "eval_data", "embedding_fixtures.yaml")
_OUTPUT_PATH = os.path.join(_HERE, "..", "benchmark_results", "embedding_milestone_7b.json")


def _peak_rss_mb() -> float:
    # ru_maxrss is bytes on macOS (Darwin), KB on Linux — see
    # scripts/benchmark.py's identical note.
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return raw / (1024 * 1024)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    import numpy as np

    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom else 0.0


def _build_entry(key: str, entry_dict: dict) -> registry.ModelEntry:
    return registry.ModelEntry(
        key=key,
        engine=entry_dict["engine"],
        repo_id=entry_dict["repo_id"],
        license=entry_dict.get("license", "unknown"),
    )


def _benchmark_one(key: str, entry_dict: dict, passages: list[dict], queries: list[dict]) -> dict:
    from app.engines.embedding.base import EmbedRequest

    entry = _build_entry(key, entry_dict)
    # Not read by app/registry.py or the engine — see models.yaml's own
    # comment on why these live here, benchmark-side only.
    query_prefix = entry_dict.get("query_prefix", "")
    passage_prefix = entry_dict.get("passage_prefix", "")

    print(f"=== {key} ({entry.repo_id}) ===", file=sys.stderr, flush=True)

    try:
        load_start = time.monotonic()
        engine = registry.build_engine(entry, _EMBEDDING_STORE_DIR)
        load_seconds = time.monotonic() - load_start
    except registry.RegistryError as e:
        return {"key": key, "error": str(e)}
    print(f"loaded in {load_seconds:.2f}s", file=sys.stderr, flush=True)

    passage_vectors: dict[str, list[float]] = {}
    passage_latencies = []
    dimensions: int | None = None
    for passage in passages:
        start = time.monotonic()
        result = engine.embed(EmbedRequest(text=passage_prefix + passage["text"]))
        passage_latencies.append(time.monotonic() - start)
        passage_vectors[passage["id"]] = result.vector
        dimensions = result.dimensions

    runs = []
    query_latencies = []
    for query in queries:
        start = time.monotonic()
        result = engine.embed(EmbedRequest(text=query_prefix + query["text"]))
        query_latencies.append(time.monotonic() - start)

        ranked = sorted(
            passages,
            key=lambda p: _cosine_similarity(result.vector, passage_vectors[p["id"]]),
            reverse=True,
        )
        top1_id = ranked[0]["id"]
        correct = top1_id == query["passage_id"]

        print(
            f"  [{query['language']}] {query['id']}: top1={top1_id!r} "
            f"want={query['passage_id']!r} {'OK' if correct else 'WRONG'}"
            f"{' (cross-lingual)' if query['cross_lingual'] else ''}",
            file=sys.stderr,
            flush=True,
        )

        runs.append(
            {
                "query_id": query["id"],
                "language": query["language"],
                "cross_lingual": query["cross_lingual"],
                "top1_passage_id": top1_id,
                "expected_passage_id": query["passage_id"],
                "correct": correct,
            }
        )

    overall_correct = sum(1 for r in runs if r["correct"])
    cross_lingual_runs = [r for r in runs if r["cross_lingual"]]
    cross_lingual_correct = sum(1 for r in cross_lingual_runs if r["correct"])

    return {
        "key": key,
        "repo_id": entry.repo_id,
        "license": entry.license,
        "load_seconds": round(load_seconds, 3),
        "dimensions": dimensions,
        "overall_accuracy": round(overall_correct / len(runs), 4) if runs else None,
        "cross_lingual_accuracy": (
            round(cross_lingual_correct / len(cross_lingual_runs), 4)
            if cross_lingual_runs
            else None
        ),
        "mean_passage_embed_seconds": round(sum(passage_latencies) / len(passage_latencies), 4),
        "mean_query_embed_seconds": round(sum(query_latencies) / len(query_latencies), 4),
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
    candidates = doc["embedding"]["candidates"]

    with open(_FIXTURES_PATH, encoding="utf-8") as f:
        fixtures = yaml.safe_load(f)
    passages = fixtures["passages"]
    queries = fixtures["queries"]

    if args.only:
        result = _benchmark_one(args.only, candidates[args.only], passages, queries)
        if args.emit_json:
            print(json.dumps(result, ensure_ascii=False))
        return 0

    results = [_run_single_candidate_subprocess(key) for key in candidates]

    os.makedirs(os.path.dirname(_OUTPUT_PATH), exist_ok=True)
    with open(_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {"passages": passages, "queries": queries, "results": results},
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"\nWrote {_OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
