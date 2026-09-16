package api

import (
	"time"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
)

// validLanguages mirrors frontend/src/app/core/models/language.model.ts's
// LanguageCode exactly. The two sides cannot share a type across
// TypeScript and Go, so docs/openapi/chat.yaml is the single normative
// list either side should be checked against if they ever drift.
var validLanguages = map[string]bool{
	"hi": true, "hinglish": true, "en": true,
	"bn": true, "gu": true, "mr": true, "ta": true, "te": true,
	"kn": true, "ml": true, "pa": true, "or": true,
}

// isValidLanguage reports whether code is one of the frontend's known
// LanguageCode values.
func isValidLanguage(code string) bool {
	return validLanguages[code]
}

// turnDTO is the wire representation of a turn, matching
// frontend/src/app/core/models/turn.model.ts's Turn interface field for
// field. LatencyMs is omitted from the JSON entirely (not null) when unset,
// matching the TypeScript field's optionality.
type turnDTO struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Text      string `json:"text"`
	Language  string `json:"language"`
	CreatedAt string `json:"createdAt"`
	LatencyMs *int32 `json:"latencyMs,omitempty"`
}

func turnToDTO(t conversation.Turn) turnDTO {
	return turnDTO{
		ID:        t.ID,
		Role:      t.Role,
		Text:      t.Text,
		Language:  t.Language,
		CreatedAt: t.CreatedAt.UTC().Format(time.RFC3339),
		LatencyMs: t.LatencyMs,
	}
}

// chatRequest is the POST /api/v1/chat request body.
type chatRequest struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

// chatResponse is the POST /api/v1/chat 200 response body.
type chatResponse struct {
	UserTurn      turnDTO `json:"userTurn"`
	AssistantTurn turnDTO `json:"assistantTurn"`
}

// historyResponse is the GET /api/v1/chat/history 200 response body.
type historyResponse struct {
	Turns []turnDTO `json:"turns"`
}

// errorResponse is the body returned for every non-2xx response, per
// docs/openapi/chat.yaml.
type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	// Code is one of "invalid_request", "llm_unavailable", "internal".
	Code string `json:"code"`
	// Message is safe to show a user — never the raw underlying error
	// (docs/DEVELOPMENT.md §11: user-facing errors "do not leak internal
	// detail").
	Message string `json:"message"`
}
