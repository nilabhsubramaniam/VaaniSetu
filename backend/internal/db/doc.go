// Package db is the data-access layer: sqlc-generated, type-safe query
// code (models.go, conversation.sql.go — do not edit these by hand, edit
// internal/db/queries/*.sql and run `sqlc generate` instead), plus two
// hand-written helpers this file's siblings don't provide: [NewPool] (a
// pgx connection pool) and [Migrate] (applying this project's goose
// migrations from migrations/ on startup).
//
// internal/conversation is the only package that should import db —
// internal/api talks to internal/conversation, never to this package
// directly, so pgtype conversions stay in one place.
package db
