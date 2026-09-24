// Package orchestrator implements the Go-side turn orchestrator
// docs/ARCHITECTURE.md §3.2 names: the state machine that drives a voice
// turn (listen -> transcribe -> select language -> think -> speak).
// "Listen" is already done by the caller (the HTTP handler has the
// recorded audio in hand); "select language" is the caller-supplied
// language, per docs/ROADMAP.md Phase 5's explicit scope — no automatic
// detection until Phase 6. This package only sequences transcribe ->
// think -> speak.
//
// Before this package existed, that sequencing decision lived in Angular
// (frontend/src/app/assistant/mic-button/mic-button.ts calling
// SpeechService.transcribe then ConversationService.sendUserTurn, and
// ConversationRealService calling SpeechService.synthesize inline after a
// chat reply) — exactly the pattern docs/ARCHITECTURE.md §4 forbids
// ("Turn orchestration | Go | Orchestration logic in Python or Angular").
package orchestrator

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/asr"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/tts"
)

// ConversationService is the one piece of *conversation.Service a turn
// needs — declared here (not imported from internal/api) so this package
// has no dependency on internal/api, which is what will import this
// package. Any value satisfying internal/api.ConversationService already
// satisfies this narrower interface.
type ConversationService interface {
	SendMessage(ctx context.Context, text, language string) (userTurn, assistantTurn conversation.Turn, err error)
}

// ErrTranscribeFailed wraps any error from the configured ASRClient,
// distinct from "the call succeeded but recognized nothing"
// (ErrNoSpeechRecognized) — callers map the two to different HTTP
// statuses, mirroring conversation.ErrGenerateFailed's existing role.
var ErrTranscribeFailed = errors.New("orchestrator: transcribe failed")

// ErrNoSpeechRecognized is returned when transcription succeeds but
// produces only an empty/whitespace transcript — a client error (bad
// input), not a service failure. Mirrors handleTranscribe's existing
// "Go's handler turns an empty transcript into a 400" rule.
var ErrNoSpeechRecognized = errors.New("orchestrator: no speech recognized")

// TurnResult is a completed voice turn. Audio/AudioContentType are empty
// and SynthesisFailed is true when speech synthesis failed — that failure
// is never fatal to the turn (docs/DECISIONS.md ADR-020's "voice is
// additive" rule, moved here from Angular where it lived before this
// package existed): the user and assistant turns are always present once
// RunTurn returns a nil error.
type TurnResult struct {
	UserTurn         conversation.Turn
	AssistantTurn    conversation.Turn
	Audio            []byte
	AudioContentType string
	SynthesisFailed  bool

	// Per-stage wall-clock latency, the concrete answer to
	// docs/ROADMAP.md Phase 5's "end-to-end latency measurement" —
	// returned to the caller for real observability, not just logged.
	TranscribeMs int64
	ThinkMs      int64
	SpeakMs      int64
}

// Orchestrator sequences the three already-existing capability clients
// into one voice turn. It composes interfaces every caller already
// depends on individually — no new capability, no new abstraction over
// what internal/asr, internal/conversation, and internal/tts already are.
type Orchestrator struct {
	asrClient    asr.ASRClient
	conversation ConversationService
	ttsClient    tts.TTSClient
}

// New builds an Orchestrator from the three capability clients a caller
// (typically internal/api.Server) already holds.
func New(asrClient asr.ASRClient, conv ConversationService, ttsClient tts.TTSClient) *Orchestrator {
	return &Orchestrator{asrClient: asrClient, conversation: conv, ttsClient: ttsClient}
}

// RunTurn runs one full voice turn: transcribe audio, persist + generate
// a reply, then synthesize it. audio/contentType are the caller's
// recorded audio exactly as internal/asr.TranscribeRequest expects it;
// language/voice are assumed already validated by the caller (the same
// assumption internal/asr.ASRClient and internal/tts.TTSClient's own docs
// already make).
//
// A transcribe or generate failure returns a non-nil error and a zero
// TurnResult. A synthesis failure does not — see TurnResult's doc comment.
func (o *Orchestrator) RunTurn(ctx context.Context, audio []byte, contentType, language, voice string) (TurnResult, error) {
	transcribeStart := time.Now()
	transcribeResp, err := o.asrClient.Transcribe(ctx, asr.TranscribeRequest{
		Audio:       audio,
		ContentType: contentType,
		Language:    language,
	})
	transcribeMs := time.Since(transcribeStart).Milliseconds()
	if err != nil {
		return TurnResult{}, fmt.Errorf("%w: %v", ErrTranscribeFailed, err)
	}

	transcript := strings.TrimSpace(transcribeResp.Transcript)
	if transcript == "" {
		return TurnResult{}, ErrNoSpeechRecognized
	}

	thinkStart := time.Now()
	userTurn, assistantTurn, err := o.conversation.SendMessage(ctx, transcript, language)
	thinkMs := time.Since(thinkStart).Milliseconds()
	if err != nil {
		// Not wrapped further — preserves errors.Is(err,
		// conversation.ErrGenerateFailed) for the caller.
		return TurnResult{}, err
	}

	result := TurnResult{
		UserTurn:      userTurn,
		AssistantTurn: assistantTurn,
		TranscribeMs:  transcribeMs,
		ThinkMs:       thinkMs,
	}

	speakStart := time.Now()
	synthResp, err := o.ttsClient.Synthesize(ctx, tts.SynthesizeRequest{
		Text:     assistantTurn.Text,
		Language: language,
		Voice:    voice,
	})
	result.SpeakMs = time.Since(speakStart).Milliseconds()
	if err != nil {
		result.SynthesisFailed = true
		return result, nil
	}

	result.Audio = synthResp.Audio
	result.AudioContentType = synthResp.ContentType
	return result, nil
}
