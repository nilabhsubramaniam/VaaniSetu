package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPTTSClient_Synthesize_Success(t *testing.T) {
	wantAudio := []byte("pretend wav bytes")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/synthesize" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", got)
		}

		var req synthesizeWireRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Text != "आज मौसम कैसा है?" || req.Language != "hi" {
			t.Errorf("request body = %+v, want text/language echoed", req)
		}

		w.Header().Set("Content-Type", "audio/wav")
		_, _ = w.Write(wantAudio)
	}))
	defer server.Close()

	client := NewHTTPTTSClient(server.URL)
	resp, err := client.Synthesize(context.Background(), SynthesizeRequest{
		Text:     "आज मौसम कैसा है?",
		Language: "hi",
	})
	if err != nil {
		t.Fatalf("Synthesize() error = %v", err)
	}
	if string(resp.Audio) != string(wantAudio) {
		t.Errorf("Audio = %q, want %q", resp.Audio, wantAudio)
	}
	if resp.ContentType != "audio/wav" {
		t.Errorf("ContentType = %q, want audio/wav", resp.ContentType)
	}
}

func TestHTTPTTSClient_Synthesize_PassesThroughVoice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req synthesizeWireRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Voice != "male" {
			t.Errorf("Voice = %q, want male", req.Voice)
		}
		w.Header().Set("Content-Type", "audio/wav")
		_, _ = w.Write([]byte("audio"))
	}))
	defer server.Close()

	client := NewHTTPTTSClient(server.URL)
	_, err := client.Synthesize(context.Background(), SynthesizeRequest{
		Text: "hi", Language: "en", Voice: "male",
	})
	if err != nil {
		t.Fatalf("Synthesize() error = %v", err)
	}
}

func TestHTTPTTSClient_Synthesize_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHTTPTTSClient(server.URL)
	_, err := client.Synthesize(context.Background(), SynthesizeRequest{Text: "hi", Language: "en"})
	if err == nil {
		t.Fatal("Synthesize() error = nil, want an error for a 500 response")
	}
}

func TestHTTPTTSClient_Synthesize_Unreachable(t *testing.T) {
	client := NewHTTPTTSClient("http://127.0.0.1:1")
	_, err := client.Synthesize(context.Background(), SynthesizeRequest{Text: "hi", Language: "en"})
	if err == nil {
		t.Fatal("Synthesize() error = nil, want an error when the service is unreachable")
	}
}

// roundTripperFunc lets a test supply a response without going through a
// real net/http server — needed here because a real Go server always
// sniffs and sets some Content-Type for a non-empty body, making it
// impossible to genuinely exercise the "server sent none at all" fallback
// through httptest.NewServer.
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestHTTPTTSClient_Synthesize_DefaultsContentType(t *testing.T) {
	client := &HTTPTTSClient{
		baseURL: "http://example.invalid",
		httpClient: &http.Client{
			Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{}, // deliberately no Content-Type
					Body:       io.NopCloser(bytes.NewReader([]byte("audio bytes"))),
				}, nil
			}),
		},
	}

	resp, err := client.Synthesize(context.Background(), SynthesizeRequest{Text: "hi", Language: "en"})
	if err != nil {
		t.Fatalf("Synthesize() error = %v", err)
	}
	if resp.ContentType != "audio/wav" {
		t.Errorf("ContentType = %q, want audio/wav default when the server omits it", resp.ContentType)
	}
}

func TestHTTPTTSClient_Synthesize_ReadsFullBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = body
		_, _ = w.Write(make([]byte, 4096))
	}))
	defer server.Close()

	client := NewHTTPTTSClient(server.URL)
	resp, err := client.Synthesize(context.Background(), SynthesizeRequest{Text: "hi", Language: "en"})
	if err != nil {
		t.Fatalf("Synthesize() error = %v", err)
	}
	if len(resp.Audio) != 4096 {
		t.Errorf("len(Audio) = %d, want 4096", len(resp.Audio))
	}
}
