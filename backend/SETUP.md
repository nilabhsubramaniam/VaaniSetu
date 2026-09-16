# Backend Setup

Everything below was actually run and verified on a real PostgreSQL
instance while writing this guide — not copied from what the code is
*supposed* to do. If a step here ever stops matching reality, trust the
code (`internal/config`, `cmd/api/main.go`) over this file and fix this
file.

## Prerequisites

- Go 1.26+ (`go version`)
- A PostgreSQL server (13+) reachable from this machine. This guide uses
  Homebrew's `postgresql@18` as the concrete example; any Postgres works
  the same way — only the "start the server" step differs.
- Docker is **not** required. See "Docker (optional)" at the end.

## Environment Variables

Read once, at startup, by `internal/config.Load` via plain `os.Getenv` —
the Go binary itself never reads a `.env` file.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VAANISETU_DATABASE_URL` | **Yes** | — | Standard PostgreSQL URL. `Load()` fails immediately if this is unset — see Troubleshooting below. |
| `VAANISETU_PORT` | No | `8080` | HTTP listen port |
| `VAANISETU_LLM_SERVICE_URL` | No | unset | Leave unset to use `llm.FakeLLMClient` (no real model yet — Milestone 2a). Set once the Python `llm` service (Milestone 2b) exists, to use `HTTPLLMClient` instead. No code change either way. |
| `VAANISETU_LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |

**Do this once:**

```bash
cp backend/.env.example backend/.env
```

`backend/.env` is git-ignored (verify with `git check-ignore backend/.env`
if unsure) and is now genuinely used, not just a reference copy: every
`make` target (`make run`, `make test`, ...) auto-loads it and exports its
variables before running anything — see `backend/Makefile`'s top few
lines. This is specifically so a brand-new terminal, or an IDE's terminal
panel, doesn't hit "VAANISETU_DATABASE_URL is required" just because
nobody re-ran `export` in it — `export` only lasts for one shell session,
`.env` + `make` doesn't have that problem.

Running `go run ./cmd/api` directly, **without** `make`, still needs the
variable exported manually in that shell first:

```bash
export VAANISETU_DATABASE_URL="postgres://vaanisetu:vaanisetu@localhost:5432/vaanisetu?sslmode=disable"
go run ./cmd/api
```

**Prefer `make run` over raw `go run` day to day** — it's the same
command underneath, it just isn't sensitive to which terminal you're
typing in.

## PostgreSQL Setup

Start the server (Homebrew example):

```bash
brew services start postgresql@18
pg_isready   # should print "accepting connections"
```

Create the role and database `VAANISETU_DATABASE_URL` above expects —
these exact credentials also match what `docker-compose.yml` uses, so the
same connection string works whether Postgres runs natively or via
Compose (only the hostname changes: `localhost` here, `postgres` under
Compose):

```bash
psql -d postgres -c "CREATE ROLE vaanisetu WITH LOGIN PASSWORD 'vaanisetu';"
createdb -O vaanisetu vaanisetu
```

Verify the exact URL the backend will use actually connects:

```bash
psql "postgres://vaanisetu:vaanisetu@localhost:5432/vaanisetu?sslmode=disable" -c "select 1;"
```

## Database Migration

**Nothing to run separately.** Migrations (`backend/migrations/*.sql`) are
embedded into the compiled binary and applied automatically every time
the backend starts (`internal/db.Migrate`, called first thing in
`cmd/api/main.go`, before the pool used for requests even opens). A fresh
database goes from empty to fully migrated on the first `go run`.

## Install Dependencies

```bash
cd backend
go mod download
```

(`go run`/`go build` do this automatically if you skip it — there's no
separate lockfile-install step the way `npm install` has one.)

## Run Backend

```bash
cd backend
make run
```

(equivalent to `export VAANISETU_DATABASE_URL=... && go run ./cmd/api`,
but reads `backend/.env` instead of needing that `export` in this exact
shell — see "Environment Variables" above.)

