// Package conversation is the business-logic layer behind the chat API: it
// owns the (Phase 2: single, implicit) session, persists turns via the
// sqlc-generated internal/db.Queries, and calls the configured
// internal/llm.LLMClient to produce a reply. internal/api depends on this
// package rather than on internal/db or internal/llm directly, so the HTTP
// layer never has to know about pgtype conversions or which LLMClient is
// wired up.
package conversation
