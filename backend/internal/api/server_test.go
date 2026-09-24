package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/asr"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/tts"
)

// fakeConversationService lets handler tests exercise internal/api without
// a real database, per the ConversationService interface introduced for
// exactly this purpose.
type fakeConversationService struct {
	sendMessageFunc func(ctx context.Context, text, language string) (conversation.Turn, conversation.Turn, error)
	historyFunc     func(ctx context.Context) ([]conversation.Turn, error)
}

func (f *fakeConversationService) SendMessage(ctx context.Context, text, language string) (conversation.Turn, conversation.Turn, error) {
	return f.sendMessageFunc(ctx, text, language)
}

func (f *fakeConversationService) History(ctx context.Context) ([]conversation.Turn, error) {
	return f.historyFunc(ctx)
}

// fakeASRClient lets handler tests exercise internal/api without a real
// Python ASR service, mirroring fakeConversationService's shape.
type fakeASRClient struct {
	transcribeFunc func(ctx context.Context, req asr.TranscribeRequest) (asr.TranscribeResponse, error)
}

func (f *fakeASRClient) Transcribe(ctx context.Context, req asr.TranscribeRequest) (asr.TranscribeResponse, error) {
	return f.transcribeFunc(ctx, req)
}

// defaultFakeASR is a harmless stand-in for tests that exercise the chat
// endpoints and never call transcription at all.
func defaultFakeASR() *fakeASRClient {
	return &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{Transcript: "unused"}, nil
		},
	}
}

// fakeTTSClient lets handler tests exercise internal/api without a real
// Python TTS service, mirroring fakeASRClient's shape.
type fakeTTSClient struct {
	synthesizeFunc func(ctx context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error)
}

func (f *fakeTTSClient) Synthesize(ctx context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
	return f.synthesizeFunc(ctx, req)
}

