package asr

import "context"

// cannedTranscripts mirrors internal/llm's cannedReplies: proving the
// audio-upload plumbing round-trips correctly, not simulating real
// transcription quality. There is no ASR model behind this, and the
// actual recorded audio is never inspected — see docs/ROADMAP.md Phase 3
// Milestone 3a.
var cannedTranscripts = map[string]string{
	"hi":       "आज मौसम कैसा है?",
	"hinglish": "Bhai, mujhe kal ka reminder set karna hai.",
	"en":       "What's on my schedule today?",
}

// FakeASRClient implements [ASRClient] with no network call and no model:
// a canned transcript per language, falling back to English for any
// language not in the table, regardless of what audio was actually sent.
// It exists so the rest of the backend (API, persistence) and the
// frontend's real audio-capture code can be built and tested before the
// Python `asr` capability exists.
type FakeASRClient struct{}

// NewFakeASRClient returns a ready-to-use [FakeASRClient]. It holds no
// state, so a zero-value FakeASRClient{} works equally well; this
// constructor exists only so call sites read the same way regardless of
// which ASRClient implementation is being wired up.
func NewFakeASRClient() *FakeASRClient {
	return &FakeASRClient{}
}

// Transcribe implements [ASRClient]. It never returns an error and never
// actually looks at req.Audio.
func (c *FakeASRClient) Transcribe(_ context.Context, req TranscribeRequest) (TranscribeResponse, error) {
	transcript, ok := cannedTranscripts[req.Language]
	if !ok {
		transcript = cannedTranscripts["en"]
	}
	return TranscribeResponse{Transcript: transcript}, nil
}
