package workers

import (
	"context"
	"runtime"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/inventory"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newPurgeTestRepo(t *testing.T) inventory.Repository {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("Skipping sqlite-backed purge tests on Windows (no CGO/SQLite toolchain)")
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	// Portable DDL mirroring 017_inventory_tables.up.sql +
	// 025_inventory_credit_cache_expiry.up.sql (see inventory expiry tests).
	table := `
	CREATE TABLE project_credit_cache (
	    id TEXT PRIMARY KEY,
	    project_id TEXT NOT NULL,
	    token_id INTEGER NOT NULL,
	    owner_address VARCHAR(56) NOT NULL,
	    status VARCHAR(20),
	    vintage_year BIGINT,
	    methodology_id INTEGER,
	    quality_score BIGINT DEFAULT 0,
	    is_burned BOOLEAN DEFAULT FALSE,
	    last_synced DATETIME,
	    expires_at DATETIME,
	    created_at DATETIME,
	    updated_at DATETIME,
	    UNIQUE(project_id, token_id)
	);`
	if err := db.Exec(table).Error; err != nil {
		t.Fatalf("failed to create test table: %v", err)
	}
	if err := db.Exec(`CREATE INDEX idx_project_credit_cache_expires_at ON project_credit_cache(expires_at);`).Error; err != nil {
		t.Fatalf("failed to create test index: %v", err)
	}
	now := time.Now().UTC()
	projectID := uuid.New()
	seed := []inventory.ProjectCreditCache{
		{ProjectID: projectID, TokenID: 1, OwnerAddress: "G", Status: inventory.StatusIssued, LastSynced: now, ExpiresAt: now.Add(time.Hour)},
		{ProjectID: projectID, TokenID: 2, OwnerAddress: "G", Status: inventory.StatusIssued, LastSynced: now.Add(-time.Hour), ExpiresAt: now.Add(-time.Minute)},
	}
	for _, row := range seed {
		r := row
		if err := db.Create(&r).Error; err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}
	return inventory.NewRepository(db)
}

func TestInventoryCachePurgeWorkerPurgeOnce(t *testing.T) {
	repo := newPurgeTestRepo(t)
	worker := NewInventoryCachePurgeWorker(repo, time.Minute, nil)
	purged, err := worker.PurgeOnce(context.Background())
	if err != nil {
		t.Fatalf("purge once failed: %v", err)
	}
	if purged != 1 {
		t.Fatalf("expected 1 purged row, got %d", purged)
	}
	// Second cycle is a no-op.
	purged, err = worker.PurgeOnce(context.Background())
	if err != nil {
		t.Fatalf("second purge failed: %v", err)
	}
	if purged != 0 {
		t.Fatalf("expected 0 purged rows on second cycle, got %d", purged)
	}
}

func TestInventoryCachePurgeWorkerNilRepo(t *testing.T) {
	worker := NewInventoryCachePurgeWorker(nil, time.Minute, nil)
	if _, err := worker.PurgeOnce(context.Background()); err == nil {
		t.Fatal("expected error for nil repository")
	}
	if err := worker.Run(nil); err == nil {
		t.Fatal("expected error for nil context")
	}
}

func TestInventoryCachePurgeWorkerRunStopsOnCancel(t *testing.T) {
	repo := newPurgeTestRepo(t)
	worker := NewInventoryCachePurgeWorker(repo, 10*time.Millisecond, nil)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- worker.Run(ctx) }()
	time.Sleep(50 * time.Millisecond)
	cancel()
	select {
	case err := <-done:
		if err != context.Canceled {
			t.Fatalf("expected context.Canceled, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not stop after cancel")
	}
}
