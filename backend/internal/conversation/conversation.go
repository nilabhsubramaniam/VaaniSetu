package conversation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/llm"
)

// ErrGenerateFailed wraps any error from the configured LLMClient, distinct
// from a persistence failure, so internal/api can tell an "LLM unavailable"
// condition (502, retryable) apart from an internal error (500) without
// internal/api needing to know anything about conversation's internals.
// Check with errors.Is(err, conversation.ErrGenerateFailed).
var ErrGenerateFailed = errors.New("conversation: llm generate failed")

// Turn is the domain representation of one utterance, decoupled from both
// the sqlc-generated db.Turn (pgtype-based) and the HTTP-facing JSON DTO in
// internal/api. It matches frontend/src/app/core/models/turn.model.ts field
// for field, minus the not-yet-populated agentId.
type Turn struct {
	ID        string
	Role      string // "user" | "assistant"
	Language  string
	Text      string
	LatencyMs *int32
	CreatedAt time.Time
	// Script is the writing system Text is actually in (see
	// DetectScript), computed at persist time for every turn. Nil only
	// for turns written before this column existed (Phase 3).
	Script *string
}

// Service is the business-logic layer behind the chat API. It owns getting
// or creating Phase 2's single implicit session, persisting turns, and
// calling the configured [llm.LLMClient] for a reply.
type Service struct {
	queries   *db.Queries
	llmClient llm.LLMClient
}

// NewService builds a Service backed by pool and llmClient. Passing a
// [llm.FakeLLMClient] or an [llm.HTTPLLMClient] here is the entire
// difference between Milestone 2a and Milestone 2b — Service itself never
// changes.
func NewService(pool *pgxpool.Pool, llmClient llm.LLMClient) *Service {
	return &Service{queries: db.New(pool), llmClient: llmClient}
}

// SendMessage persists text as a user turn, asks the configured LLMClient
// for a reply, persists that reply as an assistant turn, and returns both.
// If the LLM call fails, the user turn is still persisted (the user really
// did say that) but no assistant turn is created, and the error is
// returned for the caller to map to the llm_unavailable API error code.
func (s *Service) SendMessage(ctx context.Context, text, language string) (userTurn Turn, assistantTurn Turn, err error) {
	sessionID, err := s.getOrCreateSessionID(ctx)
	if err != nil {
		return Turn{}, Turn{}, fmt.Errorf("conversation: get or create session: %w", err)
	}

	userScript := DetectScript(text)
	dbUserTurn, err := s.queries.CreateTurn(ctx, db.CreateTurnParams{
		SessionID: sessionID,
		Role:      "user",
		Language:  language,
		Text:      text,
		Script:    &userScript,
	})
	if err != nil {
		return Turn{}, Turn{}, fmt.Errorf("conversation: persist user turn: %w", err)
	}
	userTurn = turnFromDB(dbUserTurn)

	started := time.Now()
	genResp, err := s.llmClient.Generate(ctx, llm.GenerateRequest{Text: text, Language: language})
	if err != nil {
		return userTurn, Turn{}, fmt.Errorf("%w: %v", ErrGenerateFailed, err)
	}
	latencyMs := int32(time.Since(started).Milliseconds())
	assistantScript := DetectScript(genResp.Reply)

	dbAssistantTurn, err := s.queries.CreateTurn(ctx, db.CreateTurnParams{
		SessionID: sessionID,
		Role:      "assistant",
		Language:  language,
		Text:      genResp.Reply,
		LatencyMs: &latencyMs,
		Script:    &assistantScript,
	})
	if err != nil {
		return userTurn, Turn{}, fmt.Errorf("conversation: persist assistant turn: %w", err)
	}

	return userTurn, turnFromDB(dbAssistantTurn), nil
}

// History returns every turn in the current session, oldest first, or an
// empty slice if no session has been started yet (no message has ever been
// sent) — it does not create a session as a side effect of being read.
func (s *Service) History(ctx context.Context) ([]Turn, error) {
	dbSession, err := s.queries.GetMostRecentSession(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return []Turn{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("conversation: get session: %w", err)
	}

	dbTurns, err := s.queries.ListTurnsBySession(ctx, dbSession.ID)
	if err != nil {
		return nil, fmt.Errorf("conversation: list turns: %w", err)
	}

	turns := make([]Turn, 0, len(dbTurns))
	for _, t := range dbTurns {
		turns = append(turns, turnFromDB(t))
	}
	return turns, nil
}

// getOrCreateSessionID implements Phase 2's "exactly one implicit session
// per local install" model (see docs/DECISIONS.md and the Phase 2 plan):
// reuse the most recent session if one exists, otherwise create the first
// one. There is no session picker and no multi-user concept yet.
func (s *Service) getOrCreateSessionID(ctx context.Context) (pgtype.UUID, error) {
	dbSession, err := s.queries.GetMostRecentSession(ctx)
	if err == nil {
		return dbSession.ID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return pgtype.UUID{}, err
	}

	dbSession, err = s.queries.CreateSession(ctx)
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("create session: %w", err)
	}
	return dbSession.ID, nil
}

func turnFromDB(t db.Turn) Turn {
	return Turn{
		ID:        t.ID.String(),
		Role:      t.Role,
		Language:  t.Language,
		Text:      t.Text,
		LatencyMs: t.LatencyMs,
		CreatedAt: t.CreatedAt.Time,
		Script:    t.Script,
	}
}
