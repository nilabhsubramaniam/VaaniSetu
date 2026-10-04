// Package documents is the business-logic layer behind the document
// upload API (Phase 7 Milestone 7a). It owns persisting uploaded
// documents and listing them back.
//
// Takes an [embedding.EmbeddingClient] at construction, the same way
// conversation.Service takes its capability clients, but deliberately
// does not call it from any method yet: this milestone only establishes
// the upload/storage boundary, the same way Milestone 2a's
// conversation.Service persisted chat turns before any real LLM existed.
// Chunking, embedding, and the "pending" -> "ready"/"failed" status
// transition are Milestone 7b's job, once a real embedding model and a
// real job-dispatch mechanism exist (docs/ARCHITECTURE.md §3.2 requires
// chunking/embedding to be dispatched as an async job, not done inline in
// the upload request — a pattern this milestone does not yet build).
package documents

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
)

// Document is the domain representation of one uploaded document,
// decoupled from the sqlc-generated db.Document (pgtype-based) and the
// HTTP-facing JSON DTO in internal/api — the same separation
// conversation.Turn keeps from db.Turn.
type Document struct {
	ID        string
	Title     string
	Content   string
	Status    string // "pending" | "ready" | "failed"
	CreatedAt time.Time
}

// Service is the business-logic layer behind the document upload API.
type Service struct {
	queries *db.Queries
	// embeddingClient is stored but not yet called by any method (see
	// package doc comment) — threaded through now so Milestone 7b can
	// start chunking/embedding without changing this constructor's
	// signature again.
	embeddingClient embedding.EmbeddingClient
}

// NewService builds a Service backed by pool and embeddingClient.
func NewService(pool *pgxpool.Pool, embeddingClient embedding.EmbeddingClient) *Service {
	return &Service{queries: db.New(pool), embeddingClient: embeddingClient}
}

// CreateDocument persists a new document with title and content, always
// with status "pending" — this milestone never transitions it further
// (see package doc comment).
func (s *Service) CreateDocument(ctx context.Context, title, content string) (Document, error) {
	row, err := s.queries.CreateDocument(ctx, db.CreateDocumentParams{Title: title, Content: content})
	if err != nil {
		return Document{}, fmt.Errorf("documents: create: %w", err)
	}
	return toDomain(row), nil
}

// ListDocuments returns every document, most recently created first.
func (s *Service) ListDocuments(ctx context.Context) ([]Document, error) {
	rows, err := s.queries.ListDocuments(ctx)
	if err != nil {
		return nil, fmt.Errorf("documents: list: %w", err)
	}
	result := make([]Document, len(rows))
	for i, row := range rows {
		result[i] = toDomain(row)
	}
	return result, nil
}

// RetrievedChunk is one passage returned by [Service.Retrieve], ordered
// by relevance (Distance ascending — cosine distance, 0 is identical,
// larger is less similar, matching document_chunks's HNSW
// vector_cosine_ops index).
type RetrievedChunk struct {
	DocumentID string
	ChunkIndex int32
	Content    string
	Distance   float64
}

// Retrieve embeds queryText and returns the topK most similar chunks
// across every "ready" document (Milestone 7c's Worker never leaves a
// half-chunked document findable — a "pending" or "failed" document's
// chunks, if any partial ones existed, are excluded by SearchChunks'
// own join). Plain top-k cosine similarity, no reranking and no
// relevance-score cutoff (Phase 7 Milestone 7d; see
// docs/DECISIONS.md for why both are deferred to a later milestone
// rather than guessed at here).
func (s *Service) Retrieve(ctx context.Context, queryText string, topK int) ([]RetrievedChunk, error) {
	embedded, err := s.embeddingClient.Embed(ctx, embedding.EmbedRequest{Text: queryText})
	if err != nil {
		return nil, fmt.Errorf("documents: embed query: %w", err)
	}

	rows, err := s.queries.SearchChunks(ctx, db.SearchChunksParams{
		Embedding: pgvector.NewVector(embedded.Vector),
		Limit:     int32(topK), //nolint:gosec // topK is a small, internal, fixed constant
	})
	if err != nil {
		return nil, fmt.Errorf("documents: search chunks: %w", err)
	}

	result := make([]RetrievedChunk, len(rows))
	for i, row := range rows {
		result[i] = RetrievedChunk{
			DocumentID: row.DocumentID.String(),
			ChunkIndex: row.ChunkIndex,
			Content:    row.Content,
			Distance:   row.Distance,
		}
	}
	return result, nil
}

func toDomain(row db.Document) Document {
	return Document{
		ID:        row.ID.String(),
		Title:     row.Title,
		Content:   row.Content,
		Status:    row.Status,
		CreatedAt: row.CreatedAt.Time,
	}
}
