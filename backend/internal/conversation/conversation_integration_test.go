// Integration tests against a real, containerized PostgreSQL, per
// docs/DEVELOPMENT.md §8. These require a working Docker daemon; when one
// isn't available (as in this sandbox, which has no docker binary at all)
// the tests skip themselves with a clear message rather than failing the
// suite — they are meant to run for real on a developer machine or in CI,
// both of which have Docker.
package conversation_test

import (
	"context"
	"io"
	"log/slog"
	"os/exec"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/documents"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/langid"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/llm"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/migrations"
)

func skipIfNoDocker(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("skipping: no docker binary on PATH — this test needs a Docker daemon (docs/DEVELOPMENT.md §8)")
	}
}

// newTestService starts a real Postgres container, applies the schema via
// the exact same db.Migrate path cmd/api/main.go uses in production (not a
// hand-rolled SQL-parsing shortcut), and returns a conversation.Service
// backed by it, using the default FakeLangIDClient and a retriever that
// always returns no passages (Phase 7 Milestone 7d) — every test written
// before retrieval existed keeps seeing exactly its old behavior.
func newTestService(t *testing.T, llmClient llm.LLMClient) *conversation.Service {
	t.Helper()
	return newTestServiceWithLangID(t, llmClient, langid.NewFakeLangIDClient())
}

// newTestServiceWithLangID is [newTestService] with an overridable
// langid.LangIDClient, for tests that need to exercise a detection
// failure specifically.
func newTestServiceWithLangID(t *testing.T, llmClient llm.LLMClient, langIDClient langid.LangIDClient) *conversation.Service {
	t.Helper()
	return newTestServiceWithLangIDAndRetriever(t, llmClient, langIDClient, noopRetriever{})
}

// newTestServiceWithLangIDAndRetriever is [newTestServiceWithLangID] with
// an overridable conversation.Retriever, for tests that need to exercise
// retrieval specifically (Phase 7 Milestone 7d).
func newTestServiceWithLangIDAndRetriever(
	t *testing.T, llmClient llm.LLMClient, langIDClient langid.LangIDClient, retriever conversation.Retriever,
) *conversation.Service {
	t.Helper()
	skipIfNoDocker(t)

	ctx := context.Background()
	// pgvector/pgvector:pg16 (not plain postgres:16-alpine), matching
	// docker-compose.yml's postgres service — required since Phase 7
	// Milestone 7c's migration runs `CREATE EXTENSION vector`, which a
	// plain Postgres image doesn't have.
	container, err := postgres.Run(ctx, "pgvector/pgvector:pg16",
		postgres.WithDatabase("vaanisetu_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		_ = container.Terminate(context.Background())
	})

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	if _, err := db.Migrate(ctx, connStr, migrations.FS); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	pool, err := db.NewPool(ctx, connStr)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	t.Cleanup(pool.Close)

	testLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return conversation.NewService(pool, llmClient, langIDClient, retriever, testLogger)
}

