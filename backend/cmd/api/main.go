// Command api is the VaaniSetu backend's entrypoint: load configuration,
// open the database pool, wire the configured LLMClient (fake or real, per
// config.Config.UsesFakeLLM), and serve the Phase 2 chat API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/api"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/asr"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/config"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/llm"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/logging"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/migrations"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := logging.New(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	applied, err := db.Migrate(ctx, cfg.DatabaseURL, migrations.FS)
	if err != nil {
		return err
	}
	logger.Info("migrations applied", "count", applied)

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	var llmClient llm.LLMClient
	if cfg.UsesFakeLLM() {
		logger.Warn("no VAANISETU_LLM_SERVICE_URL set — using FakeLLMClient (Milestone 2a behavior)")
		llmClient = llm.NewFakeLLMClient()
	} else {
		llmClient = llm.NewHTTPLLMClient(cfg.LLMServiceURL)
	}

	var asrClient asr.ASRClient
	if cfg.UsesFakeASR() {
		logger.Warn("no VAANISETU_ASR_SERVICE_URL set — using FakeASRClient (Milestone 3a behavior)")
		asrClient = asr.NewFakeASRClient()
	} else {
		asrClient = asr.NewHTTPASRClient(cfg.ASRServiceURL)
	}

	convService := conversation.NewService(pool, llmClient)
	server := api.NewServer(convService, asrClient, logger, cfg.AllowedOrigin)

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			logger.Error("graceful shutdown failed", "error", err)
		}
	}()

	logger.Info("listening",
		"port", cfg.Port,
		"usesFakeLLM", cfg.UsesFakeLLM(),
		"usesFakeASR", cfg.UsesFakeASR(),
		"allowedOrigin", cfg.AllowedOrigin,
	)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
