-- name: CreateDocument :one
INSERT INTO documents (title, content)
VALUES ($1, $2)
RETURNING *;

-- name: ListDocuments :many
SELECT * FROM documents
ORDER BY created_at DESC;

-- name: ClaimPendingDocument :one
SELECT * FROM documents
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- name: CreateDocumentChunk :one
INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListChunksByDocument :many
SELECT * FROM document_chunks
WHERE document_id = $1
ORDER BY chunk_index;

-- name: MarkDocumentReady :exec
UPDATE documents SET status = 'ready' WHERE id = $1;

-- name: MarkDocumentFailed :exec
UPDATE documents SET status = 'failed' WHERE id = $1;
