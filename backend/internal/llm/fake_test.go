package llm

import (
	"context"
	"testing"
)

func TestFakeLLMClient_Generate(t *testing.T) {
	tests := []struct {
		name     string
		language string
		wantErr  bool
	}{
		{name: "hindi", language: "hi"},
		{name: "hinglish", language: "hinglish"},
		{name: "english", language: "en"},
		{name: "unknown language falls back to english", language: "fr"},
	}

	client := NewFakeLLMClient()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := client.Generate(context.Background(), GenerateRequest{
				Text:     "hello",
				Language: tt.language,
			})
			if err != nil {
				t.Fatalf("Generate() error = %v", err)
			}
			if resp.Reply == "" {
				t.Error("Generate() returned an empty reply")
			}
		})
	}
}

func TestFakeLLMClient_IsDeterministic(t *testing.T) {
	client := NewFakeLLMClient()
	req := GenerateRequest{Text: "anything", Language: "hi"}

	first, err := client.Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	second, err := client.Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}

	if first.Reply != second.Reply {
		t.Errorf("replies differ across calls: %q vs %q", first.Reply, second.Reply)
	}
}
