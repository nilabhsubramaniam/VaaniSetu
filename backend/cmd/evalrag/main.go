// Command evalrag is the Phase 7 closeout's lightweight, phase-scoped RAG
// evaluation (docs/EVALUATION.md §4): retrieval recall@4, cross-lingual
// recall@4, and a keyword-presence proxy for grounding/answer correctness
// (no LLM-judge infrastructure exists in this project — see
// docs/DECISIONS.md for the full reasoning). Not Phase 9's automated,
// repeatable harness (docs/EVALUATION.md §9) — a one-shot measurement
// tool, the Go-side counterpart to ai-services/scripts/benchmark_*.py,
// run by hand when this phase's RAG pipeline changes meaningfully.
//
// Exercises the real backend capabilities directly (documents.Service.Retrieve,
// conversation.Service.SendMessage) against whatever VAANISETU_DATABASE_URL/
// VAANISETU_EMBEDDING_SERVICE_URL/VAANISETU_LLM_SERVICE_URL point at — both
// service URLs are required (unlike cmd/api, this tool refuses to run
// against the fake clients, since a fake embedding/LLM can't produce a
// meaningful measurement). Seeds eval_data/rag_fixtures.yaml's documents,
// runs every query, and deletes the documents it created afterward so the
// run is repeatable.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	yaml "go.yaml.in/yaml/v3"

	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/config"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/conversation"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/db"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/documents"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/embedding"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/langid"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/llm"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/internal/logging"
	"github.com/nilabhsubramaniam/VaaniSetu/backend/migrations"
)

const (
	fixturesPath   = "eval_data/rag_fixtures.yaml"
	resultsPath    = "eval_results/rag_milestone_7_eval.json"
	retrievalTopK  = 4
	maxWorkerTicks = 50 // generous upper bound; stops early once nothing is pending
)

type fixtureDocument struct {
	ID       string `yaml:"id"`
	Language string `yaml:"language"`
	Title    string `yaml:"title"`
	Content  string `yaml:"content"`
}

type fixtureQuery struct {
	ID              string `yaml:"id"`
	Language        string `yaml:"language"`
	Text            string `yaml:"text"`
	DocumentID      string `yaml:"documentId"`
	CrossLingual    bool   `yaml:"crossLingual"`
	ExpectedKeyword string `yaml:"expectedKeyword"`
}

type fixtureSet struct {
	Documents []fixtureDocument `yaml:"documents"`
	Queries   []fixtureQuery    `yaml:"queries"`
}

type queryResult struct {
	QueryID              string   `json:"queryId"`
	Language             string   `json:"language"`
	CrossLingual         bool     `json:"crossLingual"`
	GoldDocumentID       string   `json:"goldDocumentId"`
	RetrievedDocumentIDs []string `json:"retrievedDocumentIds"`
	RetrievalHit         bool     `json:"retrievalHit"`
	ChatReply            string   `json:"chatReply"`
	ExpectedKeyword      string   `json:"expectedKeyword"`
	AnswerCorrect        bool     `json:"answerCorrectProxy"`
}

type report struct {
	OverallRecallAt4      float64       `json:"overallRecallAt4"`
	CrossLingualRecallAt4 float64       `json:"crossLingualRecallAt4"`
	SameLanguageRecallAt4 float64       `json:"sameLanguageRecallAt4"`
	AnswerCorrectRate     float64       `json:"answerCorrectProxyRate"`
	Results               []queryResult `json:"results"`
}

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
	if cfg.UsesFakeEmbedding() {
		return errors.New("evalrag: VAANISETU_EMBEDDING_SERVICE_URL must point at a real embedding service")
	}
	if cfg.UsesFakeLLM() {
		return errors.New("evalrag: VAANISETU_LLM_SERVICE_URL must point at a real llm service")
	}

	logger := logging.New(cfg.LogLevel)
	ctx := context.Background()

	if _, err := db.Migrate(ctx, cfg.DatabaseURL, migrations.FS); err != nil {
		return err
	}
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	embeddingClient := embedding.NewHTTPEmbeddingClient(cfg.EmbeddingServiceURL)
	llmClient := llm.NewHTTPLLMClient(cfg.LLMServiceURL)
	documentsService := documents.NewService(pool, embeddingClient)
	worker := documents.NewWorker(pool, embeddingClient, logger)
	convService := conversation.NewService(pool, llmClient, langid.NewFakeLangIDClient(), documentsService, logger)

	raw, err := os.ReadFile(fixturesPath)
	if err != nil {
		return fmt.Errorf("evalrag: read fixtures: %w", err)
	}
	var fixtures fixtureSet
	if err := yaml.Unmarshal(raw, &fixtures); err != nil {
		return fmt.Errorf("evalrag: parse fixtures: %w", err)
	}

	docIDs, err := seedDocuments(ctx, documentsService, fixtures.Documents)
	if err != nil {
		return err
	}
	defer cleanupDocuments(ctx, pool, logger, docIDs)

	processUntilReady(ctx, worker, logger, len(fixtures.Documents))
	warnIfAnyNotReady(ctx, documentsService, logger)

	results := make([]queryResult, 0, len(fixtures.Queries))
	for _, q := range fixtures.Queries {
		results = append(results, runQuery(ctx, documentsService, convService, docIDs, q))
	}

	rpt := buildReport(results)
	if err := writeReport(rpt); err != nil {
		return err
	}
	printSummary(rpt)
	return nil
}

