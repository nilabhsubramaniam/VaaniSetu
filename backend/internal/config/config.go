package config

import (
	"fmt"
	"os"
)

// Config holds every environment-derived setting the backend needs. Every
// field is populated by [Load]; nothing else in this codebase should call
// os.Getenv directly, so all configuration surface stays visible here.
type Config struct {
	// Port the HTTP server listens on, e.g. "8080".
	Port string

	// DatabaseURL is a standard PostgreSQL connection string, e.g.
	// "postgres://user:pass@localhost:5432/vaanisetu".
	DatabaseURL string

	// LLMServiceURL, when set, points HTTPLLMClient at the Python `llm`
	// service (see internal/llm). When empty, the backend uses
	// FakeLLMClient instead — this one variable is the entire "swap the
	// model by config, not by code" mechanism described in
	// docs/ARCHITECTURE.md §5.
	LLMServiceURL string

	// ASRServiceURL, when set, points HTTPASRClient at the Python `asr`
	// capability (see internal/asr) — typically the same host:port as
	// LLMServiceURL, since both capabilities can be hosted in the same
	// Python process (docs/DEVELOPMENT.md §5). When empty, the backend
	// uses FakeASRClient instead.
	ASRServiceURL string

	// LogLevel is one of "debug", "info", "warn", "error" (see
	// internal/logging). Defaults to "info".
	LogLevel string

	// AllowedOrigin is the single origin the backend's CORS handling
	// permits (see internal/api's CORS middleware) — Angular's dev server
	// by default. Not a "*" policy; only one origin is ever allowed.
	AllowedOrigin string
}

// Load reads Config from the environment, applying defaults for everything
// optional and failing fast on anything required but missing.
//
// Required: VAANISETU_DATABASE_URL.
// Optional: VAANISETU_PORT (default "8080"), VAANISETU_LLM_SERVICE_URL and
// VAANISETU_ASR_SERVICE_URL (default "", meaning use the fake clients),
// VAANISETU_LOG_LEVEL (default "info"), VAANISETU_ALLOWED_ORIGIN (default
// "http://localhost:4200").
func Load() (Config, error) {
	cfg := Config{
		Port:          getEnvDefault("VAANISETU_PORT", "8080"),
		DatabaseURL:   os.Getenv("VAANISETU_DATABASE_URL"),
		LLMServiceURL: os.Getenv("VAANISETU_LLM_SERVICE_URL"),
		ASRServiceURL: os.Getenv("VAANISETU_ASR_SERVICE_URL"),
		LogLevel:      getEnvDefault("VAANISETU_LOG_LEVEL", "info"),
		AllowedOrigin: getEnvDefault("VAANISETU_ALLOWED_ORIGIN", "http://localhost:4200"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("config: VAANISETU_DATABASE_URL is required")
	}

	return cfg, nil
}

// UsesFakeLLM reports whether no real LLM service has been configured, in
// which case the caller should wire up llm.FakeLLMClient instead of
// llm.HTTPLLMClient.
func (c Config) UsesFakeLLM() bool {
	return c.LLMServiceURL == ""
}

// UsesFakeASR reports whether no real ASR service has been configured, in
// which case the caller should wire up asr.FakeASRClient instead of
// asr.HTTPASRClient.
func (c Config) UsesFakeASR() bool {
	return c.ASRServiceURL == ""
}

func getEnvDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
