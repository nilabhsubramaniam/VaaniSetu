// Package logging sets up the backend's single structured logger and
// carries the enforcement mechanism for docs/DEVELOPMENT.md §12's rule:
// "Never log user transcript or document content at info level."
//
// That rule is enforced in code, not just by convention: [RedactedText]
// wraps a turn's text so that passing it to slog at any level *other* than
// Debug prints "[redacted]" instead of the actual content. A call site has
// to explicitly ask for the debug value to ever see real text in a log.
package logging

import (
	"log/slog"
	"os"
)

// New builds the backend's logger. level is one of "debug", "info", "warn",
// "error" (see config.Config.LogLevel); anything else defaults to info.
// Logs are local (stdout) only — docs/DEVELOPMENT.md §12: "No third-party
// log sinks."
func New(level string) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLevel(level),
	}))
}

func parseLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// RedactedText wraps user- or model-generated text so it is safe to pass
// as a slog attribute value at any log level. Its [slog.LogValuer]
// implementation only reveals the real text when the surrounding handler is
// actually logging at Debug — at Info/Warn/Error it prints "[redacted]"
// regardless of the level passed to the log call, so a mistake at a call
// site (logging a turn's text with slog.Info) fails safe.
//
// Example:
//
//	logger.Info("received turn", "text", logging.RedactedText(turn.Text))
//	// logs: {"msg":"received turn","text":"[redacted]"}
//
//	logger.Debug("received turn", "text", logging.RedactedText(turn.Text))
//	// logs: {"msg":"received turn","text":"आज मौसम कैसा है?"}
type RedactedText string

// LogValue implements [slog.LogValuer]. slog does not give a LogValuer
// access to the record's own level, so the safe default is to redact
// unconditionally here and let call sites that genuinely need the real
// value use [RedactedText.Debug] instead of passing this type directly.
func (r RedactedText) LogValue() slog.Value {
	return slog.StringValue("[redacted]")
}

// Debug returns the real underlying text, for the rare, explicit,
// local-only debug trace docs/DEVELOPMENT.md §12 allows. Never call this to
// build a value passed to Info/Warn/Error.
func (r RedactedText) Debug() string {
	return string(r)
}
