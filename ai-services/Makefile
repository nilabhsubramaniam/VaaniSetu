# Mirrors backend/Makefile's shape (auto-load .env, one target per check)
# so both workspaces feel the same to work in — see docs/DEVELOPMENT.md.

ifneq (,$(wildcard ./.env))
	include .env
	export
endif

.PHONY: sync run download-models benchmark test lint fmt fmt-check check

sync:
	uv sync

run: sync
	uv run uvicorn app.main:app --port $${VAANISETU_LLM_PORT:-8090}

download-models: sync
	uv run scripts/download_models.py

benchmark: sync
	uv run scripts/benchmark.py

test: sync
	uv run pytest

lint: sync
	uv run ruff check .

fmt:
	uv run ruff format .

fmt-check: sync
	uv run ruff format --check .

check: test fmt-check lint
