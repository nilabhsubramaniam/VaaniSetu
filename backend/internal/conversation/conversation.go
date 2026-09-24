package conversation

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/langid"
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
	// DetectedLanguage is the langid.LangIDClient's classification of
	// Text, computed at persist time for every turn (Phase 6 Milestone
	// 6a). Nil for turns written before this column existed, and also
	// nil (not an error) when detection itself failed — see SendMessage.
	// Not yet used to drive the LLM prompt or TTS voice; Language (the
	// manually-selected/ASR-hint value) still does that.
	DetectedLanguage *string
}

// Service is the business-logic layer behind the chat API. It owns getting
// or creating Phase 2's single implicit session, persisting turns,
// calling the configured [llm.LLMClient] for a reply, and (Phase 6
// Milestone 6a) tagging each turn with the configured
// [langid.LangIDClient]'s detected language.
type Service struct {
	queries      *db.Queries
	llmClient    llm.LLMClient
	langIDClient langid.LangIDClient
	logger       *slog.Logger
}

// NewService builds a Service backed by pool, llmClient, and langIDClient.
// Passing a [llm.FakeLLMClient] or an [llm.HTTPLLMClient] here is the
// entire difference between Milestone 2a and Milestone 2b, and likewise a
// [langid.FakeLangIDClient] vs [langid.HTTPLangIDClient] between Milestone
// 6a and 6b — Service itself never changes. logger is used only to
// observe a non-fatal langIDClient failure (see SendMessage) — everything
// else Service does either succeeds or returns an error for the caller to
// log, the existing convention internal/api's handlers follow.
func NewService(pool *pgxpool.Pool, llmClient llm.LLMClient, langIDClient langid.LangIDClient, logger *slog.Logger) *Service {
	return &Service{queries: db.New(pool), llmClient: llmClient, langIDClient: langIDClient, logger: logger}
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
		SessionID:        sessionID,
		Role:             "user",
		Language:         language,
		Text:             text,
		Script:           &userScript,
		DetectedLanguage: s.detectLanguage(ctx, text),
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
		SessionID:        sessionID,
		Role:             "assistant",
		Language:         language,
		Text:             genResp.Reply,
		LatencyMs:        &latencyMs,
		Script:           &assistantScript,
		DetectedLanguage: s.detectLanguage(ctx, genResp.Reply),
	})
	if err != nil {
		return userTurn, Turn{}, fmt.Errorf("conversation: persist assistant turn: %w", err)
	}

	return userTurn, turnFromDB(dbAssistantTurn), nil
}

// detectLanguage calls the configured langid.LangIDClient and returns its
// detected language, or nil if detection fails. Non-fatal by design
// (docs/DECISIONS.md ADR-026, the same "additive, not required" rule
// ADR-020 already established for TTS): a brand new, non-critical tag
// must never stop a turn from being sent.
func (s *Service) detectLanguage(ctx context.Context, text string) *string {
	resp, err := s.langIDClient.Detect(ctx, langid.DetectRequest{Text: text})
	if err != nil {
		s.logger.Warn("langid detect failed", "error", err)
		return nil
	}
	return &resp.Language
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
		ID:               t.ID.String(),
		Role:             t.Role,
		Language:         t.Language,
		Text:             t.Text,
		LatencyMs:        t.LatencyMs,
		CreatedAt:        t.CreatedAt.Time,
		Script:           t.Script,
		DetectedLanguage: t.DetectedLanguage,
	}
}