// defaultFakeTTS is a harmless stand-in for tests that exercise the chat
// or transcription endpoints and never call synthesis at all.
func defaultFakeTTS() *fakeTTSClient {
	return &fakeTTSClient{
		synthesizeFunc: func(context.Context, tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			return tts.SynthesizeResponse{Audio: []byte("unused"), ContentType: "audio/wav"}, nil
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

const testOrigin = "http://localhost:4200"

func TestHandleChat_Success(t *testing.T) {
	now := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	latency := int32(120)
	fake := &fakeConversationService{
		sendMessageFunc: func(_ context.Context, text, language string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{ID: "u1", Role: "user", Text: text, Language: language, CreatedAt: now},
				conversation.Turn{ID: "a1", Role: "assistant", Text: "reply", Language: language, CreatedAt: now, LatencyMs: &latency},
				nil
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "आज मौसम कैसा है?", Language: "hi"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}

	var resp chatResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.UserTurn.Text != "आज मौसम कैसा है?" || resp.AssistantTurn.Text != "reply" {
		t.Errorf("unexpected response body: %+v", resp)
	}
	if resp.AssistantTurn.LatencyMs == nil || *resp.AssistantTurn.LatencyMs != 120 {
		t.Errorf("LatencyMs = %v, want 120", resp.AssistantTurn.LatencyMs)
	}
}

func TestHandleChat_EmptyText(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "   ", Language: "hi"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleChat_UnknownLanguage(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "hello", Language: "fr"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleChat_MalformedJSON(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleChat_LLMUnavailable(t *testing.T) {
	fake := &fakeConversationService{
		sendMessageFunc: func(_ context.Context, _, _ string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{}, conversation.Turn{}, conversation.ErrGenerateFailed
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "hello", Language: "en"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadGateway, "llm_unavailable")
}

func TestHandleChat_InternalError(t *testing.T) {
	fake := &fakeConversationService{
		sendMessageFunc: func(_ context.Context, _, _ string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{}, conversation.Turn{}, errUnexpected
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "hello", Language: "en"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusInternalServerError, "internal")
}

func TestHandleHistory_ReturnsTurns(t *testing.T) {
	fake := &fakeConversationService{
		historyFunc: func(_ context.Context) ([]conversation.Turn, error) {
			return []conversation.Turn{{ID: "u1", Role: "user", Text: "hi", Language: "en"}}, nil
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp historyResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Turns) != 1 || resp.Turns[0].Text != "hi" {
		t.Errorf("unexpected history response: %+v", resp)
	}
}

func TestHandleHistory_EmptySession(t *testing.T) {
	fake := &fakeConversationService{
		historyFunc: func(_ context.Context) ([]conversation.Turn, error) {
			return []conversation.Turn{}, nil
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	var resp historyResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Turns) != 0 {
		t.Errorf("Turns = %v, want empty slice", resp.Turns)
	}
}

func assertErrorResponse(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if rec.Code != wantStatus {
		t.Fatalf("status = %d, want %d; body = %s", rec.Code, wantStatus, rec.Body.String())
	}
	var resp errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if resp.Error.Code != wantCode {
		t.Errorf("Error.Code = %q, want %q", resp.Error.Code, wantCode)
	}
	if resp.Error.Message == "" {
		t.Error("Error.Message is empty")
	}
}

func TestRoutes_CORS_AllowsConfiguredOriginOnRealResponses(t *testing.T) {
	fake := &fakeConversationService{
		historyFunc: func(_ context.Context) ([]conversation.Turn, error) {
			return []conversation.Turn{}, nil
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	req.Header.Set("Origin", testOrigin)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, testOrigin)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestRoutes_CORS_NeverUsesWildcard(t *testing.T) {
	fake := &fakeConversationService{
		historyFunc: func(_ context.Context) ([]conversation.Turn, error) {
			return []conversation.Turn{}, nil
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Error("Access-Control-Allow-Origin must never be \"*\" — see docs/DECISIONS.md")
	}
}

func TestRoutes_CORS_PreflightAnsweredWithoutReachingHandler(t *testing.T) {
	fake := &fakeConversationService{
		sendMessageFunc: func(context.Context, string, string) (conversation.Turn, conversation.Turn, error) {
			t.Fatal("the actual handler should never run for an OPTIONS preflight request")
			return conversation.Turn{}, conversation.Turn{}, nil
		},
	}
	server := NewServer(fake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/chat", nil)
	req.Header.Set("Origin", testOrigin)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Error("Access-Control-Allow-Methods header missing on preflight response")
	}
}

func TestHandleTranscribe_Success(t *testing.T) {
	asrFake := &fakeASRClient{
		transcribeFunc: func(_ context.Context, req asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			if req.Language != "hi" {
				t.Errorf("Language = %q, want hi", req.Language)
			}
			if req.ContentType != "audio/webm" {
				t.Errorf("ContentType = %q, want audio/webm", req.ContentType)
			}
			if len(req.Audio) == 0 {
				t.Error("Audio is empty, want the uploaded bytes")
			}
			return asr.TranscribeResponse{Transcript: "आज मौसम कैसा है?"}, nil
		},
	}
	server := NewServer(&fakeConversationService{}, asrFake, defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/transcribe?language=hi", bytes.NewReader([]byte("fake audio bytes")))
	req.Header.Set("Content-Type", "audio/webm")
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}
	var resp transcribeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Transcript != "आज मौसम कैसा है?" {
		t.Errorf("Transcript = %q, want the ASR client's transcript", resp.Transcript)
	}
}

func TestHandleTranscribe_MissingLanguage(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/transcribe", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleTranscribe_EmptyAudioBody(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/transcribe?language=en", bytes.NewReader(nil))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleTranscribe_ASRUnavailable(t *testing.T) {
	asrFake := &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{}, errUnexpected
		},
	}
	server := NewServer(&fakeConversationService{}, asrFake, defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/transcribe?language=en", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadGateway, "asr_unavailable")
}

func TestHandleTranscribe_EmptyTranscriptResult(t *testing.T) {
	asrFake := &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{Transcript: "   "}, nil
		},
	}
	server := NewServer(&fakeConversationService{}, asrFake, defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/transcribe?language=en", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleSynthesize_Success(t *testing.T) {
	wantAudio := []byte("fake wav bytes")
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(_ context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			if req.Text != "आज मौसम अच्छा है" {
				t.Errorf("Text = %q, want the request text", req.Text)
			}
			if req.Language != "hi" {
				t.Errorf("Language = %q, want hi", req.Language)
			}
			return tts.SynthesizeResponse{Audio: wantAudio, ContentType: "audio/wav"}, nil
		},
	}
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), ttsFake, testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "आज मौसम अच्छा है", Language: "hi"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); got != "audio/wav" {
		t.Errorf("Content-Type = %q, want audio/wav", got)
	}
	if rec.Body.String() != string(wantAudio) {
		t.Errorf("body = %q, want the TTS client's audio bytes", rec.Body.String())
	}
}

func TestHandleSynthesize_DefaultsVoiceToFemale(t *testing.T) {
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(_ context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			if req.Voice != "female" {
				t.Errorf("Voice = %q, want female (the default)", req.Voice)
			}
			return tts.SynthesizeResponse{Audio: []byte("x"), ContentType: "audio/wav"}, nil
		},
	}
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), ttsFake, testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "hello", Language: "en"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}
}

func TestHandleSynthesize_PassesThroughAnExplicitVoice(t *testing.T) {
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(_ context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			if req.Voice != "male" {
				t.Errorf("Voice = %q, want male", req.Voice)
			}
			return tts.SynthesizeResponse{Audio: []byte("x"), ContentType: "audio/wav"}, nil
		},
	}
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), ttsFake, testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "hello", Language: "en", Voice: "male"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}
}

func TestHandleSynthesize_UnknownVoice(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "hello", Language: "en", Voice: "robot"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleSynthesize_EmptyText(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "   ", Language: "en"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleSynthesize_UnknownLanguage(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "hello", Language: "fr"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleSynthesize_MalformedJSON(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleSynthesize_TTSUnavailable(t *testing.T) {
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(context.Context, tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			return tts.SynthesizeResponse{}, errUnexpected
		},
	}
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), ttsFake, testLogger(), testOrigin)

	body, _ := json.Marshal(synthesizeRequest{Text: "hello", Language: "en"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/speech/synthesize", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadGateway, "tts_unavailable")
}

func TestHandleVoiceTurn_Success(t *testing.T) {
	var sawSynthesizeText string
	convFake := &fakeConversationService{
		sendMessageFunc: func(_ context.Context, text, language string) (conversation.Turn, conversation.Turn, error) {
			if text != "आज मौसम कैसा है?" {
				t.Errorf("SendMessage text = %q, want the transcript", text)
			}
			if language != "hi" {
				t.Errorf("SendMessage language = %q, want hi", language)
			}
			return conversation.Turn{ID: "u1", Role: "user", Text: text, Language: language},
				conversation.Turn{ID: "a1", Role: "assistant", Text: "एक अच्छी कहानी", Language: language},
				nil
		},
	}
	asrFake := &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{Transcript: "आज मौसम कैसा है?"}, nil
		},
	}
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(_ context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			sawSynthesizeText = req.Text
			if req.Voice != "male" {
				t.Errorf("Voice = %q, want male", req.Voice)
			}
			return tts.SynthesizeResponse{Audio: []byte("fake wav bytes"), ContentType: "audio/wav"}, nil
		},
	}
	server := NewServer(convFake, asrFake, ttsFake, testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=hi&voice=male", bytes.NewReader([]byte("audio bytes")))
	req.Header.Set("Content-Type", "audio/webm")
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}
	var resp voiceTurnResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.UserTurn.Text != "आज मौसम कैसा है?" {
		t.Errorf("UserTurn.Text = %q, want the transcript", resp.UserTurn.Text)
	}
	if resp.AssistantTurn.Text != "एक अच्छी कहानी" {
		t.Errorf("AssistantTurn.Text = %q, want the reply", resp.AssistantTurn.Text)
	}
	if sawSynthesizeText != resp.AssistantTurn.Text {
		t.Errorf("synthesize was called with %q, want the assistant reply text", sawSynthesizeText)
	}
	if resp.Audio == nil {
		t.Fatal("Audio = nil, want a populated audio field on success")
	}
	if resp.Audio.ContentType != "audio/wav" {
		t.Errorf("Audio.ContentType = %q, want audio/wav", resp.Audio.ContentType)
	}
	decoded, err := base64.StdEncoding.DecodeString(resp.Audio.Base64)
	if err != nil {
		t.Fatalf("Audio.Base64 did not decode: %v", err)
	}
	if string(decoded) != "fake wav bytes" {
		t.Errorf("decoded audio = %q, want the tts client's bytes", decoded)
	}
}

func TestHandleVoiceTurn_SynthesisFailureStillReturnsTurns(t *testing.T) {
	convFake := &fakeConversationService{
		sendMessageFunc: func(_ context.Context, text, language string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{ID: "u1", Role: "user", Text: text, Language: language},
				conversation.Turn{ID: "a1", Role: "assistant", Text: "reply", Language: language},
				nil
		},
	}
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(context.Context, tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			return tts.SynthesizeResponse{}, errUnexpected
		},
	}
	server := NewServer(convFake, defaultFakeASR(), ttsFake, testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=en", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 — a synthesis failure must not fail the turn; body = %s", rec.Code, rec.Body.String())
	}
	var resp voiceTurnResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.AssistantTurn.Text != "reply" {
		t.Errorf("AssistantTurn.Text = %q, want the reply text even when synthesis failed", resp.AssistantTurn.Text)
	}
	if resp.Audio != nil {
		t.Errorf("Audio = %+v, want nil when synthesis failed", resp.Audio)
	}
}

func TestHandleVoiceTurn_MissingLanguage(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleVoiceTurn_UnknownVoice(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=en&voice=robot", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleVoiceTurn_EmptyAudioBody(t *testing.T) {
	server := NewServer(&fakeConversationService{}, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=en", bytes.NewReader(nil))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleVoiceTurn_ASRUnavailable(t *testing.T) {
	asrFake := &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{}, errUnexpected
		},
	}
	server := NewServer(&fakeConversationService{}, asrFake, defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=en", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadGateway, "asr_unavailable")
}

func TestHandleVoiceTurn_NoSpeechRecognized(t *testing.T) {
	asrFake := &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{Transcript: "   "}, nil
		},
	}
	server := NewServer(&fakeConversationService{}, asrFake, defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=en", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleVoiceTurn_LLMUnavailable(t *testing.T) {
	convFake := &fakeConversationService{
		sendMessageFunc: func(context.Context, string, string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{}, conversation.Turn{}, conversation.ErrGenerateFailed
		},
	}
	server := NewServer(convFake, defaultFakeASR(), defaultFakeTTS(), testLogger(), testOrigin)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/turn?language=en", bytes.NewReader([]byte("audio")))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadGateway, "llm_unavailable")
}

var errUnexpected = &testError{"boom"}

type testError struct{ msg string }

func (e *testError) Error() string { return e.msg }
