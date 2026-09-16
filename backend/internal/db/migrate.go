package db

import (
	"context"
	stdsql "database/sql"
	"fmt"
	"io/fs"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver, used only here
	"github.com/pressly/goose/v3"
)

// Migrate applies every pending migration in migrationsFS to databaseURL and
// reports how many ran. It opens its own short-lived database/sql
// connection via pgx's stdlib adapter — goose requires *sql.DB, while the
// rest of the backend uses pgx's native pgxpool (see [NewPool]) — and
// closes it before returning.
//
// Called once from cmd/api/main.go at startup, before [NewPool]. This is
// the "compiled binary applies its own schema" property docs/DECISIONS.md
// gives as the reason for choosing goose.
func Migrate(ctx context.Context, databaseURL string, migrationsFS fs.FS) (int, error) {
	sqlDB, err := stdsql.Open("pgx", databaseURL)
	if err != nil {
		return 0, fmt.Errorf("db: open migration connection: %w", err)
	}
	defer func() { _ = sqlDB.Close() }()

	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrationsFS)
	if err != nil {
		return 0, fmt.Errorf("db: create migration provider: %w", err)
	}

	results, err := provider.Up(ctx)
	if err != nil {
		return 0, fmt.Errorf("db: apply migrations: %w", err)
	}

	return len(results), nil
}
