package langid

import (
	"context"
	"testing"
)

func TestFakeLangIDClient_Detect_ReportsHiForDevanagariText(t *testing.T) {
	client := NewFakeLangIDClient()

	resp, err := client.Detect(context.Background(), DetectRequest{Text: "आज मौसम कैसा है?"})
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if resp.Language != "hi" {
		t.Errorf("Language = %q, want hi", resp.Language)
	}
	if resp.Confidence != 1.0 {
		t.Errorf("Confidence = %v, want 1.0", resp.Confidence)
	}
}

func TestFakeLangIDClient_Detect_ReportsEnForLatinScriptText(t *testing.T) {
	client := NewFakeLangIDClient()

	resp, err := client.Detect(context.Background(), DetectRequest{Text: "What's on my schedule today?"})
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if resp.Language != "en" {
		t.Errorf("Language = %q, want en", resp.Language)
	}
}

func TestFakeLangIDClient_Detect_CannotDistinguishHinglishFromEnglish(t *testing.T) {
	// A real, honest limitation, not a bug: this fake cannot tell Hinglish
	// (romanized Hindi-English) apart from plain English — it only checks
	// for Devanagari characters, which romanized text has none of.
	client := NewFakeLangIDClient()

	resp, err := client.Detect(context.Background(), DetectRequest{Text: "kal ka weather kaisa rahega"})
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if resp.Language != "en" {
		t.Errorf("Language = %q, want en (this fake cannot detect Hinglish — that's Milestone 6b's job)", resp.Language)
	}
}

func TestFakeLangIDClient_Detect_NeverErrors(t *testing.T) {
	client := NewFakeLangIDClient()

	_, err := client.Detect(context.Background(), DetectRequest{})
	if err != nil {
		t.Errorf("Detect() error = %v, want nil", err)
	}
}
