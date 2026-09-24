package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/asr"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/logging"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/orchestrator"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/tts"
)

// maxAudioBytes bounds a single POST /api/v1/speech/transcribe body.
// Generous for one short utterance (a few tens of seconds of compressed
// audio); guards against an unbounded upload rather than tuning a
// realistic maximum.
const maxAudioBytes = 10 << 20 // 10 MiB

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
	asrClient     asr.ASRClient
	ttsClient     tts.TTSClient
	orchestrator  *orchestrator.Orchestrator
	logger        *slog.Logger
	allowedOrigin string
}

// NewServer builds a Server. conv, asrClient, and ttsClient do the actual
// work; logger is used only for operational logging (see internal/logging
// for the no-transcript-at-info-level enforcement every handler here
// follows). allowedOrigin is the single origin permitted by CORS (see
// [Server.Routes]) — typically config.Config.AllowedOrigin.
func NewServer(conv ConversationService, asrClient asr.ASRClient, ttsClient tts.TTSClient, logger *slog.Logger, allowedOrigin string) *Server {
	return &Server{
		conversation:  conv,
		asrClient:     asrClient,
		ttsClient:     ttsClient,
		orchestrator:  orchestrator.New(asrClient, conv, ttsClient),
		logger:        logger,
		allowedOrigin: allowedOrigin,
	}
}

// Routes returns the backend's HTTP surface: the two Phase 2 endpoints in
// docs/openapi/chat.yaml, Phase 3's transcription and Phase 4's synthesis
// endpoints in docs/openapi/speech.yaml, and Phase 5's orchestrated voice
// turn endpoint in docs/openapi/voice.yaml — wrapped in minimal CORS
// handling so the Angular frontend (a different origin in local
// development) can call them. Uses the standard library's method+path
// pattern matching (Go 1.22+) rather than a third-party router — see
// docs/DECISIONS.md for why.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/chat", s.handleChat)
	mux.HandleFunc("GET /api/v1/chat/history", s.handleHistory)
	mux.HandleFunc("POST /api/v1/speech/transcribe", s.handleTranscribe)
	mux.HandleFunc("POST /api/v1/speech/synthesize", s.handleSynthesize)
	mux.HandleFunc("POST /api/v1/voice/turn", s.handleVoiceTurn)
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

// handleTranscribe implements POST /api/v1/speech/transcribe per
// docs/openapi/speech.yaml. It has no persistence side effect — it only
// returns text; the caller is expected to feed that transcript into the
// existing POST /api/v1/chat unchanged (docs/DECISIONS.md ADR-017), which
// is what actually persists a turn.
func (s *Server) handleTranscribe(w http.ResponseWriter, r *http.Request) {
	language := r.URL.Query().Get("language")
	if !isValidLanguage(language) {
		writeError(w, http.StatusBadRequest, "invalid_request", "unknown or missing language code")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAudioBytes)
	audio, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "audio body too large or unreadable")
		return
	}
	if len(audio) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "audio must not be empty")
		return
	}

	result, err := s.asrClient.Transcribe(r.Context(), asr.TranscribeRequest{
		Audio:       audio,
		ContentType: r.Header.Get("Content-Type"),
		Language:    language,
	})
	if err != nil {
		// Never log the audio itself — only metadata. Audio is discarded
		// after this call regardless of outcome (docs/PROJECT_GOAL.md).
		s.logger.Warn("asr transcribe failed", "language", language, "audioBytes", len(audio), "error", err)
		writeError(w, http.StatusBadGateway, "asr_unavailable",
			"speech recognition is temporarily unavailable, please try again or type instead")
		return
	}

	transcript := strings.TrimSpace(result.Transcript)
	if transcript == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "no speech was recognized in that recording")
		return
	}

	writeJSON(w, http.StatusOK, transcribeResponse{Transcript: transcript})
}

