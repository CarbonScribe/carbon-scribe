// Command migrate-integration-credentials is a one-off migration (#795)
// that encrypts any pre-existing integration_connections rows whose
// credentials were stored as plaintext JSON before this encryption-at-rest
// change — detected by a missing/zero credentials_key_version.
//
// Usage (from project-portal-backend/):
//
//	go run ./cmd/migrate-integration-credentials
//
// Requires the same DATABASE_URL and SETTINGS_ENCRYPTION_KEY_HEX
// environment variables as the API server. Safe to re-run: rows already
// migrated (credentials_key_version > 0) are skipped.
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"carbon-scribe/project-portal/project-portal-backend/internal/config"
	"carbon-scribe/project-portal/project-portal-backend/internal/integration"

	_ "github.com/lib/pq"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Failed to load configuration: %v", err)
	}

	keyring, err := integration.BuildCredentialsKeyring(
		cfg.Settings.EncryptionKeyVersion,
		cfg.Settings.EncryptionKeyHex,
		cfg.Settings.PreviousEncryptionKeysHex,
	)
	if err != nil {
		log.Fatalf("❌ Failed to initialize encryption keyring: %v", err)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	defer db.Close()

	migrated, err := migratePlaintextCredentials(db, keyring)
	if err != nil {
		log.Fatalf("❌ Migration failed: %v", err)
	}
	fmt.Printf("✅ Migrated %d integration_connections row(s) to encrypted credentials\n", migrated)
}

func migratePlaintextCredentials(db *sql.DB, keyring interface {
	Encrypt(plaintext string) (ciphertext string, version int, err error)
}) (int, error) {
	rows, err := db.Query(`
		SELECT id, credentials
		FROM integration_connections
		WHERE (credentials_key_version IS NULL OR credentials_key_version = 0)
		  AND credentials IS NOT NULL
	`)
	if err != nil {
		return 0, fmt.Errorf("query plaintext rows: %w", err)
	}
	defer rows.Close()

	type pending struct {
		id          string
		credentials []byte
	}
	var toMigrate []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.credentials); err != nil {
			return 0, fmt.Errorf("scan row: %w", err)
		}
		toMigrate = append(toMigrate, p)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("iterate rows: %w", err)
	}

	migrated := 0
	for _, p := range toMigrate {
		var creds map[string]any
		if len(p.credentials) == 0 {
			continue
		}
		if err := json.Unmarshal(p.credentials, &creds); err != nil {
			log.Printf("⚠️  Skipping connection %s: credentials column is not valid JSON: %v", p.id, err)
			continue
		}

		plaintext, err := json.Marshal(creds)
		if err != nil {
			return migrated, fmt.Errorf("re-marshal credentials for %s: %w", p.id, err)
		}
		ciphertext, version, err := keyring.Encrypt(string(plaintext))
		if err != nil {
			return migrated, fmt.Errorf("encrypt credentials for %s: %w", p.id, err)
		}

		if _, err := db.Exec(
			`UPDATE integration_connections SET credentials_ciphertext = $1, credentials_key_version = $2 WHERE id = $3`,
			ciphertext, version, p.id,
		); err != nil {
			return migrated, fmt.Errorf("update connection %s: %w", p.id, err)
		}
		migrated++
	}
	return migrated, nil
}
