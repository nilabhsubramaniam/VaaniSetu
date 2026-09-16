package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/logging"
)

// ConversationService is the subset of *conversation.Service the API layer
// needs. Depending on this interface, rather than the concrete type,
// lets handler tests use an in-memory fake instead of a real database —
// the same "depend on an interface, swap the implementation" shape used
// throughout this project (docs/ARCHITECTURE.md §5), applied one layer
// down from the LLMClient boundary.
type ConversationService interface {
	SendMessage(ctx context.Context, text, language string) (userTurn, assistantTurn conversation.Turn, err error)
	History(ctx context.Context) ([]conversation.Turn, error)
}

// Server holds the dependencies every handler needs. Construct one with
// [NewServer] and mount its handlers with [Server.Routes].
type Server struct {
	conversation  ConversationService
	logger        *slog.Logger
	allowedOrigin string
}

// NewServer builds a Server. conv does all the actual work; logger is used
// only for operational logging (see internal/logging for the
// no-transcript-at-info-level enforcement every handler here follows).
// allowedOrigin is the single origin permitted by CORS (see [Server.Routes])
// — typically config.Config.AllowedOrigin.
func NewServer(conv ConversationService, logger *slog.Logger, allowedOrigin string) *Server {
	return &Server{conversation: conv, logger: logger, allowedOrigin: allowedOrigin}
}

// Routes returns the backend's HTTP surface for Phase 2: exactly the two
// endpoints in docs/openapi/chat.yaml, wrapped in minimal CORS handling so
// the Angular frontend (a different origin in local development) can call
// them. Uses the standard library's method+path pattern matching (Go
// 1.22+) rather than a third-party router — see docs/DECISIONS.md for why.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/chat", s.handleChat)
	mux.HandleFunc("GET /api/v1/chat/history", s.handleHistory)
	return s.withCORS(mux)
}

// withCORS allows exactly one origin (s.allowedOrigin) — never "*" — and
// answers CORS preflight (OPTIONS) requests directly rather than passing
// them to the mux, since no handler is registered for OPTIONS.
func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "malformed JSON body")
		return
	}

	text := strings.TrimSpace(req.Text)
	if text == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "text must not be empty")
		return
	}
	if !isValidLanguage(req.Language) {
		writeError(w, http.StatusBadRequest, "invalid_request", "unknown language code")
		return
	}

	userTurn, assistantTurn, err := s.conversation.SendMessage(r.Context(), text, req.Language)
	if err != nil {
		if errors.Is(err, conversation.ErrGenerateFailed) {
			s.logger.Warn("llm generate failed",
				"text", logging.RedactedText(text),
				"language", req.Language,
				"error", err,
			)
			writeError(w, http.StatusBadGateway, "llm_unavailable",
				"the assistant is temporarily unavailable, please try again")
			return
		}

		s.logger.Error("send message failed",
			"text", logging.RedactedText(text),
			"language", req.Language,
			"error", err,
		)
		writeError(w, http.StatusInternalServerError, "internal", "something went wrong")
		return
	}

	writeJSON(w, http.StatusOK, chatResponse{
		UserTurn:      turnToDTO(userTurn),
		AssistantTurn: turnToDTO(assistantTurn),
	})
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	turns, err := s.conversation.History(r.Context())
	if err != nil {
		s.logger.Error("history failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "something went wrong")
		return
	}

	dtos := make([]turnDTO, 0, len(turns))
	for _, t := range turns {
		dtos = append(dtos, turnToDTO(t))
	}
	writeJSON(w, http.StatusOK, historyResponse{Turns: dtos})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: errorBody{Code: code, Message: message}})
}
