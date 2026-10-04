package documents_test

import (
	"context"
	"hash/fnv"
	"testing"
	"time"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/documents"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
)

// contentHashEmbeddingClient is a stronger fake than
// fixedDimensionEmbeddingClient (worker_integration_test.go): it hashes
// the full request text, not just its length, into a 768-dimension
// vector. That gives it one real, useful property without needing a real
// model: identical text always produces an identical vector (distance
// exactly 0), and different text produces a different one — enough to
// test Retrieve's mechanical correctness (ranking, status filtering)
// deterministically. It has no actual semantic/similarity behavior
// (unlike multilingual-e5-base) — that's exactly what this milestone's
// own live verification against the real model covers instead (see
// docs/DECISIONS.md's Milestone 7d ADR).
type contentHashEmbeddingClient struct{}

func (contentHashEmbeddingClient) Embed(_ context.Context, req embedding.EmbedRequest) (embedding.EmbedResponse, error) {
	vector := make([]float32, 768)
	for i := range vector {
		h := fnv.New32a()
		_, _ = h.Write([]byte(req.Text))
		_, _ = h.Write([]byte{byte(i)})
		vector[i] = float32(h.Sum32()%2000)/1000 - 1 // roughly [-1, 1)
	}
	return embedding.EmbedResponse{Vector: vector, Dimensions: len(vector)}, nil
}

func TestService_Retrieve_RanksTheMatchingChunkFirst(t *testing.T) {
	pool := newTestPool(t)
	svc := documents.NewService(pool, contentHashEmbeddingClient{})
	worker := documents.NewWorker(pool, contentHashEmbeddingClient{}, testLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	docA, err := svc.CreateDocument(ctx, "Doc A", "VaaniSetu is a local-first voice assistant.")
	if err != nil {
		t.Fatalf("CreateDocument(A) error = %v", err)
	}
	if _, err := svc.CreateDocument(ctx, "Doc B", "The Eiffel Tower is located in Paris."); err != nil {
		t.Fatalf("CreateDocument(B) error = %v", err)
	}

	for range 2 {
		if err := worker.Tick(ctx); err != nil {
			t.Fatalf("Tick() error = %v", err)
		}
	}

	// A query identical to Doc A's own content embeds to the exact same
	// vector under this fake client, so it must rank first (distance 0).
	results, err := svc.Retrieve(ctx, "VaaniSetu is a local-first voice assistant.", 2)
	if err != nil {
		t.Fatalf("Retrieve() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("Retrieve() returned %d results, want 2", len(results))
	}
	if results[0].DocumentID != docA.ID {
		t.Errorf("results[0].DocumentID = %q, want Doc A (%q)", results[0].DocumentID, docA.ID)
	}
	if results[0].Distance != 0 {
		t.Errorf("results[0].Distance = %v, want 0 for an identical query", results[0].Distance)
	}
	if results[0].Distance > results[1].Distance {
		t.Errorf("results not ordered by ascending distance: %+v", results)
	}
}

func TestService_Retrieve_NeverReturnsAPendingDocumentsChunks(t *testing.T) {
	pool := newTestPool(t)
	svc := documents.NewService(pool, contentHashEmbeddingClient{})
	worker := documents.NewWorker(pool, contentHashEmbeddingClient{}, testLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	ready, err := svc.CreateDocument(ctx, "Ready Doc", "This document will be processed by the worker.")
	if err != nil {
		t.Fatalf("CreateDocument(ready) error = %v", err)
	}
	if _, err := svc.CreateDocument(ctx, "Pending Doc", "This document is deliberately left pending."); err != nil {
		t.Fatalf("CreateDocument(pending) error = %v", err)
	}

	// Only one tick: processes exactly one of the two pending documents,
	// leaving the other one "pending" on purpose.
	if err := worker.Tick(ctx); err != nil {
		t.Fatalf("Tick() error = %v", err)
	}

	docs, err := svc.ListDocuments(ctx)
	if err != nil {
		t.Fatalf("ListDocuments() error = %v", err)
	}
	var readyCount, pendingCount int
	for _, d := range docs {
		switch d.Status {
		case "ready":
			readyCount++
		case "pending":
			pendingCount++
		}
	}
	if readyCount != 1 || pendingCount != 1 {
		t.Fatalf("ListDocuments() = %+v, want exactly one ready and one pending", docs)
	}

	results, err := svc.Retrieve(ctx, "document", 10)
	if err != nil {
		t.Fatalf("Retrieve() error = %v", err)
	}
	for _, r := range results {
		if r.DocumentID != ready.ID {
			t.Errorf("Retrieve() returned a chunk from document %q, want only the ready document %q", r.DocumentID, ready.ID)
		}
	}
}
