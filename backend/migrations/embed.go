// Package migrations embeds this directory's SQL files into the compiled
// binary, so the backend can apply its own schema on startup with no
// external migration files needed at runtime — the deployment property
// docs/DECISIONS.md cites as the reason goose was chosen over golang-migrate.
package migrations

import "embed"

// FS holds every *.sql file in this directory, for cmd/api/main.go to pass
// to a goose provider.
//
//go:embed *.sql
var FS embed.FS
