"""Environment-derived configuration.

Mirrors backend/internal/config's shape deliberately: every setting comes
from `os.environ`, nothing is hardcoded, and there is exactly one place
(this module) that reads the environment — see docs/DEVELOPMENT.md §6.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    # Port this service listens on. Matches proto/llm.openapi.yaml's and
    # proto/asr.openapi.yaml's documented server ("http://ai-services:8090")
    # by default — both capabilities share one process (ADR-017), hence
    # the "LLM"-prefixed variable name applying service-wide; not renamed
    # to avoid an unnecessary breaking config change (docs/DECISIONS.md
    # ADR-018).
    port: int
    # Path to the model registry YAML (docs/ARCHITECTURE.md §3.6). One
    # file, one top-level key per capability — see app/registry.py.
    model_registry_path: str
    # Directories local model weights are downloaded into, one per
    # capability (git-ignored, docs/DEVELOPMENT.md §15; never committed).
    llm_model_store_dir: str
    asr_model_store_dir: str
    tts_model_store_dir: str
    # One of "debug", "info", "warn", "error" — same levels as the Go
    # backend's internal/logging, for consistency across services.
    log_level: str


def load() -> Config:
    here = os.path.dirname(__file__)
    default_registry_path = os.path.join(here, "..", "models.yaml")
    default_llm_store_dir = os.path.join(here, "..", "..", "models", "llm")
    default_asr_store_dir = os.path.join(here, "..", "..", "models", "asr")
    default_tts_store_dir = os.path.join(here, "..", "..", "models", "tts")

    return Config(
        port=int(os.environ.get("VAANISETU_LLM_PORT", "8090")),
        model_registry_path=os.environ.get("VAANISETU_LLM_MODEL_REGISTRY", default_registry_path),
        llm_model_store_dir=os.environ.get("VAANISETU_LLM_MODEL_STORE", default_llm_store_dir),
        asr_model_store_dir=os.environ.get("VAANISETU_ASR_MODEL_STORE", default_asr_store_dir),
        tts_model_store_dir=os.environ.get("VAANISETU_TTS_MODEL_STORE", default_tts_store_dir),
        log_level=os.environ.get("VAANISETU_LLM_LOG_LEVEL", "info"),
    )
