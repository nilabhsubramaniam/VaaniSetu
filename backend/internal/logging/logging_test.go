package logging

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

func TestRedactedText_NeverLeaksAtInfo(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}))

	secret := RedactedText("आज मौसम कैसा है?")
	logger.Info("received turn", "text", secret)

	out := buf.String()
	if strings.Contains(out, "मौसम") {
		t.Fatalf("RedactedText leaked real content at Info level: %s", out)
	}

	var decoded map[string]any
	if err := json.Unmarshal(buf.Bytes(), &decoded); err != nil {
		t.Fatalf("log line is not valid JSON: %v", err)
	}
	if decoded["text"] != "[redacted]" {
		t.Errorf(`text = %v, want "[redacted]"`, decoded["text"])
	}
}

func TestRedactedText_DebugExposesRealValue(t *testing.T) {
	secret := RedactedText("hello")
	if secret.Debug() != "hello" {
		t.Errorf("Debug() = %q, want %q", secret.Debug(), "hello")
	}
}

func TestNew_DefaultsToInfoLevel(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: parseLevel("nonsense")}))
	logger.Debug("should not appear")
	logger.Info("should appear")

	out := buf.String()
	if strings.Contains(out, "should not appear") {
		t.Error("debug line was logged despite an unrecognized level defaulting to info")
	}
	if !strings.Contains(out, "should appear") {
		t.Error("info line was not logged")
	}
}
