// Integration tests against a real, containerized PostgreSQL, per
// docs/DEVELOPMENT.md §8 — same pattern as
// internal/conversation/conversation_integration_test.go. These require a
// working Docker daemon; when one isn't available the tests skip
// themselves with a clear message rather than failing the suite.
package documents_test

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/documents"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/migrations"
)

func skipIfNoDocker(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("skipping: no docker binary on PATH — this test needs a Docker daemon (docs/DEVELOPMENT.md §8)")
	}
}

// newTestService starts a real Postgres container, applies the schema via
// the exact same db.Migrate path cmd/api/main.go uses in production, and
// returns a documents.Service backed by it, using FakeEmbeddingClient —
// never called by this milestone's methods (see documents.Service's
// package doc comment), but wired the same way production does.
func newTestService(t *testing.T) *documents.Service {
	t.Helper()
	skipIfNoDocker(t)

	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:16-alpine",
		postgres.WithDatabase("vaanisetu_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		_ = container.Terminate(context.Background())
	})

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	if _, err := db.Migrate(ctx, connStr, migrations.FS); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	pool, err := db.NewPool(ctx, connStr)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	t.Cleanup(pool.Close)

	return documents.NewService(pool, embedding.NewFakeEmbeddingClient())
}

func TestService_CreateDocument_PersistsWithPendingStatus(t *testing.T) {
	svc := newTestService(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	doc, err := svc.CreateDocument(ctx, "My Document", "Some real content")
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	if doc.ID == "" {
		t.Error("CreateDocument() returned an empty ID")
	}
	if doc.Title != "My Document" {
		t.Errorf("Title = %q, want %q", doc.Title, "My Document")
	}
	if doc.Content != "Some real content" {
		t.Errorf("Content = %q, want %q", doc.Content, "Some real content")
	}
	if doc.Status != "pending" {
		t.Errorf("Status = %q, want %q — Milestone 7a never transitions it", doc.Status, "pending")
	}
	if doc.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero")
	}
}

func TestService_ListDocuments_ReturnsMostRecentFirst(t *testing.T) {
	svc := newTestService(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	first, err := svc.CreateDocument(ctx, "First", "content one")
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	second, err := svc.CreateDocument(ctx, "Second", "content two")
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}

	docs, err := svc.ListDocuments(ctx)
	if err != nil {
		t.Fatalf("ListDocuments() error = %v", err)
	}
	if len(docs) != 2 {
		t.Fatalf("ListDocuments() returned %d documents, want 2", len(docs))
	}
	if docs[0].ID != second.ID || docs[1].ID != first.ID {
		t.Errorf("ListDocuments() order = [%s, %s], want most-recent-first [%s, %s]",
			docs[0].Title, docs[1].Title, second.Title, first.Title)
	}
}

func TestService_ListDocuments_EmptyWhenNoneCreated(t *testing.T) {
	svc := newTestService(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	docs, err := svc.ListDocuments(ctx)
	if err != nil {
		t.Fatalf("ListDocuments() error = %v", err)
	}
	if len(docs) != 0 {
		t.Errorf("ListDocuments() returned %d documents, want 0", len(docs))
	}
}
