package conversation

// resolveLanguage is unexported, so this file lives in package conversation
// itself (not conversation_test) — unlike conversation_integration_test.go,
// it needs no database, LLM, or langid client, so it runs everywhere,
// Docker or not.

import "testing"

func TestResolveLanguage(t *testing.T) {
	hi := "hi"
	en := "en"
	fr := "fr" // outside supportedLanguages — fasttext-lid176 can return any of its 176 labels

	tests := []struct {
		name     string
		language string
		detected *string
		want     string
	}{
		{"auto resolves to a supported detected language", autoLanguage, &en, "en"},
		{"auto falls back to default when detection is nil", autoLanguage, nil, defaultLanguage},
		{"auto falls back to default when detected language is unsupported", autoLanguage, &fr, defaultLanguage},
		{"a manual pin passes through unchanged even if detected differs", "en", &hi, "en"},
		{"a manual pin passes through unchanged when detection is nil", "hi", nil, "hi"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveLanguage(tt.language, tt.detected)
			if got != tt.want {
				t.Errorf("resolveLanguage(%q, %v) = %q, want %q", tt.language, tt.detected, got, tt.want)
			}
		})
	}
}
