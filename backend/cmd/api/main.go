// Command api is the VaaniSetu backend's entrypoint: load configuration,
// open the database pool, wire the configured LLM/ASR/TTS/langid clients
// (each fake or real, per
// config.Config.UsesFakeLLM/UsesFakeASR/UsesFakeTTS/UsesFakeLangID), and
// serve the chat, transcription, synthesis, and voice-turn API.
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
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/documents"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/langid"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/llm"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/logging"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/tts"
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

	var ttsClient tts.TTSClient
	if cfg.UsesFakeTTS() {
		logger.Warn("no VAANISETU_TTS_SERVICE_URL set — using FakeTTSClient (Milestone 4a behavior)")
		ttsClient = tts.NewFakeTTSClient()
	} else {
		ttsClient = tts.NewHTTPTTSClient(cfg.TTSServiceURL)
	}

	var langIDClient langid.LangIDClient
	if cfg.UsesFakeLangID() {
		logger.Warn("no VAANISETU_LANGID_SERVICE_URL set — using FakeLangIDClient (Milestone 6a behavior)")
		langIDClient = langid.NewFakeLangIDClient()
	} else {
		langIDClient = langid.NewHTTPLangIDClient(cfg.LangIDServiceURL)
	}

	var embeddingClient embedding.EmbeddingClient
	if cfg.UsesFakeEmbedding() {
		logger.Warn("no VAANISETU_EMBEDDING_SERVICE_URL set — using FakeEmbeddingClient (Milestone 7a behavior)")
		embeddingClient = embedding.NewFakeEmbeddingClient()
	} else {
		embeddingClient = embedding.NewHTTPEmbeddingClient(cfg.EmbeddingServiceURL)
	}

	documentsService := documents.NewService(pool, embeddingClient)
	convService := conversation.NewService(pool, llmClient, langIDClient, documentsService, logger)
	server := api.NewServer(convService, documentsService, asrClient, ttsClient, logger, cfg.AllowedOrigin)

	// The async chunk/embed job dispatch docs/ARCHITECTURE.md §3.2
	// requires (Phase 7 Milestone 7c) — polls for documents left
	// "pending" by documentsService.CreateDocument and turns them into
	// "ready"/"failed". Tied to the same shutdown context as the HTTP
	// server below, so it stops cleanly rather than leaking a goroutine.
	documentsWorker := documents.NewWorker(pool, embeddingClient, logger)
	go documentsWorker.Run(ctx, 2*time.Second)

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
		"usesFakeTTS", cfg.UsesFakeTTS(),
		"usesFakeLangID", cfg.UsesFakeLangID(),
		"usesFakeEmbedding", cfg.UsesFakeEmbedding(),
		"allowedOrigin", cfg.AllowedOrigin,
	)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