func TestService_SendMessage_PersistsBothTurns(t *testing.T) {
	svc := newTestService(t, llm.NewFakeLLMClient())
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	userTurn, assistantTurn, err := svc.SendMessage(ctx, "आज मौसम कैसा है?", "hi")
	if err != nil {
		t.Fatalf("SendMessage() error = %v", err)
	}
	if userTurn.Role != "user" || userTurn.Text != "आज मौसम कैसा है?" {
		t.Errorf("unexpected user turn: %+v", userTurn)
	}
	if assistantTurn.Role != "assistant" || assistantTurn.Text == "" {
		t.Errorf("unexpected assistant turn: %+v", assistantTurn)
	}
	if assistantTurn.LatencyMs == nil {
		t.Error("assistant turn LatencyMs is nil, want a measured value")
	}
	if userTurn.Script == nil || *userTurn.Script != "Devanagari" {
		t.Errorf("user turn Script = %v, want a computed \"Devanagari\"", userTurn.Script)
	}
	if userTurn.DetectedLanguage == nil || *userTurn.DetectedLanguage != "hi" {
		t.Errorf("user turn DetectedLanguage = %v, want the fake langid client's \"hi\"", userTurn.DetectedLanguage)
	}

	history, err := svc.History(ctx)
	if err != nil {
		t.Fatalf("History() error = %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("History() returned %d turns, want 2", len(history))
	}
	if history[0].Role != "user" || history[1].Role != "assistant" {
		t.Errorf("history not in oldest-first order: %+v", history)
	}
}

func TestService_History_EmptyBeforeAnyMessage(t *testing.T) {
	svc := newTestService(t, llm.NewFakeLLMClient())
	ctx := context.Background()

	history, err := svc.History(ctx)
	if err != nil {
		t.Fatalf("History() error = %v", err)
	}
	if len(history) != 0 {
		t.Errorf("History() = %v, want empty before any message is sent", history)
	}
}

func TestService_SendMessage_LLMFailureStillPersistsUserTurn(t *testing.T) {
	svc := newTestService(t, failingLLMClient{})
	ctx := context.Background()

	_, _, err := svc.SendMessage(ctx, "hello", "en")
	if err == nil {
		t.Fatal("SendMessage() error = nil, want an error from the failing LLM client")
	}

	history, err := svc.History(ctx)
	if err != nil {
		t.Fatalf("History() error = %v", err)
	}
	if len(history) != 1 || history[0].Role != "user" {
		t.Errorf("expected exactly the user turn to persist despite the LLM failure, got %+v", history)
	}
}

func TestService_SendMessage_LangIDFailureDoesNotFailTheTurn(t *testing.T) {
	// A brand new, non-critical tag must never stop a turn from being
	// sent (docs/DECISIONS.md ADR-026, the same "additive, not required"
	// rule ADR-020 already established for TTS).
	svc := newTestServiceWithLangID(t, llm.NewFakeLLMClient(), failingLangIDClient{})
	ctx := context.Background()

	userTurn, assistantTurn, err := svc.SendMessage(ctx, "hello", "en")
	if err != nil {
		t.Fatalf("SendMessage() error = %v, want nil — a langid failure must not fail the turn", err)
	}
	if userTurn.DetectedLanguage != nil {
		t.Errorf("userTurn.DetectedLanguage = %v, want nil when detection fails", userTurn.DetectedLanguage)
	}
	if assistantTurn.DetectedLanguage != nil {
		t.Errorf("assistantTurn.DetectedLanguage = %v, want nil when detection fails", assistantTurn.DetectedLanguage)
	}
}

func TestService_SendMessage_PassesRetrievedPassagesToLLM(t *testing.T) {
	retriever := fakeRetriever{chunks: []documents.RetrievedChunk{
		{DocumentID: "doc-1", ChunkIndex: 0, Content: "VaaniSetu runs entirely on-device.", Distance: 0.1},
		{DocumentID: "doc-1", ChunkIndex: 1, Content: "No audio ever leaves the user's machine.", Distance: 0.2},
	}}
	recorder := &recordingLLMClient{}
	svc := newTestServiceWithLangIDAndRetriever(t, recorder, langid.NewFakeLangIDClient(), retriever)
	ctx := context.Background()

	if _, _, err := svc.SendMessage(ctx, "Does VaaniSetu need the internet?", "en"); err != nil {
		t.Fatalf("SendMessage() error = %v", err)
	}

	if recorder.lastRequest == nil {
		t.Fatal("LLM client never received a request")
	}
	want := []string{"VaaniSetu runs entirely on-device.", "No audio ever leaves the user's machine."}
	got := recorder.lastRequest.Passages
	if len(got) != len(want) {
		t.Fatalf("Passages = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("Passages[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestService_SendMessage_RetrievalFailureDoesNotFailTheTurn(t *testing.T) {
	// Retrieval is additive, the same "must never stop a turn from being
	// sent" rule ADR-020/026 already established for TTS/langid — a
	// retrieval-service outage must degrade to a plain, ungrounded reply,
	// not break chat entirely.
	recorder := &recordingLLMClient{}
	svc := newTestServiceWithLangIDAndRetriever(t, recorder, langid.NewFakeLangIDClient(), failingRetriever{})
	ctx := context.Background()

	_, _, err := svc.SendMessage(ctx, "hello", "en")
	if err != nil {
		t.Fatalf("SendMessage() error = %v, want nil — a retrieval failure must not fail the turn", err)
	}
	if recorder.lastRequest == nil {
		t.Fatal("LLM client never received a request")
	}
	if len(recorder.lastRequest.Passages) != 0 {
		t.Errorf("Passages = %v, want empty when retrieval fails", recorder.lastRequest.Passages)
	}
}

func TestService_SendMessage_AutoResolvesToDetectedLanguage(t *testing.T) {
	// The fake langid client (internal/langid/fake.go) detects "en" for
	// Latin-script text with no Devanagari — real enough to prove "auto"
	// drives the LLM call and both turns' Language (docs/DECISIONS.md
	// ADR-030), without needing the real fasttext-lid176 model here.
	svc := newTestService(t, llm.NewFakeLLMClient())
	ctx := context.Background()

	userTurn, assistantTurn, err := svc.SendMessage(ctx, "hello there", "auto")
	if err != nil {
		t.Fatalf("SendMessage() error = %v", err)
	}
	if userTurn.Language != "en" {
		t.Errorf("userTurn.Language = %q, want %q (resolved from detection)", userTurn.Language, "en")
	}
	if assistantTurn.Language != "en" {
		t.Errorf("assistantTurn.Language = %q, want %q (resolved from detection)", assistantTurn.Language, "en")
	}
	if userTurn.DetectedLanguage == nil || *userTurn.DetectedLanguage != "en" {
		t.Errorf("userTurn.DetectedLanguage = %v, want \"en\"", userTurn.DetectedLanguage)
	}
}

func TestService_SendMessage_AutoFallsBackToDefaultWhenDetectionFails(t *testing.T) {
	// A langid failure is non-fatal (ADR-026) — "auto" must still resolve
	// to something usable rather than sending "auto" itself to the LLM.
	svc := newTestServiceWithLangID(t, llm.NewFakeLLMClient(), failingLangIDClient{})
	ctx := context.Background()

	userTurn, assistantTurn, err := svc.SendMessage(ctx, "hello", "auto")
	if err != nil {
		t.Fatalf("SendMessage() error = %v", err)
	}
	if userTurn.Language != "hi" {
		t.Errorf("userTurn.Language = %q, want the default \"hi\" fallback", userTurn.Language)
	}
	if assistantTurn.Language != "hi" {
		t.Errorf("assistantTurn.Language = %q, want the default \"hi\" fallback", assistantTurn.Language)
	}
}

func TestService_SendMessage_ManualPinUnaffectedByAutoLogic(t *testing.T) {
	// A concrete language must pass through unchanged even though the
	// fake langid client would detect something different for this text —
	// a manual pin always wins (docs/PROJECT_GOAL.md §6).
	svc := newTestService(t, llm.NewFakeLLMClient())
	ctx := context.Background()

	userTurn, assistantTurn, err := svc.SendMessage(ctx, "hello there", "hi")
	if err != nil {
		t.Fatalf("SendMessage() error = %v", err)
	}
	if userTurn.Language != "hi" {
		t.Errorf("userTurn.Language = %q, want the manually pinned \"hi\"", userTurn.Language)
	}
	if assistantTurn.Language != "hi" {
		t.Errorf("assistantTurn.Language = %q, want the manually pinned \"hi\"", assistantTurn.Language)
	}
	if userTurn.DetectedLanguage == nil || *userTurn.DetectedLanguage != "en" {
		t.Errorf("userTurn.DetectedLanguage = %v, want the fake client's real detection (\"en\") to still be recorded, unclamped", userTurn.DetectedLanguage)
	}
}

type failingLangIDClient struct{}

func (failingLangIDClient) Detect(context.Context, langid.DetectRequest) (langid.DetectResponse, error) {
	return langid.DetectResponse{}, errBoom
}

type failingLLMClient struct{}

func (failingLLMClient) Generate(context.Context, llm.GenerateRequest) (llm.GenerateResponse, error) {
	return llm.GenerateResponse{}, errBoom
}

// recordingLLMClient captures the last request it received, so a test can
// assert what SendMessage actually passed through (Phase 7 Milestone 7d:
// specifically, Passages) without needing a real model.
type recordingLLMClient struct {
	lastRequest *llm.GenerateRequest
}

func (c *recordingLLMClient) Generate(_ context.Context, req llm.GenerateRequest) (llm.GenerateResponse, error) {
	c.lastRequest = &req
	return llm.GenerateResponse{Reply: "ok"}, nil
}

// noopRetriever implements conversation.Retriever with no documents ever
// found — every test written before retrieval existed (Phase 7 Milestone
// 7d) uses this by default via newTestService/newTestServiceWithLangID,
// so it keeps seeing exactly its pre-7d behavior.
type noopRetriever struct{}

func (noopRetriever) Retrieve(context.Context, string, int) ([]documents.RetrievedChunk, error) {
	return nil, nil
}

// fakeRetriever implements conversation.Retriever with a fixed result,
// ignoring its arguments.
type fakeRetriever struct {
	chunks []documents.RetrievedChunk
}

func (f fakeRetriever) Retrieve(context.Context, string, int) ([]documents.RetrievedChunk, error) {
	return f.chunks, nil
}

// failingRetriever implements conversation.Retriever by always failing —
// SendMessage must treat this non-fatally (see
// TestService_SendMessage_RetrievalFailureDoesNotFailTheTurn), the same
// "additive, not required" rule failingLangIDClient already exercises for
// language detection.
type failingRetriever struct{}

func (failingRetriever) Retrieve(context.Context, string, int) ([]documents.RetrievedChunk, error) {
	return nil, errBoom
}

var errBoom = &boomErr{}

type boomErr struct{}

func (*boomErr) Error() string { return "boom" }
