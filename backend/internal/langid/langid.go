// Package langid defines the backend's `langid` capability boundary: the
// one interface every caller depends on, and two interchangeable
// implementations selected by configuration rather than by code change —
// the same mechanism internal/llm, internal/asr, and internal/tts use
// (see docs/ARCHITECTURE.md §5).
//
// This is a genuinely new capability, not a variant of an existing one:
// backend/migrations/0002_add_script.sql's own comment says script
// detection is "not a language-identification model — that stays Phase 6's
// job" (docs/DECISIONS.md ADR-017). Script is a deterministic Unicode-range
// classification (internal/conversation.DetectScript); language ID is the
// harder problem of which language, e.g. telling Hindi apart from other
// Devanagari-script languages, or Hinglish from English in Latin script.
//
//   - [FakeLangIDClient] runs a tiny, self-contained heuristic with no
//     network call and no model. It exists so the persistence/DTO
//     plumbing can be built and tested before any Python `langid`
//     capability exists (Phase 6 Milestone 6a).
//   - [HTTPLangIDClient] calls the real Python `langid` capability over
//     the contract in proto/langid.openapi.yaml (Phase 6 Milestone 6b).
//
// Which one is wired up in cmd/api/main.go depends on one thing:
// config.Config.UsesFakeLangID.
package langid

import "context"

// DetectRequest is what a caller asks the langid capability to classify.
type DetectRequest struct {
	// Text is the already-transcribed or typed text to detect the
	// language of, in whatever script it was written/spoken in.
	Text string
}

// DetectResponse is the langid capability's answer to a [DetectRequest].
type DetectResponse struct {
	// Language is the detected LanguageCode, one of the same values used
	// throughout (frontend/src/app/core/models/language.model.ts).
	Language string
	// Confidence is the implementation's own confidence in Language, in
	// [0, 1]. Not yet used to drive any decision (docs/DECISIONS.md
	// ADR-026) — carried through for a future milestone.
	Confidence float64
}

// LangIDClient is the capability interface every caller (currently
// internal/conversation) depends on. Callers must never type-switch on
// the concrete implementation — doing so would defeat the entire point of
// this interface.
type LangIDClient interface {
	// Detect classifies req.Text's language. Implementations should
	// return a non-nil error rather than a zero-value DetectResponse on
	// failure — callers treat a detection failure as non-fatal to
	// whatever turn triggered it (docs/DECISIONS.md ADR-026), the same
	// way a TTS failure is non-fatal (ADR-020).
	Detect(ctx context.Context, req DetectRequest) (DetectResponse, error)
}
