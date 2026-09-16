# Thin convenience wrappers around standard Go commands — see SETUP.md for
# the full local setup flow (Postgres, env vars) these commands assume is
# already in place. Nothing here does anything a plain `go` command
# couldn't; this just saves retyping the combination.
#
# If backend/.env exists (copy it from .env.example), its variables are
# loaded and exported to every target below — this is the fix for the most
# common friction point: `export VAANISETU_DATABASE_URL=...` only lasts for
# one shell session, so a fresh terminal (or an IDE's terminal panel) hits
# "VAANISETU_DATABASE_URL is required" again even though nothing is
# actually broken. `go run ./cmd/api` run directly, outside `make`, still
# needs the variable exported manually — this loading only happens for
# `make` targets.
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.PHONY: run build vet test fmt lint check

run:
	go run ./cmd/api

build:
	go build ./...

vet:
	go vet ./...

test:
	go test ./...

fmt:
	gofmt -l .

lint:
	golangci-lint run ./...

check: build vet test fmt lint
