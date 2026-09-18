"""Loads the model registry (docs/ARCHITECTURE.md §3.6) and builds the
engine it currently selects for a given capability ("llm" or "asr").

Application code (app.main) references a capability by name only; which
concrete model backs it is entirely a `models.yaml` edit — never a code
change (ADR-006).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import yaml

from .engines.asr.base import ASREngine
from .engines.base import LLMEngine


@dataclass(frozen=True)
class ModelEntry:
    key: str
    engine: str
    repo_id: str
    license: str
    # llama_cpp ("llm" capability): a single GGUF file, resolved against
    # the capability's model store directory.
    filename: str = ""
    context_length: int = 4096
    max_tokens: int = 512
    # faster_whisper ("asr" capability): the model is a directory (a full
    # repo snapshot: model.bin, config.json, tokenizer files, ...),
    # resolved as <model_store_dir>/<key>/ — filename doesn't apply.
    compute_type: str = "int8"
    device: str = "auto"


class RegistryError(Exception):
    pass


def load_selected_entry(registry_path: str, capability: str) -> ModelEntry:
    """Reads `registry_path` and returns the entry `capability`
    (e.g. "llm" or "asr") currently selects.
    """
    with open(registry_path, encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    try:
        section = doc[capability]
        selected_key = section["selected"]
        candidate = section["candidates"][selected_key]
    except (KeyError, TypeError) as e:
        raise RegistryError(
            f"registry: malformed {registry_path} for capability {capability!r}: {e}"
        ) from e

    return ModelEntry(
        key=selected_key,
        engine=candidate["engine"],
        repo_id=candidate["repo_id"],
        license=candidate.get("license", "unknown"),
        filename=candidate.get("filename", ""),
        context_length=candidate.get("context_length", 4096),
        max_tokens=candidate.get("max_tokens", 512),
        compute_type=candidate.get("compute_type", "int8"),
        device=candidate.get("device", "auto"),
    )


def build_engine(entry: ModelEntry, model_store_dir: str) -> LLMEngine | ASREngine:
    """Builds the engine for `entry`. `entry.engine` selects the wrapper
    class; add a branch here (never a new caller-visible type) when a
    genuinely new engine kind is needed.
    """
    if entry.engine == "llama_cpp":
        model_path = os.path.join(model_store_dir, entry.filename)
        if not os.path.isfile(model_path):
            raise RegistryError(
                f"registry: model file not found: {model_path} "
                f"(expected {entry.repo_id}/{entry.filename} downloaded there — "
                "see ai-services/scripts/download_models.py)"
            )

        from .engines.llama_cpp_engine import LlamaCppEngine

        return LlamaCppEngine(
            model_path=model_path,
            context_length=entry.context_length,
            max_tokens=entry.max_tokens,
        )

    if entry.engine == "faster_whisper":
        model_path = os.path.join(model_store_dir, entry.key)
        if not os.path.isdir(model_path):
            raise RegistryError(
                f"registry: model directory not found: {model_path} "
                f"(expected the full {entry.repo_id} snapshot downloaded there — "
                "see ai-services/scripts/download_models.py)"
            )

        from .engines.asr.faster_whisper_engine import FasterWhisperEngine

        return FasterWhisperEngine(
            model_path=model_path,
            compute_type=entry.compute_type,
            device=entry.device,
        )

    raise RegistryError(f"registry: unknown engine kind {entry.engine!r}")
