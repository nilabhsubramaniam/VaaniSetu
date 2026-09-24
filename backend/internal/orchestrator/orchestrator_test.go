package orchestrator

import (
	"context"
	"errors"
	"testing"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/asr"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/tts"
)

// Closure-based fakes mirroring internal/api/server_test.go's exact
// pattern (fakeASRClient, fakeTTSClient, a fake ConversationService) —
// duplicated here rather than exported from internal/api, since
// internal/api will import this package and a reverse import would be a
// cycle.

type fakeASRClient struct {
	transcribeFunc func(ctx context.Context, req asr.TranscribeRequest) (asr.TranscribeResponse, error)
}

func (f *fakeASRClient) Transcribe(ctx context.Context, req asr.TranscribeRequest) (asr.TranscribeResponse, error) {
	return f.transcribeFunc(ctx, req)
}

type fakeConversationService struct {
	sendMessageFunc func(ctx context.Context, text, language string) (conversation.Turn, conversation.Turn, error)
}

func (f *fakeConversationService) SendMessage(ctx context.Context, text, language string) (conversation.Turn, conversation.Turn, error) {
	return f.sendMessageFunc(ctx, text, language)
}

type fakeTTSClient struct {
	synthesizeFunc func(ctx context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error)
}

func (f *fakeTTSClient) Synthesize(ctx context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
	return f.synthesizeFunc(ctx, req)
}

func defaultFakeASR(transcript string) *fakeASRClient {
	return &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{Transcript: transcript}, nil
		},
	}
}

func defaultFakeConversation() *fakeConversationService {
	return &fakeConversationService{
		sendMessageFunc: func(_ context.Context, text, language string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{ID: "u1", Role: "user", Text: text, Language: language},
				conversation.Turn{ID: "a1", Role: "assistant", Text: "reply to: " + text, Language: language},
				nil
		},
	}
}

func defaultFakeTTS() *fakeTTSClient {
	return &fakeTTSClient{
		synthesizeFunc: func(context.Context, tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			return tts.SynthesizeResponse{Audio: []byte("fake wav bytes"), ContentType: "audio/wav"}, nil
		},
	}
}

var errBoom = errors.New("boom")

func TestRunTurn_HappyPath(t *testing.T) {
	var sawSynthesizeText string
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(_ context.Context, req tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			sawSynthesizeText = req.Text
			return tts.SynthesizeResponse{Audio: []byte("audio"), ContentType: "audio/wav"}, nil
		},
	}
	o := New(defaultFakeASR("नमस्ते"), defaultFakeConversation(), ttsFake)

	result, err := o.RunTurn(context.Background(), []byte("audio bytes"), "audio/webm", "hi", "female")
	if err != nil {
		t.Fatalf("RunTurn() error = %v", err)
	}
	if result.UserTurn.Text != "नमस्ते" {
		t.Errorf("UserTurn.Text = %q, want the transcript", result.UserTurn.Text)
	}
	if result.AssistantTurn.Text != "reply to: नमस्ते" {
		t.Errorf("AssistantTurn.Text = %q, want the conversation reply", result.AssistantTurn.Text)
	}
	if sawSynthesizeText != result.AssistantTurn.Text {
		t.Errorf("synthesize was called with %q, want the assistant reply text", sawSynthesizeText)
	}
	if string(result.Audio) != "audio" || result.AudioContentType != "audio/wav" {
		t.Errorf("Audio/AudioContentType = %q/%q, want the tts client's response", result.Audio, result.AudioContentType)
	}
	if result.SynthesisFailed {
		t.Error("SynthesisFailed = true, want false on the happy path")
	}
}

func TestRunTurn_TranscribeFailure(t *testing.T) {
	asrFake := &fakeASRClient{
		transcribeFunc: func(context.Context, asr.TranscribeRequest) (asr.TranscribeResponse, error) {
			return asr.TranscribeResponse{}, errBoom
		},
	}
	o := New(asrFake, defaultFakeConversation(), defaultFakeTTS())

	_, err := o.RunTurn(context.Background(), []byte("audio"), "audio/webm", "en", "female")
	if !errors.Is(err, ErrTranscribeFailed) {
		t.Errorf("error = %v, want ErrTranscribeFailed", err)
	}
}

func TestRunTurn_NoSpeechRecognized(t *testing.T) {
	o := New(defaultFakeASR("   "), defaultFakeConversation(), defaultFakeTTS())

	_, err := o.RunTurn(context.Background(), []byte("audio"), "audio/webm", "en", "female")
	if !errors.Is(err, ErrNoSpeechRecognized) {
		t.Errorf("error = %v, want ErrNoSpeechRecognized", err)
	}
}

func TestRunTurn_ConversationFailure(t *testing.T) {
	convFake := &fakeConversationService{
		sendMessageFunc: func(context.Context, string, string) (conversation.Turn, conversation.Turn, error) {
			return conversation.Turn{}, conversation.Turn{}, conversation.ErrGenerateFailed
		},
	}
	o := New(defaultFakeASR("hello"), convFake, defaultFakeTTS())

	_, err := o.RunTurn(context.Background(), []byte("audio"), "audio/webm", "en", "female")
	if !errors.Is(err, conversation.ErrGenerateFailed) {
		t.Errorf("error = %v, want conversation.ErrGenerateFailed", err)
	}
}

func TestRunTurn_SynthesisFailureIsNonFatal(t *testing.T) {
	ttsFake := &fakeTTSClient{
		synthesizeFunc: func(context.Context, tts.SynthesizeRequest) (tts.SynthesizeResponse, error) {
			return tts.SynthesizeResponse{}, errBoom
		},
	}
	o := New(defaultFakeASR("hello"), defaultFakeConversation(), ttsFake)

	result, err := o.RunTurn(context.Background(), []byte("audio"), "audio/webm", "en", "female")
	if err != nil {
		t.Fatalf("RunTurn() error = %v, want nil — a synthesis failure must not fail the whole turn", err)
	}
	if !result.SynthesisFailed {
		t.Error("SynthesisFailed = false, want true")
	}
	if result.Audio != nil {
		t.Errorf("Audio = %v, want nil when synthesis failed", result.Audio)
	}
	if result.UserTurn.ID == "" || result.AssistantTurn.ID == "" {
		t.Error("turns must still be populated even when synthesis fails")
	}
}

func TestRunTurn_RecordsPerStageLatency(t *testing.T) {
	o := New(defaultFakeASR("hello"), defaultFakeConversation(), defaultFakeTTS())

	result, err := o.RunTurn(context.Background(), []byte("audio"), "audio/webm", "en", "female")
	if err != nil {
		t.Fatalf("RunTurn() error = %v", err)
	}
	if result.TranscribeMs < 0 || result.ThinkMs < 0 || result.SpeakMs < 0 {
		t.Errorf("latency fields must be non-negative, got Transcribe=%d Think=%d Speak=%d",
			result.TranscribeMs, result.ThinkMs, result.SpeakMs)
	}
}
