// Integration tests against a real, containerized PostgreSQL, per
// docs/DEVELOPMENT.md §8. These require a working Docker daemon; when one
// isn't available (as in this sandbox, which has no docker binary at all)
// the tests skip themselves with a clear message rather than failing the
// suite — they are meant to run for real on a developer machine or in CI,
// both of which have Docker.
package conversation_test

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
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
// backed by it.
func newTestService(t *testing.T, llmClient llm.LLMClient) *conversation.Service {
	t.Helper()
	skipIfNoDocker(t)

	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:16-alpine",
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

	return conversation.NewService(pool, llmClient)
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

type failingLLMClient struct{}

func (failingLLMClient) Generate(context.Context, llm.GenerateRequest) (llm.GenerateResponse, error) {
	return llm.GenerateResponse{}, errBoom
}

var errBoom = &boomErr{}

type boomErr struct{}

func (*boomErr) Error() string { return "boom" }