func seedDocuments(
	ctx context.Context, svc *documents.Service, fixtureDocs []fixtureDocument,
) (map[string]string, error) {
	docIDs := make(map[string]string, len(fixtureDocs))
	for _, d := range fixtureDocs {
		created, err := svc.CreateDocument(ctx, d.Title, d.Content)
		if err != nil {
			return nil, fmt.Errorf("evalrag: seed document %s: %w", d.ID, err)
		}
		docIDs[d.ID] = created.ID
	}
	return docIDs, nil
}

// processUntilReady drives the worker directly (not its ticker loop) until
// every seeded document has been claimed once, the same pattern
// worker_integration_test.go uses — just against the real embedding
// service instead of a fake one.
func processUntilReady(ctx context.Context, worker *documents.Worker, logger *slog.Logger, documentCount int) {
	processed := 0
	for i := 0; i < maxWorkerTicks && processed < documentCount; i++ {
		if err := worker.Tick(ctx); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				break
			}
			logger.Warn("evalrag: worker tick failed", "error", err)
			continue
		}
		processed++
	}
}

func warnIfAnyNotReady(ctx context.Context, svc *documents.Service, logger *slog.Logger) {
	docs, err := svc.ListDocuments(ctx)
	if err != nil {
		logger.Warn("evalrag: could not verify document status", "error", err)
		return
	}
	for _, d := range docs {
		if d.Status != "ready" {
			logger.Warn("evalrag: a fixture document never became ready", "title", d.Title, "status", d.Status)
		}
	}
}

func runQuery(
	ctx context.Context,
	documentsService *documents.Service,
	convService *conversation.Service,
	docIDs map[string]string,
	q fixtureQuery,
) queryResult {
	goldDocID := docIDs[q.DocumentID]

	result := queryResult{
		QueryID:         q.ID,
		Language:        q.Language,
		CrossLingual:    q.CrossLingual,
		GoldDocumentID:  goldDocID,
		ExpectedKeyword: q.ExpectedKeyword,
	}

	chunks, err := documentsService.Retrieve(ctx, q.Text, retrievalTopK)
	if err != nil {
		slog.Warn("evalrag: retrieve failed", "query", q.ID, "error", err)
	}
	for _, c := range chunks {
		result.RetrievedDocumentIDs = append(result.RetrievedDocumentIDs, c.DocumentID)
		if c.DocumentID == goldDocID {
			result.RetrievalHit = true
		}
	}

	_, assistantTurn, err := convService.SendMessage(ctx, q.Text, q.Language)
	if err != nil {
		slog.Warn("evalrag: chat failed", "query", q.ID, "error", err)
		return result
	}
	result.ChatReply = assistantTurn.Text
	result.AnswerCorrect = strings.Contains(
		strings.ToLower(assistantTurn.Text), strings.ToLower(q.ExpectedKeyword),
	)
	return result
}

func buildReport(results []queryResult) report {
	var overallHits, crossHits, sameHits, crossTotal, sameTotal, correct int
	for _, r := range results {
		if r.RetrievalHit {
			overallHits++
		}
		if r.AnswerCorrect {
			correct++
		}
		if r.CrossLingual {
			crossTotal++
			if r.RetrievalHit {
				crossHits++
			}
		} else {
			sameTotal++
			if r.RetrievalHit {
				sameHits++
			}
		}
	}

	return report{
		OverallRecallAt4:      ratio(overallHits, len(results)),
		CrossLingualRecallAt4: ratio(crossHits, crossTotal),
		SameLanguageRecallAt4: ratio(sameHits, sameTotal),
		AnswerCorrectRate:     ratio(correct, len(results)),
		Results:               results,
	}
}

func ratio(hits, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(hits) / float64(total)
}

func writeReport(rpt report) error {
	data, err := json.MarshalIndent(rpt, "", "  ")
	if err != nil {
		return fmt.Errorf("evalrag: encode report: %w", err)
	}
	if err := os.WriteFile(resultsPath, data, 0o644); err != nil {
		return fmt.Errorf("evalrag: write report: %w", err)
	}
	return nil
}

func printSummary(rpt report) {
	fmt.Printf("Overall recall@4:       %.2f\n", rpt.OverallRecallAt4)
	fmt.Printf("Cross-lingual recall@4: %.2f\n", rpt.CrossLingualRecallAt4)
	fmt.Printf("Same-language recall@4: %.2f\n", rpt.SameLanguageRecallAt4)
	fmt.Printf("Answer-correct (proxy): %.2f\n", rpt.AnswerCorrectRate)
	fmt.Printf("\nWrote %s\n", resultsPath)
}

func cleanupDocuments(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger, docIDs map[string]string) {
	for fixtureID, id := range docIDs {
		var uuid pgtype.UUID
		if err := uuid.Scan(id); err != nil {
			logger.Warn("evalrag: cleanup: could not parse document id", "fixtureId", fixtureID, "error", err)
			continue
		}
		// document_chunks.document_id has ON DELETE CASCADE (Milestone 7c's
		// migration), so deleting the document alone is enough.
		if _, err := pool.Exec(ctx, "DELETE FROM documents WHERE id = $1", uuid); err != nil {
			logger.Warn("evalrag: cleanup: failed to delete document", "fixtureId", fixtureID, "error", err)
		}
	}
}
