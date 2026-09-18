#!/usr/bin/env bash
# scripts/dev.sh — start/stop/restart VaaniSetu's three local dev services
# (ai-services, backend, frontend) as a single command. Safe to re-run at
# any time: `start` always frees each port first, so it never leaves a
# stale duplicate process behind if a service was already running — the
# exact "kill whatever's on the port, then start fresh" sequence this
# project's docs have used by hand throughout development.
#
# This does NOT set anything up — Postgres, .env files, and downloaded
# models are still your job (see backend/SETUP.md and
# ai-services/SETUP.md). It only starts/stops the three processes.
#
# Usage (from anywhere in the repo):
#   scripts/dev.sh start     # start all three (frees each port first)
#   scripts/dev.sh stop      # stop all three
#   scripts/dev.sh restart   # stop, then start
#   scripts/dev.sh status    # show what's running where
#
# Ports read from the same env vars the services themselves use
# (VAANISETU_PORT, VAANISETU_LLM_PORT), so a non-default configuration is
# respected automatically. Logs land in .dev-logs/<service>.log
# (git-ignored) — check there first if a service doesn't come up.
#
# Assumes these ports are dedicated to VaaniSetu's own dev services, the
# same assumption every manual `lsof -ti:PORT | kill` in this project's
# history has made — it does not try to distinguish "someone else's
# process" from "a stale VaaniSetu process" on the same port.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.dev-logs"

AI_SERVICES_PORT="${VAANISETU_LLM_PORT:-8090}"
BACKEND_PORT="${VAANISETU_PORT:-8080}"
FRONTEND_PORT="4200"

SERVICES="ai-services:$AI_SERVICES_PORT backend:$BACKEND_PORT frontend:$FRONTEND_PORT"

is_up() {
  lsof -i:"$1" >/dev/null 2>&1
}

free_port() {
  local port="$1" name="$2" pids
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping $name (port $port, pid $(echo "$pids" | tr '\n' ' '))"
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

wait_for_port() {
  local port="$1" name="$2" tries=0
  until is_up "$port" || [ "$tries" -ge 60 ]; do
    sleep 1
    tries=$((tries + 1))
  done
  if is_up "$port"; then
    echo "$name is up on :$port"
  else
    echo "Warning: $name did not come up on :$port within 60s — check $LOG_DIR/$name.log" >&2
  fi
}

cmd_stop() {
  for entry in $SERVICES; do
    free_port "${entry#*:}" "${entry%%:*}"
  done
}

cmd_start() {
  mkdir -p "$LOG_DIR"

  if ! pg_isready >/dev/null 2>&1; then
    echo "Warning: PostgreSQL doesn't appear reachable (pg_isready failed)." >&2
    echo "  The backend needs it running — see backend/SETUP.md." >&2
  fi

  free_port "$AI_SERVICES_PORT" "ai-services"
  echo "Starting ai-services on :$AI_SERVICES_PORT (log: $LOG_DIR/ai-services.log) ..."
  (cd "$ROOT_DIR/ai-services" && nohup make run >"$LOG_DIR/ai-services.log" 2>&1 &)
  wait_for_port "$AI_SERVICES_PORT" "ai-services"

  free_port "$BACKEND_PORT" "backend"
  echo "Starting backend on :$BACKEND_PORT (log: $LOG_DIR/backend.log) ..."
  (cd "$ROOT_DIR/backend" && nohup make run >"$LOG_DIR/backend.log" 2>&1 &)
  wait_for_port "$BACKEND_PORT" "backend"

  free_port "$FRONTEND_PORT" "frontend"
  echo "Starting frontend on :$FRONTEND_PORT (log: $LOG_DIR/frontend.log) ..."
  (cd "$ROOT_DIR/frontend" && nohup npm start >"$LOG_DIR/frontend.log" 2>&1 &)
  wait_for_port "$FRONTEND_PORT" "frontend"

  echo
  cmd_status
}

cmd_status() {
  for entry in $SERVICES; do
    local name="${entry%%:*}" port="${entry#*:}"
    if is_up "$port"; then
      echo "  $name: UP on :$port"
    else
      echo "  $name: down"
    fi
  done
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  *)
    echo "Usage: $(basename "$0") {start|stop|restart|status}" >&2
    exit 1
    ;;
esac
