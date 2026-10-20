package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// embedWireRequest/embedWireResponse are the JSON shapes on the wire for
// POST {baseURL}/v1/embed, per proto/embedding.openapi.yaml. Both sides
// are JSON — text in, a vector out — the same shape as internal/langid's
// detect call, unlike internal/asr's binary-in or internal/tts's
// binary-out shapes.
type embedWireRequest struct {
	Text string `json:"text"`
}

type embedWireResponse struct {
	Vector     []float32 `json:"vector"`
	Dimensions int       `json:"dimensions"`
}

// HTTPEmbeddingClient implements [EmbeddingClient] by calling the real
// Python `embedding` capability over HTTP. Not wired up to any real
// Python service until Milestone 7b selects a model.
type HTTPEmbeddingClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPEmbeddingClient returns an [HTTPEmbeddingClient] that calls
// baseURL + "/v1/embed". baseURL should have no trailing slash, e.g.
// "http://ai-services:8090" — the same host:port as every other
// capability's HTTP client when all capabilities are hosted in the same
// Python process (see docs/DEVELOPMENT.md §5).
func NewHTTPEmbeddingClient(baseURL string) *HTTPEmbeddingClient {
	return &HTTPEmbeddingClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			// Embedding one chunk of text is expected to be fast (no
			// audio, a small model); this is a safety bound, not a tuned
			// latency budget — Milestone 7b may revisit once a real
			// model's latency is measured.
			Timeout: 10 * time.Second,
		},
	}
}

// Embed implements [EmbeddingClient]. A non-2xx response, a network
// failure, or an unreadable response body all surface as a wrapped error.
func (c *HTTPEmbeddingClient) Embed(ctx context.Context, req EmbedRequest) (EmbedResponse, error) {
	body, err := json.Marshal(embedWireRequest(req))
	if err != nil {
		return EmbedResponse{}, fmt.Errorf("embedding: encode request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx, http.MethodPost, c.baseURL+"/v1/embed", bytes.NewReader(body),
	)
	if err != nil {
		return EmbedResponse{}, fmt.Errorf("embedding: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return EmbedResponse{}, fmt.Errorf("embedding: call %s: %w", c.baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return EmbedResponse{}, fmt.Errorf("embedding: %s returned status %d", c.baseURL, resp.StatusCode)
	}

	var wire embedWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return EmbedResponse{}, fmt.Errorf("embedding: decode response: %w", err)
	}

	return EmbedResponse(wire), nil
}
