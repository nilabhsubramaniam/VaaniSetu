-- name: CreateDocument :one
INSERT INTO documents (title, content)
VALUES ($1, $2)
RETURNING *;

-- name: ListDocuments :many
SELECT * FROM documents
ORDER BY created_at DESC;
