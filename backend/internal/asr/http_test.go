package asr

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPASRClient_Transcribe_Success(t *testing.T) {
	sentAudio := []byte("pretend audio bytes")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/transcribe" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.URL.Query().Get("language"); got != "hi" {
			t.Errorf("language query param = %q, want hi", got)
		}
		if got := r.Header.Get("Content-Type"); got != "audio/webm" {
			t.Errorf("Content-Type = %q, want audio/webm", got)
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}
		if string(body) != string(sentAudio) {
			t.Errorf("request body = %q, want the sent audio bytes", body)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(transcribeWireResponse{Transcript: "आज मौसम कैसा है?"})
	}))
	defer server.Close()

	client := NewHTTPASRClient(server.URL)
	resp, err := client.Transcribe(context.Background(), TranscribeRequest{
		Audio:       sentAudio,
		ContentType: "audio/webm",
		Language:    "hi",
	})
	if err != nil {
		t.Fatalf("Transcribe() error = %v", err)
	}
	if resp.Transcript != "आज मौसम कैसा है?" {
		t.Errorf("Transcript = %q, want the server's transcript", resp.Transcript)
	}
}

func TestHTTPASRClient_Transcribe_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHTTPASRClient(server.URL)
	_, err := client.Transcribe(context.Background(), TranscribeRequest{Language: "en"})
	if err == nil {
		t.Fatal("Transcribe() error = nil, want an error for a 500 response")
	}
}

func TestHTTPASRClient_Transcribe_Unreachable(t *testing.T) {
	client := NewHTTPASRClient("http://127.0.0.1:1")
	_, err := client.Transcribe(context.Background(), TranscribeRequest{Language: "en"})
	if err == nil {
		t.Fatal("Transcribe() error = nil, want an error when the service is unreachable")
	}
}

func TestHTTPASRClient_Transcribe_DefaultsContentType(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Content-Type"); got != "application/octet-stream" {
			t.Errorf("Content-Type = %q, want application/octet-stream when unset", got)
		}
		_ = json.NewEncoder(w).Encode(transcribeWireResponse{Transcript: "ok"})
	}))
	defer server.Close()

	client := NewHTTPASRClient(server.URL)
	if _, err := client.Transcribe(context.Background(), TranscribeRequest{Language: "en"}); err != nil {
		t.Fatalf("Transcribe() error = %v", err)
	}
}
