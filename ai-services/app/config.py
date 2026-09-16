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
    # Port this service listens on. Matches proto/llm.openapi.yaml's
    # documented server ("http://ai-services:8090/v1") by default.
    port: int
    # Path to the model registry YAML (docs/ARCHITECTURE.md §3.6). Maps
    # the "llm" capability to a concrete model — application code never
    # hardcodes a model name.
    model_registry_path: str
    # Directory local GGUF weights are downloaded into. Git-ignored
    # (docs/DEVELOPMENT.md §15); never committed.
    model_store_dir: str
    # One of "debug", "info", "warn", "error" — same levels as the Go
    # backend's internal/logging, for consistency across services.
    log_level: str


def load() -> Config:
    here = os.path.dirname(__file__)
    default_registry_path = os.path.join(here, "..", "models.yaml")
    default_store_dir = os.path.join(here, "..", "..", "models", "llm")

    return Config(
        port=int(os.environ.get("VAANISETU_LLM_PORT", "8090")),
        model_registry_path=os.environ.get("VAANISETU_LLM_MODEL_REGISTRY", default_registry_path),
        model_store_dir=os.environ.get("VAANISETU_LLM_MODEL_STORE", default_store_dir),
        log_level=os.environ.get("VAANISETU_LLM_LOG_LEVEL", "info"),
    )
