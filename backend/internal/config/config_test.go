package config

import "testing"

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		wantErr bool
		check   func(t *testing.T, c Config)
	}{
		{
			name:    "missing database URL fails fast",
			env:     map[string]string{},
			wantErr: true,
		},
		{
			name: "defaults applied when only the required var is set",
			env: map[string]string{
				"VAANISETU_DATABASE_URL": "postgres://localhost/vaanisetu",
			},
			check: func(t *testing.T, c Config) {
				if c.Port != "8080" {
					t.Errorf("Port = %q, want default 8080", c.Port)
				}
				if c.LogLevel != "info" {
					t.Errorf("LogLevel = %q, want default info", c.LogLevel)
				}
				if !c.UsesFakeLLM() {
					t.Error("UsesFakeLLM() = false, want true when LLMServiceURL is unset")
				}
				if c.AllowedOrigin != "http://localhost:4200" {
					t.Errorf("AllowedOrigin = %q, want default http://localhost:4200", c.AllowedOrigin)
				}
			},
		},
		{
			name: "explicit LLM service URL disables the fake client",
			env: map[string]string{
				"VAANISETU_DATABASE_URL":    "postgres://localhost/vaanisetu",
				"VAANISETU_LLM_SERVICE_URL": "http://ai-services:8090",
			},
			check: func(t *testing.T, c Config) {
				if c.UsesFakeLLM() {
					t.Error("UsesFakeLLM() = true, want false when LLMServiceURL is set")
				}
			},
		},
		{
			name: "explicit allowed origin overrides the default",
			env: map[string]string{
				"VAANISETU_DATABASE_URL":   "postgres://localhost/vaanisetu",
				"VAANISETU_ALLOWED_ORIGIN": "https://vaanisetu.example",
			},
			check: func(t *testing.T, c Config) {
				if c.AllowedOrigin != "https://vaanisetu.example" {
					t.Errorf("AllowedOrigin = %q, want the overridden value", c.AllowedOrigin)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, k := range []string{
				"VAANISETU_PORT",
				"VAANISETU_DATABASE_URL",
				"VAANISETU_LLM_SERVICE_URL",
				"VAANISETU_LOG_LEVEL",
				"VAANISETU_ALLOWED_ORIGIN",
			} {
				t.Setenv(k, "")
			}
			for k, v := range tt.env {
				t.Setenv(k, v)
			}

			cfg, err := Load()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Load() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.check != nil {
				tt.check(t, cfg)
			}
		})
	}
}
