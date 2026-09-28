package inventory

import (
	"context"
	"runtime"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newExpiryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("Skipping sqlite-backed expiry tests on Windows (no CGO/SQLite toolchain)")
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	// Portable DDL mirroring 017_inventory_tables.up.sql +
	// 025_inventory_credit_cache_expiry.up.sql. (AutoMigrate is avoided because
	// the Postgres column defaults such as gen_random_uuid() are rejected by
	// SQLite; expiry/index behavior under test is identical.)
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
	return db
}

// Every cache write must populate expires_at.
func TestUpsertPopulatesExpiresAt(t *testing.T) {
	db := newExpiryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()
	projectID := uuid.New()

	before := time.Now().UTC()
	if err := repo.UpsertCreditCache(ctx, &ProjectCreditCache{
		ProjectID:    projectID,
		TokenID:      1,
		OwnerAddress: "GOWNER",
		Status:       StatusIssued,
	}); err != nil {
		t.Fatalf("upsert failed: %v", err)
	}

	got, err := repo.GetFreshCreditByTokenID(ctx, projectID, 1)
	if err != nil {
		t.Fatalf("fresh read failed: %v", err)
	}
	if got.ExpiresAt.IsZero() {
		t.Fatal("expires_at was not populated on write")
	}
	if got.LastSynced.IsZero() {
		t.Fatal("last_synced was not populated on write")
	}
	// Default data-layer TTL is 5 minutes.
	want := before.Add(5 * time.Minute)
	if got.ExpiresAt.Before(want.Add(-time.Minute)) || got.ExpiresAt.After(want.Add(2*time.Minute)) {
		t.Fatalf("expires_at %v not within tolerance of last_synced+5m", got.ExpiresAt)
	}
}

