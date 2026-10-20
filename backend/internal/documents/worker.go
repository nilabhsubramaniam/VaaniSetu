package documents

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
)

// Worker turns "pending" documents into "ready" (or "failed") ones by
// chunking their content and embedding each chunk — the async job
// dispatch docs/ARCHITECTURE.md §3.2 requires ("never embed inline in a
// request") and Milestones 7a/7b deliberately left unbuilt.
//
// It uses PostgreSQL itself as the durable job queue (`SELECT ... FOR
// UPDATE SKIP LOCKED` on documents.status = 'pending') instead of an
// in-process channel/goroutine-pool or a new external queue (Redis,
// etc.): the state that matters — which documents still need
// processing — already lives in the documents table, so a job survives
// a process restart with no extra code and no new external dependency,
// consistent with this project's local-first, no-unnecessary-
// dependencies rule (AGENTS.md §4).
type Worker struct {
	pool            *pgxpool.Pool
	embeddingClient embedding.EmbeddingClient
	logger          *slog.Logger
}

// NewWorker builds a Worker backed by pool and embeddingClient.
func NewWorker(pool *pgxpool.Pool, embeddingClient embedding.EmbeddingClient, logger *slog.Logger) *Worker {
	return &Worker{pool: pool, embeddingClient: embeddingClient, logger: logger}
}

// Run polls for pending documents every interval until ctx is canceled.
// A poll that finds no pending document, or that fails outright, is
// logged (if it's a real error) and retried on the next tick — this is
// the same "log, don't crash the process" posture every other
// capability failure in this codebase already takes.
func (w *Worker) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := w.Tick(ctx); err != nil && !errors.Is(err, pgx.ErrNoRows) {
				w.logger.Error("documents worker: tick failed", "error", err)
			}
		}
	}
}

// Tick claims at most one pending document and processes it fully
// (chunk, embed every chunk, mark ready) or fails it (mark failed, no
// partial chunks left behind). It returns pgx.ErrNoRows when there was
// nothing pending, so Run can treat that as a normal, quiet outcome
// rather than an error worth logging. Exported so tests can process one
// document deterministically instead of racing Run's ticker.
func (w *Worker) Tick(ctx context.Context) error {
	tx, err := w.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // best-effort; commit path below is what matters

	queries := db.New(tx)

	claimed, err := queries.ClaimPendingDocument(ctx)
	if err != nil {
		return err
	}

	chunks := SplitIntoChunks(claimed.Content)
	for i, chunk := range chunks {
		result, err := w.embeddingClient.Embed(ctx, embedding.EmbedRequest{Text: chunk})
		if err != nil {
			return w.rollbackAndFail(ctx, tx, claimed.ID, err)
		}
		if _, err := queries.CreateDocumentChunk(ctx, db.CreateDocumentChunkParams{
			DocumentID: claimed.ID,
			ChunkIndex: int32(i), //nolint:gosec // chunk counts are small; no realistic overflow
			Content:    chunk,
			Embedding:  pgvector.NewVector(result.Vector),
		}); err != nil {
			return w.rollbackAndFail(ctx, tx, claimed.ID, err)
		}
	}

	if err := queries.MarkDocumentReady(ctx, claimed.ID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// rollbackAndFail rolls back tx immediately, releasing the row lock
// ClaimPendingDocument's `FOR UPDATE` took, before recording the failure
// through a separate connection (db.New(w.pool), not tx or queries).
// Order matters: marking the document failed while tx still holds that
// row's lock would make this exact goroutine wait forever on a lock only
// it can release — a real self-deadlock found live during this
// milestone's own end-to-end verification (killing the embedding service
// mid-flight wedged the row indefinitely), not a hypothetical.
func (w *Worker) rollbackAndFail(ctx context.Context, tx pgx.Tx, id pgtype.UUID, cause error) error {
	if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
		w.logger.Error("documents worker: rollback failed", "error", err)
	}
	if err := db.New(w.pool).MarkDocumentFailed(ctx, id); err != nil {
		w.logger.Error("documents worker: failed to record document failure", "error", err)
	}
	return cause
}
