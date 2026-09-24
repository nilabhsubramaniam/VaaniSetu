package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// synthesizeWireRequest is the JSON shape on the wire for
// POST {baseURL}/v1/synthesize's request, per proto/tts.openapi.yaml. Text
// is naturally JSON-shaped (like internal/llm's request), unlike
// internal/asr's binary-in request — the audio here is on the response
// side instead.
type synthesizeWireRequest struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

// HTTPTTSClient implements [TTSClient] by calling the real Python `tts`
// capability over HTTP: a JSON request (text in) and a raw binary response
// (audio out) — the mirror image of [asr.HTTPASRClient]'s binary-in,
// JSON-out shape.
type HTTPTTSClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPTTSClient returns an [HTTPTTSClient] that calls
// baseURL + "/v1/synthesize". baseURL should have no trailing slash, e.g.
// "http://ai-services:8090" — the same host:port as [llm.NewHTTPLLMClient]
// and [asr.NewHTTPASRClient] when all three capabilities are hosted in the
// same Python process (see docs/DEVELOPMENT.md §5).
func NewHTTPTTSClient(baseURL string) *HTTPTTSClient {
	return &HTTPTTSClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			// Synthesizing a single reply is expected to take a few
			// seconds at most on the hardware tiers docs/ARCHITECTURE.md
			// targets; this is a safety bound, not a tuned latency budget.
			Timeout: 30 * time.Second,
		},
	}
}

// Synthesize implements [TTSClient]. A non-2xx response, a network
// failure, or an unreadable response body all surface as a wrapped
// error — the caller (internal/api) maps any error from this method to the
// tts_unavailable error code, per the Phase 4 API contract.
func (c *HTTPTTSClient) Synthesize(ctx context.Context, req SynthesizeRequest) (SynthesizeResponse, error) {
	body, err := json.Marshal(synthesizeWireRequest(req))
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("tts: encode request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx, http.MethodPost, c.baseURL+"/v1/synthesize", bytes.NewReader(body),
	)
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("tts: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("tts: call %s: %w", c.baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return SynthesizeResponse{}, fmt.Errorf("tts: %s returned status %d", c.baseURL, resp.StatusCode)
	}

	audio, err := io.ReadAll(resp.Body)
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("tts: read response: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "audio/wav"
	}

	return SynthesizeResponse{Audio: audio, ContentType: contentType}, nil
}
