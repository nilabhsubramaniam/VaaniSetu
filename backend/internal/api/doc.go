// Package api is the HTTP layer of the VaaniSetu backend: request parsing,
// validation, the JSON request/response and error-envelope shapes, and
// routing. Handlers are kept thin (docs/DEVELOPMENT.md §4) — all real logic
// lives in internal/conversation, which this package depends on but never
// duplicates. The wire contract implemented here is documented in full at
// docs/openapi/chat.yaml; that file and this package must be kept in sync
// by hand (see docs/DECISIONS.md for why swaggo annotations were not used
// for Phase 2's two endpoints).
package api
