-- name: CreateSession :one
INSERT INTO sessions DEFAULT VALUES
RETURNING *;

-- name: GetMostRecentSession :one
SELECT * FROM sessions
ORDER BY started_at DESC
LIMIT 1;

-- name: CreateTurn :one
INSERT INTO turns (session_id, role, language, text, latency_ms, script)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListTurnsBySession :many
SELECT * FROM turns
WHERE session_id = $1
ORDER BY created_at ASC;
