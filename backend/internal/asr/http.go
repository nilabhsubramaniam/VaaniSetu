package asr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// transcribeWireResponse is the JSON shape on the wire for
// POST {baseURL}/v1/transcribe's response, per proto/asr.openapi.yaml.
// Kept private and separate from [TranscribeResponse] so the wire format
// can change without touching the ASRClient interface its callers depend
// on.
type transcribeWireResponse struct {
	Transcript string `json:"transcript"`
}

// HTTPASRClient implements [ASRClient] by calling the real Python `asr`
// capability over HTTP with a raw binary body — unlike internal/llm's
// JSON request, audio isn't naturally JSON-shaped, so proto/asr.openapi.yaml
// carries it as the request body directly, with the language passed as a
// query parameter instead of a JSON field.
type HTTPASRClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPASRClient returns an [HTTPASRClient] that calls
// baseURL + "/v1/transcribe". baseURL should have no trailing slash, e.g.
// "http://ai-services:8090" — the same host:port as [llm.NewHTTPLLMClient]
// when both capabilities are hosted in the same Python process (see
// docs/DEVELOPMENT.md §5).
func NewHTTPASRClient(baseURL string) *HTTPASRClient {
	return &HTTPASRClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			// Transcribing a single short utterance is expected to take
			// a few seconds at most on the hardware tiers
			// docs/ARCHITECTURE.md targets; this is a safety bound, not a
			// tuned latency budget.
			Timeout: 30 * time.Second,
		},
	}
}

// Transcribe implements [ASRClient]. A non-2xx response, a network
// failure, or a malformed response body all surface as a wrapped error —
// the caller (internal/api) maps any error from this method to the
// asr_unavailable error code, per the Phase 3 API contract.
func (c *HTTPASRClient) Transcribe(ctx context.Context, req TranscribeRequest) (TranscribeResponse, error) {
	u, err := url.Parse(c.baseURL + "/v1/transcribe")
	if err != nil {
		return TranscribeResponse{}, fmt.Errorf("asr: build url: %w", err)
	}
	q := u.Query()
	q.Set("language", req.Language)
	u.RawQuery = q.Encode()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewReader(req.Audio))
	if err != nil {
		return TranscribeResponse{}, fmt.Errorf("asr: build request: %w", err)
	}
	contentType := req.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	httpReq.Header.Set("Content-Type", contentType)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return TranscribeResponse{}, fmt.Errorf("asr: call %s: %w", c.baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return TranscribeResponse{}, fmt.Errorf("asr: %s returned status %d", c.baseURL, resp.StatusCode)
	}

	var wire transcribeWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return TranscribeResponse{}, fmt.Errorf("asr: decode response: %w", err)
	}

	return TranscribeResponse(wire), nil
}
