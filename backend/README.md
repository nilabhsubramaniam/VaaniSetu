# VaaniSetu backend

Phase 2 (Local LLM), done: a Go API and PostgreSQL persistence, calling
either `llm.FakeLLMClient` (canned replies, no network) or `llm.HTTPLLMClient`
(the real Python `llm` service at `../ai-services/`) depending on one
config value — no code change either way. See `docs/ROADMAP.md` and
`docs/CURRENT_STATE.md` for the full phase status, and
`docs/openapi/chat.yaml` for the API contract this implements.

## Prerequisites

- Go 1.26+
- A running PostgreSQL 13+ (schema is applied automatically on startup —
  see below)

## Configuration

Read from the environment by `internal/config.Load`. Full walkthrough,
including the exact values and troubleshooting: **[SETUP.md](SETUP.md)**.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VAANISETU_DATABASE_URL` | yes | — | e.g. `postgres://user:pass@localhost:5432/vaanisetu` |
| `VAANISETU_PORT` | no | `8080` | HTTP listen port |
| `VAANISETU_LLM_SERVICE_URL` | no | unset | When unset, uses `FakeLLMClient`. Set to the running Python `llm` service's URL (e.g. `http://localhost:8090`, see `../ai-services/SETUP.md`) to use `HTTPLLMClient` instead — no code change either way. |
| `VAANISETU_ALLOWED_ORIGIN` | no | `http://localhost:4200` | The one origin CORS allows — never `*`. |
| `VAANISETU_LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, or `error` |

## Run locally

```bash
cp .env.example .env    # once
make run                 # auto-loads .env — see SETUP.md
```

(`export VAANISETU_DATABASE_URL=... && go run ./cmd/api` also works, but
needs that `export` repeated in every new shell — `make run` doesn't.)

The database schema (`sessions`, `turns`) is applied automatically on
startup via embedded `goose` migrations — no separate migration step is
required.

## Or via Docker Compose (from the repository root)

```bash
docker compose up
```

This has not been run in the environment this was built in (no Docker
available there) — verify it on a machine with Docker before relying on it.

## Development commands

```bash
go build ./...
go vet ./...
go test ./...              # Postgres integration tests skip themselves if no Docker daemon is found
gofmt -l .                 # should print nothing
golangci-lint run ./...    # requires golangci-lint v2; go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
```

## Changing the schema

Add a new file to `migrations/` (e.g. `0002_whatever.sql`) with
`-- +goose Up` / `-- +goose Down` sections — see `0001_init.sql`. It's
picked up automatically by `migrations/embed.go`'s `//go:embed *.sql`; no
other wiring is needed.

## Changing a query

Edit `internal/db/queries/conversation.sql`, then regenerate:

```bash
sqlc generate   # go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```

Never hand-edit the generated files in `internal/db/` (`models.go`,
`conversation.sql.go`, `db.go`).
