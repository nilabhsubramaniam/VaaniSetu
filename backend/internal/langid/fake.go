package langid

import "context"

// FakeLangIDClient implements [LangIDClient] with no network call and no
// model: a tiny, self-contained Unicode-range check, not a reuse of
// internal/conversation.DetectScript (that would create an import cycle —
// internal/conversation depends on this package for the interface, not
// the other way around). It exists so the persistence and DTO plumbing
// can be built and tested before the Python `langid` capability exists,
// the same role FakeASRClient/FakeTTSClient played for their capabilities.
//
// This is deliberately not a language-identification algorithm: any text
// containing a Devanagari character is reported as "hi"; everything else
// is reported as "en". It cannot distinguish Hinglish from English, or
// Hindi from any other Devanagari-script language — that is exactly the
// real capability Milestone 6b builds.
type FakeLangIDClient struct{}

// NewFakeLangIDClient returns a ready-to-use [FakeLangIDClient]. It holds
// no state, so a zero-value FakeLangIDClient{} works equally well; this
// constructor exists only so call sites read the same way regardless of
// which LangIDClient implementation is being wired up.
func NewFakeLangIDClient() *FakeLangIDClient {
	return &FakeLangIDClient{}
}

// Detect implements [LangIDClient]. It never returns an error.
func (c *FakeLangIDClient) Detect(_ context.Context, req DetectRequest) (DetectResponse, error) {
	for _, r := range req.Text {
		if r >= 0x0900 && r <= 0x097F { // Unicode Devanagari block
			return DetectResponse{Language: "hi", Confidence: 1.0}, nil
		}
	}
	return DetectResponse{Language: "en", Confidence: 1.0}, nil
}
