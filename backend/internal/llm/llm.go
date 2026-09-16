// Package llm defines the backend's `llm` capability boundary: the one
// interface every caller depends on, and two interchangeable
// implementations selected by configuration rather than by code change —
// the mechanism docs/ARCHITECTURE.md §5 requires for every AI capability.
//
//   - [FakeLLMClient] returns a canned per-language reply with no network
//     call. It exists so the Go API, persistence, and frontend integration
//     can be built and tested before any Python service exists (Phase 2
//     Milestone 2a).
//   - [HTTPLLMClient] calls the real Python `llm` service over the
//     contract in proto/llm.openapi.yaml (Phase 2 Milestone 2b).
//
// Which one is wired up in cmd/api/main.go depends on one thing:
// config.Config.UsesFakeLLM.
package llm

import "context"

// GenerateRequest is what a caller asks the LLM capability to answer.
type GenerateRequest struct {
	// Text is the user's message, already trimmed and validated non-empty
	// by the caller.
	Text string
	// Language is one of the LanguageCode values the frontend already
	// defines (frontend/src/app/core/models/language.model.ts) — the two
	// sides are not type-shared across languages, so proto/llm.openapi.yaml
	// is the single normative list both must match.
	Language string
}

// GenerateResponse is the LLM capability's answer to a [GenerateRequest].
type GenerateResponse struct {
	// Reply is the assistant's reply text, in the same language as the
	// request.
	Reply string
}

// LLMClient is the capability interface every caller (internal/api) depends
// on. Callers must never type-switch on the concrete implementation —
// doing so would defeat the entire point of this interface.
type LLMClient interface {
	// Generate produces a reply for req. Implementations should return a
	// non-nil error rather than an empty Reply on failure, so callers can
	// distinguish "the model said nothing" (which would be a bug) from
	// "the call failed" (which is an operational condition to surface as
	// llm_unavailable).
	Generate(ctx context.Context, req GenerateRequest) (GenerateResponse, error)
}
