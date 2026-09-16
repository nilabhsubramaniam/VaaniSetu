package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPLLMClient_Generate_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/generate" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}

		var got generateWireRequest
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if got.Text != "आज मौसम कैसा है?" || got.Language != "hi" {
			t.Errorf("unexpected request body: %+v", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(generateWireResponse{Reply: "बादल छाए रहेंगे।"})
	}))
	defer server.Close()

	client := NewHTTPLLMClient(server.URL)
	resp, err := client.Generate(context.Background(), GenerateRequest{
		Text:     "आज मौसम कैसा है?",
		Language: "hi",
	})
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if resp.Reply != "बादल छाए रहेंगे।" {
		t.Errorf("Reply = %q, want the server's reply", resp.Reply)
	}
}

func TestHTTPLLMClient_Generate_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHTTPLLMClient(server.URL)
	_, err := client.Generate(context.Background(), GenerateRequest{Text: "hi", Language: "en"})
	if err == nil {
		t.Fatal("Generate() error = nil, want an error for a 500 response")
	}
}

func TestHTTPLLMClient_Generate_Unreachable(t *testing.T) {
	client := NewHTTPLLMClient("http://127.0.0.1:1")
	_, err := client.Generate(context.Background(), GenerateRequest{Text: "hi", Language: "en"})
	if err == nil {
		t.Fatal("Generate() error = nil, want an error when the service is unreachable")
	}
}
