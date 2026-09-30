package langid

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPLangIDClient_Detect_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/detect" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", got)
		}

		var req detectWireRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Text != "आज मौसम कैसा है?" {
			t.Errorf("request body = %+v, want text echoed", req)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(detectWireResponse{Language: "hi", Confidence: 0.97})
	}))
	defer server.Close()

	client := NewHTTPLangIDClient(server.URL)
	resp, err := client.Detect(context.Background(), DetectRequest{Text: "आज मौसम कैसा है?"})
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if resp.Language != "hi" {
		t.Errorf("Language = %q, want hi", resp.Language)
	}
	if resp.Confidence != 0.97 {
		t.Errorf("Confidence = %v, want 0.97", resp.Confidence)
	}
}

func TestHTTPLangIDClient_Detect_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHTTPLangIDClient(server.URL)
	_, err := client.Detect(context.Background(), DetectRequest{Text: "hi"})
	if err == nil {
		t.Fatal("Detect() error = nil, want an error for a 500 response")
	}
}

func TestHTTPLangIDClient_Detect_Unreachable(t *testing.T) {
	client := NewHTTPLangIDClient("http://127.0.0.1:1")
	_, err := client.Detect(context.Background(), DetectRequest{Text: "hi"})
	if err == nil {
		t.Fatal("Detect() error = nil, want an error when the service is unreachable")
	}
}

func TestHTTPLangIDClient_Detect_MalformedResponseBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("not json"))
	}))
	defer server.Close()

	client := NewHTTPLangIDClient(server.URL)
	_, err := client.Detect(context.Background(), DetectRequest{Text: "hi"})
	if err == nil {
		t.Fatal("Detect() error = nil, want an error for a malformed response body")
	}
}
