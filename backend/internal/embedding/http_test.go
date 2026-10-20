package embedding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPEmbeddingClient_Embed_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/embed" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", got)
		}

		var req embedWireRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Text != "some passage" {
			t.Errorf("request body = %+v, want text echoed", req)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(embedWireResponse{Vector: []float32{0.1, 0.2, 0.3}, Dimensions: 3})
	}))
	defer server.Close()

	client := NewHTTPEmbeddingClient(server.URL)
	resp, err := client.Embed(context.Background(), EmbedRequest{Text: "some passage"})
	if err != nil {
		t.Fatalf("Embed() error = %v", err)
	}
	if resp.Dimensions != 3 || len(resp.Vector) != 3 {
		t.Errorf("resp = %+v, want a 3-dimensional vector", resp)
	}
}

func TestHTTPEmbeddingClient_Embed_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHTTPEmbeddingClient(server.URL)
	_, err := client.Embed(context.Background(), EmbedRequest{Text: "text"})
	if err == nil {
		t.Fatal("Embed() error = nil, want an error for a 500 response")
	}
}

func TestHTTPEmbeddingClient_Embed_Unreachable(t *testing.T) {
	client := NewHTTPEmbeddingClient("http://127.0.0.1:1")
	_, err := client.Embed(context.Background(), EmbedRequest{Text: "text"})
	if err == nil {
		t.Fatal("Embed() error = nil, want an error when the service is unreachable")
	}
}

func TestHTTPEmbeddingClient_Embed_MalformedResponseBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("not json"))
	}))
	defer server.Close()

	client := NewHTTPEmbeddingClient(server.URL)
	_, err := client.Embed(context.Background(), EmbedRequest{Text: "text"})
	if err == nil {
		t.Fatal("Embed() error = nil, want an error for a malformed response body")
	}
}
