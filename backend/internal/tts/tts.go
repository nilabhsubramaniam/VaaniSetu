// Package tts defines the backend's `tts` capability boundary: the one
// interface every caller depends on, and two interchangeable
// implementations selected by configuration rather than by code change —
// the same mechanism internal/llm and internal/asr use for their
// capabilities (see docs/ARCHITECTURE.md §5).
//
//   - [FakeTTSClient] returns a short, real, playable WAV tone with no
//     network call and no model. It exists so the Go API and the
//     frontend's real audio-playback code can be built and tested before
//     any Python TTS service exists (Phase 4 Milestone 4a).
//   - [HTTPTTSClient] calls the real Python `tts` capability over the
//     contract in proto/tts.openapi.yaml (Phase 4 Milestone 4b).
//
// Which one is wired up in cmd/api/main.go depends on one thing:
// config.Config.UsesFakeTTS.
package tts

import "context"

// SynthesizeRequest is what a caller asks the TTS capability to speak.
type SynthesizeRequest struct {
	// Text is the reply text to synthesize into speech, in whatever
	// script it was written/generated in.
	Text string
	// Language is the LanguageCode the caller has selected, one of the
	// same values used throughout
	// (frontend/src/app/core/models/language.model.ts).
	Language string
	// Voice is one of "female" or "male" (ADR-023) — both are real,
	// simultaneously-loaded voices on the Python side, not a hint. Empty
	// defaults to "female", matching proto/tts.openapi.yaml and the
	// Python service's own default.
	Voice string
}

// SynthesizeResponse is the TTS capability's answer to a
// [SynthesizeRequest].
type SynthesizeResponse struct {
	// Audio is the synthesized audio bytes, encoded per ContentType.
	// Never persisted server-side — the caller streams it straight back
	// to the browser for playback.
	Audio []byte
	// ContentType is the audio's MIME type, e.g. "audio/wav". Passed
	// through unexamined by Go; only the browser's <audio>/Web Audio
	// playback needs to know it.
	ContentType string
}

// TTSClient is the capability interface every caller (internal/api)
// depends on. Callers must never type-switch on the concrete
// implementation — doing so would defeat the entire point of this
// interface.
type TTSClient interface {
	// Synthesize produces spoken audio for req. Implementations should
	// return a non-nil error rather than empty Audio on failure, mirroring
	// [llm.LLMClient.Generate]/[asr.ASRClient.Transcribe]'s rule.
	Synthesize(ctx context.Context, req SynthesizeRequest) (SynthesizeResponse, error)
}
