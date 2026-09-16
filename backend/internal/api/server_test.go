package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(&fakeConversationService{}, testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "   ", Language: "hi"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleChat_UnknownLanguage(t *testing.T) {
	server := NewServer(&fakeConversationService{}, testLogger(), testOrigin)

	body, _ := json.Marshal(chatRequest{Text: "hello", Language: "fr"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestHandleChat_MalformedJSON(t *testing.T) {
	server := NewServer(&fakeConversationService{}, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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
	server := NewServer(fake, testLogger(), testOrigin)

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

var errUnexpected = &testError{"boom"}

type testError struct{ msg string }

func (e *testError) Error() string { return e.msg }
