// Package embedding defines the backend's `embedding` capability
// boundary: the one interface every caller depends on, and two
// interchangeable implementations selected by configuration rather than
// by code change — the same mechanism internal/llm, internal/asr,
// internal/tts, and internal/langid use (see docs/ARCHITECTURE.md §5).
//
//   - [FakeEmbeddingClient] returns a deterministic, fixed-length vector
//     with no network call and no model. It exists so the document
//     upload API and persistence can be built and tested before any real
//     embedding model is chosen (Phase 7 Milestone 7a) — the same role
//     FakeLangIDClient played for langid in Milestone 6a. Nothing in 7a
//     actually calls it on the upload path yet; it establishes the
//     interface for Milestone 7b to wire chunking/embedding against.
//   - [HTTPEmbeddingClient] will call the real Python `embedding`
//     capability over the contract in proto/embedding.openapi.yaml, once
//     Milestone 7b selects a real model (its vector dimension is not yet
//     known — see docs/DECISIONS.md for this milestone's ADR).
//
// Which one is wired up in cmd/api/main.go depends on one thing:
// config.Config.UsesFakeEmbedding.
package embedding

import "context"

// EmbedRequest is what a caller asks the embedding capability to vectorize.
type EmbedRequest struct {
	// Text is the already-chunked passage (or query) to embed. Chunking
	// itself is not this capability's job (docs/ARCHITECTURE.md §3.2/3.3
	// — Go dispatches chunking/embedding jobs to Python as a pair, but
	// the chunking step is plain text-splitting, not inference; it is
	// Milestone 7b's job to decide exactly where that split happens).
	Text string
}

// EmbedResponse is the embedding capability's answer to an [EmbedRequest].
type EmbedResponse struct {
	// Vector is the dense embedding, in whatever dimension the selected
	// model produces. Callers must not assume a fixed length across
	// implementations — [FakeEmbeddingClient]'s length is arbitrary and
	// will not match a real model's.
	Vector []float32
	// Dimensions is len(Vector), carried explicitly so callers (and a
	// future pgvector column definition) never have to infer it.
	Dimensions int
}

// EmbeddingClient is the capability interface every caller depends on.
// Callers must never type-switch on the concrete implementation — doing
// so would defeat the entire point of this interface.
type EmbeddingClient interface {
	// Embed vectorizes req.Text. Implementations should return a non-nil
	// error rather than an empty Vector on failure, so callers can
	// distinguish an operational failure (surfaced as
	// embedding_unavailable) from a genuine (currently impossible) zero
	// vector.
	Embed(ctx context.Context, req EmbedRequest) (EmbedResponse, error)
}
