package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// generateWireRequest and generateWireResponse are the JSON shapes on the
// wire for POST {baseURL}/v1/generate, per proto/llm.openapi.yaml. They are
// kept private and separate from [GenerateRequest]/[GenerateResponse] so
// the wire format can change without touching the LLMClient interface its
// callers depend on.
type generateWireRequest struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

type generateWireResponse struct {
	Reply string `json:"reply"`
}

// HTTPLLMClient implements [LLMClient] by calling the real Python `llm`
// service over HTTP+JSON (see proto/llm.openapi.yaml for the full
// contract, and docs/DECISIONS.md for why HTTP+JSON rather than gRPC was
// chosen for Phase 2).
type HTTPLLMClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPLLMClient returns an [HTTPLLMClient] that calls baseURL + "/v1/generate".
// baseURL should have no trailing slash, e.g. "http://ai-services:8090".
func NewHTTPLLMClient(baseURL string) *HTTPLLMClient {
	return &HTTPLLMClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			// A local model call is expected to take a few seconds at most
			// on the hardware tiers docs/ARCHITECTURE.md targets; this is a
			// safety bound, not a tuned latency budget.
			Timeout: 30 * time.Second,
		},
	}
}

// Generate implements [LLMClient]. A non-2xx response, a network failure,
// or a malformed response body all surface as a wrapped error — the caller
// (internal/api) maps any error from this method to the llm_unavailable
// error code, per the Phase 2 API contract.
func (c *HTTPLLMClient) Generate(ctx context.Context, req GenerateRequest) (GenerateResponse, error) {
	body, err := json.Marshal(generateWireRequest(req))
	if err != nil {
		return GenerateResponse{}, fmt.Errorf("llm: encode request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx, http.MethodPost, c.baseURL+"/v1/generate", bytes.NewReader(body),
	)
	if err != nil {
		return GenerateResponse{}, fmt.Errorf("llm: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return GenerateResponse{}, fmt.Errorf("llm: call %s: %w", c.baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return GenerateResponse{}, fmt.Errorf("llm: %s returned status %d", c.baseURL, resp.StatusCode)
	}

	var wire generateWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return GenerateResponse{}, fmt.Errorf("llm: decode response: %w", err)
	}

	return GenerateResponse(wire), nil
}