// Expired rows must never be served as current.
func TestExpiredRowsExcludedFromReads(t *testing.T) {
	db := newExpiryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()
	projectID := uuid.New()
	now := time.Now().UTC()

	fresh := ProjectCreditCache{
		ProjectID:    projectID,
		TokenID:      10,
		OwnerAddress: "GOWNER",
		Status:       StatusIssued,
		LastSynced:   now,
		ExpiresAt:    now.Add(time.Hour),
	}
	stale := ProjectCreditCache{
		ProjectID:    projectID,
		TokenID:      11,
		OwnerAddress: "GOWNER",
		Status:       StatusIssued,
		LastSynced:   now.Add(-2 * time.Hour),
		ExpiresAt:    now.Add(-time.Hour),
	}
	zeroExpiry := ProjectCreditCache{
		ProjectID:    projectID,
		TokenID:      12,
		OwnerAddress: "GOWNER",
		Status:       StatusIssued,
		LastSynced:   now,
		// ExpiresAt zero value must be treated as expired.
	}
	for _, row := range []ProjectCreditCache{fresh, stale, zeroExpiry} {
		r := row
		if err := db.Create(&r).Error; err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	if _, err := repo.GetCreditByTokenID(ctx, projectID, 11); err == nil {
		t.Fatal("expected expired row to be excluded from GetCreditByTokenID")
	}
	if _, err := repo.GetCreditByTokenID(ctx, projectID, 12); err == nil {
		t.Fatal("expected zero-expiry row to be excluded from GetCreditByTokenID")
	}
	if _, err := repo.GetFreshCreditByTokenID(ctx, projectID, 10); err != nil {
		t.Fatalf("expected fresh row to be returned: %v", err)
	}

	caches, total, err := repo.ListCreditsByProject(ctx, projectID, 20, 0)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if total != 1 || len(caches) != 1 || caches[0].TokenID != 10 {
		t.Fatalf("expected only the fresh row, got total=%d rows=%v", total, caches)
	}

	summary, err := repo.GetInventorySummary(ctx, projectID)
	if err != nil {
		t.Fatalf("summary failed: %v", err)
	}
	if summary.TotalCredits != 1 || summary.ActiveCredits != 1 {
		t.Fatalf("summary counted expired rows: %+v", summary)
	}
}

// Purge path must remove only rows past expires_at.
func TestPurgeExpiredCache(t *testing.T) {
	db := newExpiryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()
	projectID := uuid.New()
	now := time.Now().UTC()

	seed := []ProjectCreditCache{
		{ProjectID: projectID, TokenID: 20, OwnerAddress: "G", Status: StatusIssued, LastSynced: now, ExpiresAt: now.Add(time.Hour)},
		{ProjectID: projectID, TokenID: 21, OwnerAddress: "G", Status: StatusIssued, LastSynced: now.Add(-time.Hour), ExpiresAt: now.Add(-time.Minute)},
		{ProjectID: projectID, TokenID: 22, OwnerAddress: "G", Status: StatusRetired, LastSynced: now.Add(-time.Hour), ExpiresAt: now.Add(-time.Second)},
	}
	for _, row := range seed {
		r := row
		if err := db.Create(&r).Error; err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	expired, err := repo.CountExpiredCache(ctx)
	if err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if expired != 2 {
		t.Fatalf("expected 2 expired rows, got %d", expired)
	}

	purged, err := repo.PurgeExpiredCache(ctx)
	if err != nil {
		t.Fatalf("purge failed: %v", err)
	}
	if purged != 2 {
		t.Fatalf("expected purge to remove 2 rows, removed %d", purged)
	}

	if _, err := repo.GetFreshCreditByTokenID(ctx, projectID, 20); err != nil {
		t.Fatalf("fresh row should survive purge: %v", err)
	}
	remaining, err := repo.CountExpiredCache(ctx)
	if err != nil {
		t.Fatalf("recount failed: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("expected 0 expired rows after purge, got %d", remaining)
	}
}

// Service writes must carry expires_at ≈ now + cacheTTL, and expired cached
// rows must fall back to a live chain read instead of being served stale.
func TestServiceExpiryBehavior(t *testing.T) {
	db := newExpiryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()
	ttl := 30 * time.Minute
	svc := NewService(repo, NewMockSorobanClient(), ttl)
	projectID := uuid.New()
	owner := "GDEMO00000000000000000000000000000000000000000000000000"

	if err := svc.SyncProjectInventory(ctx, projectID, owner); err != nil {
		t.Fatalf("sync failed: %v", err)
	}
	caches, total, err := repo.ListCreditsByProject(ctx, projectID, 100, 0)
	if err != nil || total == 0 {
		t.Fatalf("expected synced rows, total=%d err=%v", total, err)
	}
	for _, c := range caches {
		if c.ExpiresAt.IsZero() {
			t.Fatalf("synced row token %d missing expires_at", c.TokenID)
		}
		if time.Until(c.ExpiresAt) < 25*time.Minute || time.Until(c.ExpiresAt) > 35*time.Minute {
			t.Fatalf("synced row token %d expires_at not ~now+30m: %v", c.TokenID, c.ExpiresAt)
		}
	}

	// Expire one row behind the service's back; the detail read must refresh
	// from chain (mock token 1 exists) rather than serve the stale row.
	staleToken := caches[0].TokenID
	if err := db.Model(&ProjectCreditCache{}).
		Where("project_id = ? AND token_id = ?", projectID, staleToken).
		Update("expires_at", time.Now().UTC().Add(-time.Minute)).Error; err != nil {
		t.Fatalf("failed to expire row: %v", err)
	}
	detail, err := svc.GetCreditDetails(ctx, projectID, staleToken)
	if err != nil {
		t.Fatalf("expected chain fallback for expired row, got: %v", err)
	}
	if detail.TokenID != staleToken {
		t.Fatalf("expected token %d, got %d", staleToken, detail.TokenID)
	}

	if got := svc.CacheTTL(); got != ttl {
		t.Fatalf("expected CacheTTL %v, got %v", ttl, got)
	}
	if _, err := svc.PurgeExpiredCache(ctx); err != nil {
		t.Fatalf("service purge failed: %v", err)
	}
}
