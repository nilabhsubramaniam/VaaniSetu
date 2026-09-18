// Package asr defines the backend's `asr` capability boundary: the one
// interface every caller depends on, and two interchangeable
// implementations selected by configuration rather than by code change —
// the same mechanism internal/llm uses for the `llm` capability (see
// docs/ARCHITECTURE.md §5).
//
//   - [FakeASRClient] returns a canned per-language transcript with no
//     network call. It exists so the Go API and the frontend's real
//     audio-capture code can be built and tested before any Python ASR
//     service exists (Phase 3 Milestone 3a).
//   - [HTTPASRClient] calls the real Python `asr` capability over the
//     contract in proto/asr.openapi.yaml (Phase 3 Milestone 3b).
//
// Which one is wired up in cmd/api/main.go depends on one thing:
// config.Config.UsesFakeASR.
package asr

import "context"

// TranscribeRequest is what a caller asks the ASR capability to
// transcribe.
type TranscribeRequest struct {
	// Audio is the raw recorded audio bytes, in whatever encoding the
	// browser produced (see ContentType). Never persisted — discarded
	// once this call returns, per docs/PROJECT_GOAL.md's "raw audio is
	// discarded after transcription by default."
	Audio []byte
	// ContentType is the audio's MIME type, e.g. "audio/webm". Passed
	// through unexamined by Go; only the ASR engine needs to decode it
	// (docs/ARCHITECTURE.md §3.3, "own audio utilities").
	ContentType string
	// Language is the LanguageCode the caller has selected, one of the
	// same values used throughout
	// (frontend/src/app/core/models/language.model.ts).
	Language string
}

// TranscribeResponse is the ASR capability's answer to a
// [TranscribeRequest].
type TranscribeResponse struct {
	// Transcript is the recognized text, in whatever script the speaker
	// actually used.
	Transcript string
}

// ASRClient is the capability interface every caller (internal/api)
// depends on. Callers must never type-switch on the concrete
// implementation — doing so would defeat the entire point of this
// interface.
type ASRClient interface {
	// Transcribe produces a transcript for req. Implementations should
	// return a non-nil error rather than an empty Transcript on failure,
	// mirroring [llm.LLMClient.Generate]'s rule — callers distinguish "no
	// speech recognized" from "the call failed" themselves by checking
	// the returned text once err is nil.
	Transcribe(ctx context.Context, req TranscribeRequest) (TranscribeResponse, error)
}
