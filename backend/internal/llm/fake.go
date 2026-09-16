package llm

import "context"

// cannedReplies mirrors, on the Go side, the same illustrative purpose as
// the frontend's CANNED_REPLIES table
// (frontend/src/app/core/services/conversation.mock.service.ts): proving
// Hindi and Hinglish round-trip correctly, not simulating real model
// quality. There is no LLM behind this — see docs/ROADMAP.md Phase 2
// Milestone 2a.
var cannedReplies = map[string]string{
	"hi":       "नमस्ते! यह अभी एक डेमो जवाब है — असली मॉडल Milestone 2b में जुड़ेगा।",
	"hinglish": "Hey! Abhi ye ek demo reply hai — asli local model Milestone 2b mein connect hoga.",
	"en":       "Hi! This is a demo reply for now — a real local model connects in Milestone 2b.",
}

// FakeLLMClient implements [LLMClient] with no network call and no model:
// a canned reply per language, falling back to English for any language
// not in the table. It is deterministic and fast on purpose, so the rest
// of the backend (API, persistence) can be built and tested against it
// before the Python service exists.
type FakeLLMClient struct{}

// NewFakeLLMClient returns a ready-to-use [FakeLLMClient]. It holds no
// state, so a zero-value FakeLLMClient{} works equally well; this
// constructor exists only so call sites read the same way regardless of
// which LLMClient implementation is being wired up.
func NewFakeLLMClient() *FakeLLMClient {
	return &FakeLLMClient{}
}

// Generate implements [LLMClient]. It never returns an error.
func (c *FakeLLMClient) Generate(_ context.Context, req GenerateRequest) (GenerateResponse, error) {
	reply, ok := cannedReplies[req.Language]
	if !ok {
		reply = cannedReplies["en"]
	}
	return GenerateResponse{Reply: reply}, nil
}
