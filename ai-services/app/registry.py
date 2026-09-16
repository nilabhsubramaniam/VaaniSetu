"""Loads the model registry (docs/ARCHITECTURE.md §3.6) and builds the
[LLMEngine] it currently selects for the `llm` capability.

Application code (app.main) references the "llm" capability only; which
concrete model backs it is entirely a `models.yaml` edit — never a code
change (ADR-006).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import yaml

from .engines.base import LLMEngine


@dataclass(frozen=True)
class ModelEntry:
    key: str
    engine: str
    repo_id: str
    filename: str
    context_length: int
    max_tokens: int
    license: str


class RegistryError(Exception):
    pass


def load_selected_entry(registry_path: str) -> ModelEntry:
    """Reads `registry_path` and returns the entry the "llm" capability
    currently selects.
    """
    with open(registry_path, encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    try:
        llm_section = doc["llm"]
        selected_key = llm_section["selected"]
        candidate = llm_section["candidates"][selected_key]
    except (KeyError, TypeError) as e:
        raise RegistryError(f"registry: malformed {registry_path}: {e}") from e

    return ModelEntry(
        key=selected_key,
        engine=candidate["engine"],
        repo_id=candidate["repo_id"],
        filename=candidate["filename"],
        context_length=candidate.get("context_length", 4096),
        max_tokens=candidate.get("max_tokens", 512),
        license=candidate.get("license", "unknown"),
    )


def build_engine(entry: ModelEntry, model_store_dir: str) -> LLMEngine:
    """Builds the [LLMEngine] for `entry`. `entry.engine` selects the
    wrapper class; add a branch here (never a new caller-visible type) when
    a second engine kind is genuinely needed.
    """
    model_path = os.path.join(model_store_dir, entry.filename)
    if not os.path.isfile(model_path):
        raise RegistryError(
            f"registry: model file not found: {model_path} "
            f"(expected {entry.repo_id}/{entry.filename} downloaded there — "
            "see ai-services/scripts/download_models.py)"
        )

    if entry.engine == "llama_cpp":
        from .engines.llama_cpp_engine import LlamaCppEngine

        return LlamaCppEngine(
            model_path=model_path,
            context_length=entry.context_length,
            max_tokens=entry.max_tokens,
        )

    raise RegistryError(f"registry: unknown engine kind {entry.engine!r}")