Expected output:

```json
{"time":"...","level":"INFO","msg":"migrations applied","count":1}
{"time":"...","level":"WARN","msg":"no VAANISETU_LLM_SERVICE_URL set — using FakeLLMClient (Milestone 2a behavior)"}
{"time":"...","level":"INFO","msg":"listening","port":"8080","usesFakeLLM":true}
```

(`"count":1"` only on the very first run against a fresh database — `0`
on every run after that, since goose tracks which migrations already
applied.)

## Verify Backend

There is no dedicated `/health` endpoint yet (a known gap — see
`docs/CURRENT_STATE.md`). Use the real API instead:

```bash
curl -X POST http://localhost:8080/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"आज मौसम कैसा है?","language":"hi"}'

curl http://localhost:8080/api/v1/chat/history
```

Both should return `200` with a JSON body — see `docs/openapi/chat.yaml`
for the full shape.

## Run Tests

```bash
cd backend
go build ./...
go vet ./...
go test ./...
gofmt -l .                 # prints nothing if clean
golangci-lint run ./...    # go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
```

The Postgres integration tests in `internal/conversation` use
`testcontainers-go` and **require Docker** — they skip themselves with a
clear message if no `docker` binary is found, rather than failing. They
do not need the native Postgres set up above; they start and tear down
their own container.

Or, with the Makefile:

```bash
make check   # build + vet + test + fmt-check + lint
```

## Troubleshooting

**`ERROR fatal error="config: VAANISETU_DATABASE_URL is required"`**
`internal/config.Load` checks for this variable and refuses to start
rather than silently doing something wrong — it means the variable
genuinely isn't set in whatever ran the process. Two fixes, in order of
preference:
1. Make sure `backend/.env` exists (`cp backend/.env.example backend/.env`
   once), then use `make run` / `make test` / etc. instead of raw `go`
   commands — the Makefile loads it automatically, so it doesn't matter
   which terminal or IDE panel you're in.
2. If you're intentionally running `go run ./cmd/api` directly (not via
   `make`), `export VAANISETU_DATABASE_URL=...` in that *exact* shell
   first — a `.env` file does nothing unless something actually reads it,
   and the raw Go binary doesn't.

The single most common cause of seeing this error *again* after already
fixing it once is opening a new terminal — a plain `export` doesn't carry
over; `make` + `.env` is the fix for that specifically.

**`db: ping: ...connection refused`**
Postgres isn't running. `brew services start postgresql@18` (or your
platform's equivalent), then `pg_isready` to confirm.

**`db: ping: ...password authentication failed` / `role "vaanisetu" does not exist`**
The role/database from "PostgreSQL Setup" above hasn't been created yet
in *this* Postgres instance, or the password doesn't match. Re-run those
two `psql`/`createdb` commands.

**Port 8080 already in use**
Another process (maybe a previous `go run` that didn't exit) is on it.
Set `VAANISETU_PORT` to something else, or find and stop the other
process.

**Frontend's browser console shows `TypeError: Failed to fetch` / `HttpErrorResponse ... status: 0`**
The browser never reached this backend at all — a genuine HTTP error (400,
502, ...) would show a real status code instead. Almost always means this
process wasn't actually running (or was mid-restart) when the frontend
sent the request. Confirm with `curl http://localhost:8080/api/v1/chat/history`;
if that also fails to connect, (re)start the backend. If curl succeeds but
the browser still fails, look for a second, separate CORS-specific line in
the browser console — that points to `VAANISETU_ALLOWED_ORIGIN` not
matching the frontend's actual origin, not a backend crash.

## Docker (optional)

Not required — everything above runs the backend natively. If you'd
rather use Compose instead of a native Postgres install:

```bash
docker compose up
```

This has been reviewed for consistency with the native setup (same
credentials, same database name) but has not been run end-to-end in the
environment this guide was written in, since Docker wasn't available
there. Verify it yourself before relying on it.
