package asr

import (
	"context"
	"testing"
)

func TestFakeASRClient_Transcribe_KnownLanguage(t *testing.T) {
	client := NewFakeASRClient()

	resp, err := client.Transcribe(context.Background(), TranscribeRequest{
		Audio:       []byte("pretend this is audio"),
		ContentType: "audio/webm",
		Language:    "hi",
	})
	if err != nil {
		t.Fatalf("Transcribe() error = %v", err)
	}
	if resp.Transcript != cannedTranscripts["hi"] {
		t.Errorf("Transcript = %q, want the canned Hindi transcript", resp.Transcript)
	}
}

func TestFakeASRClient_Transcribe_UnknownLanguageFallsBackToEnglish(t *testing.T) {
	client := NewFakeASRClient()

	resp, err := client.Transcribe(context.Background(), TranscribeRequest{Language: "fr"})
	if err != nil {
		t.Fatalf("Transcribe() error = %v", err)
	}
	if resp.Transcript != cannedTranscripts["en"] {
		t.Errorf("Transcript = %q, want the English fallback", resp.Transcript)
	}
}

func TestFakeASRClient_Transcribe_NeverErrors(t *testing.T) {
	client := NewFakeASRClient()

	_, err := client.Transcribe(context.Background(), TranscribeRequest{})
	if err != nil {
		t.Errorf("Transcribe() error = %v, want nil", err)
	}
}