// handleSynthesize implements POST /api/v1/speech/synthesize per
// docs/openapi/speech.yaml. Unlike every other handler in this file, a
// successful response is the raw audio bytes, not a JSON body — the
// caller (the browser's <audio>/Web Audio playback) has no use for a JSON
// wrapper around binary audio.
func (s *Server) handleSynthesize(w http.ResponseWriter, r *http.Request) {
	var req synthesizeRequest
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

	voice := req.Voice
	if voice == "" {
		voice = "female"
	}
	if !isValidVoice(voice) {
		writeError(w, http.StatusBadRequest, "invalid_request", "unknown voice")
		return
	}

	result, err := s.ttsClient.Synthesize(r.Context(), tts.SynthesizeRequest{
		Text:     text,
		Language: req.Language,
		Voice:    voice,
	})
	if err != nil {
		s.logger.Warn("tts synthesize failed",
			"text", logging.RedactedText(text),
			"language", req.Language,
			"voice", voice,
			"error", err,
		)
		writeError(w, http.StatusBadGateway, "tts_unavailable",
			"speech synthesis is temporarily unavailable, please try again")
		return
	}

	contentType := result.ContentType
	if contentType == "" {
		contentType = "audio/wav"
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(result.Audio)
}

// handleVoiceTurn implements POST /api/v1/voice/turn per
// docs/openapi/voice.yaml: the Phase 5 turn orchestrator's HTTP boundary.
// It runs the full listen(already done)->transcribe->think->speak
// sequence in one call via internal/orchestrator, replacing the
// client-side sequencing that used to live in
// frontend/src/app/assistant/mic-button/mic-button.ts and
// ConversationRealService (docs/ARCHITECTURE.md §4 forbids orchestration
// logic in Angular).
//
// The response is one JSON body — {userTurn, assistantTurn, audio} — not
// multipart or a second follow-up call: one reply clip is small enough
// that base64's ~33% overhead is negligible, and a second "now fetch the
// audio" call would put the "now speak it" decision right back in
// Angular, undoing the point of this endpoint (docs/DECISIONS.md
// ADR-024). audio is null when synthesis failed — that failure is never
// fatal to the turn (same ADR).
func (s *Server) handleVoiceTurn(w http.ResponseWriter, r *http.Request) {
	language := r.URL.Query().Get("language")
	if !isValidLanguage(language) {
		writeError(w, http.StatusBadRequest, "invalid_request", "unknown or missing language code")
		return
	}
	voice := r.URL.Query().Get("voice")
	if voice == "" {
		voice = "female"
	}
	if !isValidVoice(voice) {
		writeError(w, http.StatusBadRequest, "invalid_request", "unknown voice")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAudioBytes)
	audio, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "audio body too large or unreadable")
		return
	}
	if len(audio) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "audio must not be empty")
		return
	}

	result, err := s.orchestrator.RunTurn(r.Context(), audio, r.Header.Get("Content-Type"), language, voice)
	if err != nil {
		switch {
		case errors.Is(err, orchestrator.ErrNoSpeechRecognized):
			writeError(w, http.StatusBadRequest, "invalid_request", "no speech was recognized in that recording")
		case errors.Is(err, orchestrator.ErrTranscribeFailed):
			s.logger.Warn("voice turn: transcribe failed", "language", language, "audioBytes", len(audio), "error", err)
			writeError(w, http.StatusBadGateway, "asr_unavailable",
				"speech recognition is temporarily unavailable, please try again or type instead")
		case errors.Is(err, conversation.ErrGenerateFailed):
			s.logger.Warn("voice turn: llm generate failed", "language", language, "error", err)
			writeError(w, http.StatusBadGateway, "llm_unavailable",
				"the assistant is temporarily unavailable, please try again")
		default:
			s.logger.Error("voice turn failed", "language", language, "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "something went wrong")
		}
		return
	}

	s.logger.Info("voice turn completed",
		"language", language,
		"voice", voice,
		"transcribeMs", result.TranscribeMs,
		"thinkMs", result.ThinkMs,
		"speakMs", result.SpeakMs,
		"synthesisFailed", result.SynthesisFailed,
	)

	resp := voiceTurnResponse{
		UserTurn:      turnToDTO(result.UserTurn),
		AssistantTurn: turnToDTO(result.AssistantTurn),
	}
	if !result.SynthesisFailed {
		contentType := result.AudioContentType
		if contentType == "" {
			contentType = "audio/wav"
		}
		resp.Audio = &voiceTurnAudioDTO{
			ContentType: contentType,
			Base64:      base64.StdEncoding.EncodeToString(result.Audio),
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: errorBody{Code: code, Message: message}})
}
