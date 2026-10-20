package documents_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/documents"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
)

// fixedDimensionEmbeddingClient returns a deterministic 768-dimension
// vector — the real dimension document_chunks.embedding is declared as
// (docs/DECISIONS.md ADR-037). Deliberately not embedding.FakeEmbeddingClient,
// whose 8-dimension output would violate that column's fixed width.
type fixedDimensionEmbeddingClient struct{}

func (fixedDimensionEmbeddingClient) Embed(_ context.Context, req embedding.EmbedRequest) (embedding.EmbedResponse, error) {
	vector := make([]float32, 768)
	for i := range vector {
		vector[i] = float32(len(req.Text)%97) / 97
	}
	return embedding.EmbedResponse{Vector: vector, Dimensions: len(vector)}, nil
}

var errEmbeddingUnavailable = errors.New("embedding service unavailable")

type failingEmbeddingClient struct{}

func (failingEmbeddingClient) Embed(context.Context, embedding.EmbedRequest) (embedding.EmbedResponse, error) {
	return embedding.EmbedResponse{}, errEmbeddingUnavailable
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestWorker_Tick_ChunksEmbedsAndMarksDocumentReady(t *testing.T) {
	pool := newTestPool(t)
	svc := documents.NewService(pool, fixedDimensionEmbeddingClient{})
	worker := documents.NewWorker(pool, fixedDimensionEmbeddingClient{}, testLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	content := "This is a short document about VaaniSetu, a local voice bridge."
	created, err := svc.CreateDocument(ctx, "Worker Test Doc", content)
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	if created.Status != "pending" {
		t.Fatalf("Status = %q, want %q before the worker runs", created.Status, "pending")
	}

	if err := worker.Tick(ctx); err != nil {
		t.Fatalf("Tick() error = %v", err)
	}

	docs, err := svc.ListDocuments(ctx)
	if err != nil {
		t.Fatalf("ListDocuments() error = %v", err)
	}
	if len(docs) != 1 || docs[0].Status != "ready" {
		t.Fatalf("ListDocuments() = %+v, want exactly one document with status %q", docs, "ready")
	}
}

func TestWorker_Tick_NoPendingDocumentReturnsNoRows(t *testing.T) {
	pool := newTestPool(t)
	worker := documents.NewWorker(pool, fixedDimensionEmbeddingClient{}, testLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := worker.Tick(ctx); err == nil {
		t.Fatal("Tick() error = nil, want pgx.ErrNoRows when nothing is pending")
	}
}

func TestWorker_Tick_EmbeddingFailureMarksDocumentFailedWithNoOrphanedChunks(t *testing.T) {
	pool := newTestPool(t)
	svc := documents.NewService(pool, failingEmbeddingClient{})
	worker := documents.NewWorker(pool, failingEmbeddingClient{}, testLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	created, err := svc.CreateDocument(ctx, "Doomed Doc", "content that will fail to embed")
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}

	if err := worker.Tick(ctx); !errors.Is(err, errEmbeddingUnavailable) {
		t.Fatalf("Tick() error = %v, want %v", err, errEmbeddingUnavailable)
	}

	docs, err := svc.ListDocuments(ctx)
	if err != nil {
		t.Fatalf("ListDocuments() error = %v", err)
	}
	if len(docs) != 1 || docs[0].Status != "failed" {
		t.Fatalf("ListDocuments() = %+v, want exactly one document with status %q", docs, "failed")
	}

	var documentID pgtype.UUID
	if err := documentID.Scan(created.ID); err != nil {
		t.Fatalf("parse document ID: %v", err)
	}
	chunks, err := db.New(pool).ListChunksByDocument(ctx, documentID)
	if err != nil {
		t.Fatalf("ListChunksByDocument() error = %v", err)
	}
	if len(chunks) != 0 {
		t.Errorf("ListChunksByDocument() = %d chunks, want 0 — the failed tick's insert must have rolled back", len(chunks))
	}
}
