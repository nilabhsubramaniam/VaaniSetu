package langid

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// detectWireRequest/detectWireResponse are the JSON shapes on the wire for
// POST {baseURL}/v1/detect, per proto/langid.openapi.yaml. Both sides are
// JSON — text in, a classification out — unlike internal/asr's binary-in
// or internal/tts's binary-out shapes, since neither side of this
// capability is audio.
type detectWireRequest struct {
	Text string `json:"text"`
}

type detectWireResponse struct {
	Language   string  `json:"language"`
	Confidence float64 `json:"confidence"`
}

// HTTPLangIDClient implements [LangIDClient] by calling the real Python
// `langid` capability over HTTP.
type HTTPLangIDClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPLangIDClient returns an [HTTPLangIDClient] that calls
// baseURL + "/v1/detect". baseURL should have no trailing slash, e.g.
// "http://ai-services:8090" — the same host:port as [llm.NewHTTPLLMClient]/
// [asr.NewHTTPASRClient]/[tts.NewHTTPTTSClient] when every capability is
// hosted in the same Python process (see docs/DEVELOPMENT.md §5).
func NewHTTPLangIDClient(baseURL string) *HTTPLangIDClient {
	return &HTTPLangIDClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			// Classifying one short text is expected to be fast (no audio,
			// a small model); this is a safety bound, not a tuned latency
			// budget.
			Timeout: 10 * time.Second,
		},
	}
}

// Detect implements [LangIDClient]. A non-2xx response, a network
// failure, or an unreadable response body all surface as a wrapped error.
func (c *HTTPLangIDClient) Detect(ctx context.Context, req DetectRequest) (DetectResponse, error) {
	body, err := json.Marshal(detectWireRequest(req))
	if err != nil {
		return DetectResponse{}, fmt.Errorf("langid: encode request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx, http.MethodPost, c.baseURL+"/v1/detect", bytes.NewReader(body),
	)
	if err != nil {
		return DetectResponse{}, fmt.Errorf("langid: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return DetectResponse{}, fmt.Errorf("langid: call %s: %w", c.baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return DetectResponse{}, fmt.Errorf("langid: %s returned status %d", c.baseURL, resp.StatusCode)
	}

	var wire detectWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return DetectResponse{}, fmt.Errorf("langid: decode response: %w", err)
	}

	return DetectResponse(wire), nil
}
