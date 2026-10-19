package workers

import (
	"context"
	"runtime"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/compliance"
	"carbon-scribe/project-portal/project-portal-backend/internal/compliance/requests"
	"carbon-scribe/project-portal/project-portal-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// fakeExportStorage is an in-memory ExportFileDeleter: it records every key
// it was asked to delete, so tests can assert exactly which (and only
// which) export files the worker purged, and can be told to fail to verify
// a request is left alone (not marked purged) when deletion fails.
type fakeExportStorage struct {
	deleted []string
	failOn  map[string]bool
}

func (f *fakeExportStorage) Delete(_ context.Context, key string) error {
	if f.failOn[key] {
		return errTestStorageFailure
	}
	f.deleted = append(f.deleted, key)
	return nil
}

var errTestStorageFailure = &testStorageError{"simulated storage failure"}

type testStorageError struct{ msg string }

func (e *testStorageError) Error() string { return e.msg }

// fakeDiscoverer is a DataPresenceChecker whose answers are set per user ID,
// so tests can make verifyCompletedDeletions see leftover data for one
// user and a clean result for another — something the real, stubbed
// requests.Discoverer can never do (see cleanup_worker.go's doc comment on
// verifyCompletedDeletions).
type fakeDiscoverer struct {
	locations map[string][]requests.DataLocation
}

func (f *fakeDiscoverer) DiscoverUserData(_ context.Context, userID string, _ []string) ([]requests.DataLocation, error) {
	return f.locations[userID], nil
}

// newCleanupTestDB creates an in-memory sqlite DB with portable DDL mirroring
// 014_compliance_tables.up.sql, 010_settings_tables.up.sql, and
// 027_privacy_request_export_purged_at.up.sql. AutoMigrate can't be used
// here: every one of these models' ID column is tagged
// `default:gen_random_uuid()`, a Postgres-only function, and gorm's sqlite
// migrator emits it verbatim as `DEFAULT gen_random_uuid()` — invalid sqlite
// DDL syntax (sqlite requires function defaults to be parenthesized, and
// doesn't have this function anyway) — so AutoMigrate fails outright for
// every one of them. Hand-written DDL (as inventory_cache_purge_worker_test.go
// already does for the same reason) sidesteps this. Because these tables
// have no real DEFAULT for id either way, every row created against this DB
// in these tests must set an explicit, non-zero ID itself — gorm omits a
// zero-value field tagged `default:` from the INSERT, trusting the DB to
// supply one, which here it cannot.
func newCleanupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("Skipping sqlite-backed cleanup worker tests on Windows (no CGO/SQLite toolchain)")
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	ddl := []string{
		`CREATE TABLE retention_policies (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			data_category TEXT NOT NULL,
			jurisdiction TEXT DEFAULT 'global',
			retention_period_days INTEGER NOT NULL,
			archival_period_days INTEGER,
			review_period_days INTEGER DEFAULT 365,
			deletion_method TEXT DEFAULT 'soft_delete',
			anonymization_rules TEXT,
			legal_hold_enabled BOOLEAN DEFAULT 1,
			is_active BOOLEAN DEFAULT 1,
			version INTEGER DEFAULT 1,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE privacy_requests (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			request_type TEXT NOT NULL,
			request_subtype TEXT,
			status TEXT DEFAULT 'received',
			submitted_at DATETIME NOT NULL,
			completed_at DATETIME,
			estimated_completion DATETIME,
			data_categories TEXT,
			date_range_start DATETIME,
			date_range_end DATETIME,
			verification_method TEXT,
			verified_by TEXT,
			verified_at DATETIME,
			export_file_url TEXT,
			export_file_hash TEXT,
			export_purged_at DATETIME,
			deletion_summary TEXT,
			error_message TEXT,
			legal_basis TEXT,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE audit_logs (
			log_id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_time DATETIME NOT NULL,
			event_type TEXT NOT NULL,
			event_action TEXT NOT NULL,
			actor_id TEXT,
			actor_type TEXT,
			actor_ip TEXT,
			target_type TEXT,
			target_id TEXT,
			target_owner_id TEXT,
			data_category TEXT,
			sensitivity_level TEXT DEFAULT 'normal',
			service_name TEXT NOT NULL,
			endpoint TEXT,
			http_method TEXT,
			old_values TEXT,
			new_values TEXT,
			permission_used TEXT,
			signature TEXT,
			hash_chain TEXT,
			created_at DATETIME
		);`,
		`CREATE TABLE retention_schedules (
			id TEXT PRIMARY KEY,
			policy_id TEXT NOT NULL,
			data_type TEXT NOT NULL,
			next_review_date DATE NOT NULL,
			next_action_date DATE,
			action_type TEXT,
			last_action_date DATE,
			last_action_type TEXT,
			last_action_result TEXT,
			record_count_estimate INTEGER,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE legal_holds (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			reason TEXT NOT NULL,
			status TEXT DEFAULT 'active',
			data_categories TEXT,
			affected_user_ids TEXT,
			initiated_by TEXT NOT NULL,
			released_by TEXT,
			initiated_at DATETIME,
			released_at DATETIME,
			expires_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE api_keys (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			key_prefix TEXT NOT NULL,
			key_hash TEXT NOT NULL,
			key_last_four TEXT NOT NULL,
			scopes TEXT,
			rate_limit_per_minute INTEGER DEFAULT 60,
			rate_limit_per_day INTEGER DEFAULT 1000,
			expires_at DATETIME,
			is_active BOOLEAN DEFAULT 1,
			last_used_at DATETIME,
			metadata TEXT,
			created_at DATETIME
		);`,
	}
	for _, stmt := range ddl {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("failed to create test table: %v\n%s", err, stmt)
		}
	}
	return db
}

func newTestCleanupWorker(t *testing.T, db *gorm.DB, exportStorage ExportFileDeleter) *CleanupWorker {
	t.Helper()
	w := NewCleanupWorker(compliance.NewRepository(db), settings.NewRepository(db), exportStorage, time.Minute, nil)
	return w
}

// --- Responsibility 1: verify completed deletions ---

func TestCleanupWorker_VerifyCompletedDeletions_CleanPasses(t *testing.T) {
	db := newCleanupTestDB(t)
	complianceRepo := compliance.NewRepository(db)
	ctx := context.Background()

	req := &compliance.PrivacyRequest{
		ID:          uuid.NewString(),
		UserID:      "user-clean",
		RequestType: compliance.RequestTypeDeletion,
		Status:      compliance.RequestStatusCompleted,
		SubmittedAt: time.Now(),
		DeletionSummary: map[string]any{
			"deleted_categories": []string{"user_profile"},
		},
	}
	if err := complianceRepo.CreatePrivacyRequest(ctx, req); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	w := newTestCleanupWorker(t, db, nil)
	w.discoverer = &fakeDiscoverer{locations: map[string][]requests.DataLocation{
		"user-clean": {{Source: "users_db", Category: "user_profile", RecordCount: 0}},
	}}

	report := &CleanupReport{}
	w.verifyCompletedDeletions(ctx, report)

	if report.VerifiedDeletions != 1 {
		t.Fatalf("expected 1 verified deletion, got %d", report.VerifiedDeletions)
	}
	if len(report.FailedVerifications) != 0 {
		t.Fatalf("expected no failed verifications, got %v", report.FailedVerifications)
	}
}

func TestCleanupWorker_VerifyCompletedDeletions_DetectsLeftoverData(t *testing.T) {
	db := newCleanupTestDB(t)
	complianceRepo := compliance.NewRepository(db)
	ctx := context.Background()

	req := &compliance.PrivacyRequest{
		ID:          uuid.NewString(),
		UserID:      "user-dirty",
		RequestType: compliance.RequestTypeDeletion,
		Status:      compliance.RequestStatusCompleted,
		SubmittedAt: time.Now(),
		DeletionSummary: map[string]any{
			"deleted_categories": []string{"user_profile"},
		},
	}
	if err := complianceRepo.CreatePrivacyRequest(ctx, req); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	w := newTestCleanupWorker(t, db, nil)
	w.discoverer = &fakeDiscoverer{locations: map[string][]requests.DataLocation{
		"user-dirty": {{Source: "users_db", Category: "user_profile", RecordCount: 3}},
	}}

	report := &CleanupReport{}
	w.verifyCompletedDeletions(ctx, report)

	if report.VerifiedDeletions != 0 {
		t.Fatalf("expected 0 verified deletions, got %d", report.VerifiedDeletions)
	}
	if len(report.FailedVerifications) != 1 {
		t.Fatalf("expected 1 failed verification, got %v", report.FailedVerifications)
	}
}

// --- Responsibility 2: purge expired exports ---

func TestCleanupWorker_PurgeExpiredExports(t *testing.T) {
	db := newCleanupTestDB(t)
	complianceRepo := compliance.NewRepository(db)
	ctx := context.Background()

	expiredCompletedAt := time.Now().Add(-40 * 24 * time.Hour)
	freshCompletedAt := time.Now().Add(-1 * time.Hour)

	expired := &compliance.PrivacyRequest{
		ID:            uuid.NewString(),
		UserID:        "user-1",
		RequestType:   compliance.RequestTypeExport,
		Status:        compliance.RequestStatusCompleted,
		SubmittedAt:   time.Now(),
		CompletedAt:   &expiredCompletedAt,
		ExportFileURL: "/exports/user-1/export.json",
	}
	fresh := &compliance.PrivacyRequest{
		ID:            uuid.NewString(),
		UserID:        "user-2",
		RequestType:   compliance.RequestTypeExport,
		Status:        compliance.RequestStatusCompleted,
		SubmittedAt:   time.Now(),
		CompletedAt:   &freshCompletedAt,
		ExportFileURL: "/exports/user-2/export.json",
	}
	for _, r := range []*compliance.PrivacyRequest{expired, fresh} {
		if err := complianceRepo.CreatePrivacyRequest(ctx, r); err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	storage := &fakeExportStorage{failOn: map[string]bool{}}
	w := newTestCleanupWorker(t, db, storage)

	report := &CleanupReport{}
	w.purgeExpiredExports(ctx, report)

	if report.ExportsPurged != 1 {
		t.Fatalf("expected 1 export purged, got %d", report.ExportsPurged)
	}
	if len(storage.deleted) != 1 || storage.deleted[0] != "exports/user-1/export.json" {
		t.Fatalf("expected only the expired export's file to be deleted, got %v", storage.deleted)
	}

	got, err := complianceRepo.GetPrivacyRequest(ctx, expired.ID)
	if err != nil {
		t.Fatalf("fetch failed: %v", err)
	}
	if got.ExportPurgedAt == nil {
		t.Fatal("expected expired request to be marked purged")
	}

	gotFresh, err := complianceRepo.GetPrivacyRequest(ctx, fresh.ID)
	if err != nil {
		t.Fatalf("fetch failed: %v", err)
	}
	if gotFresh.ExportPurgedAt != nil {
		t.Fatal("expected fresh request to be left alone")
	}

	// Running again is a no-op: the expired request was already purged.
	report2 := &CleanupReport{}
	w.purgeExpiredExports(ctx, report2)
	if report2.ExportsPurged != 0 {
		t.Fatalf("expected second run to purge nothing, got %d", report2.ExportsPurged)
	}
}

func TestCleanupWorker_PurgeExpiredExports_NilStorageSkipsStep(t *testing.T) {
	db := newCleanupTestDB(t)
	w := newTestCleanupWorker(t, db, nil)

	report := &CleanupReport{}
	w.purgeExpiredExports(context.Background(), report)

	if report.ExportsPurged != 0 || len(report.Errors) != 0 {
		t.Fatalf("expected a no-op with no errors when storage is nil, got %+v", report)
	}
}

// --- Responsibility 3: release expired legal holds ---

func TestCleanupWorker_ReleaseExpiredLegalHolds(t *testing.T) {
	db := newCleanupTestDB(t)
	complianceRepo := compliance.NewRepository(db)
	ctx := context.Background()

	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)

	expired := &compliance.LegalHold{
		ID:   uuid.NewString(),
		Name: "expired hold", Reason: "investigation",
		Status: compliance.LegalHoldActive, InitiatedBy: "admin-1", ExpiresAt: &past,
	}
	stillActive := &compliance.LegalHold{
		ID:   uuid.NewString(),
		Name: "active hold", Reason: "investigation",
		Status: compliance.LegalHoldActive, InitiatedBy: "admin-1", ExpiresAt: &future,
	}
	indefinite := &compliance.LegalHold{
		ID:   uuid.NewString(),
		Name: "indefinite hold", Reason: "ongoing litigation",
		Status: compliance.LegalHoldActive, InitiatedBy: "admin-1", ExpiresAt: nil,
	}
	for _, h := range []*compliance.LegalHold{expired, stillActive, indefinite} {
		if err := complianceRepo.CreateLegalHold(ctx, h); err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	w := newTestCleanupWorker(t, db, nil)
	report := &CleanupReport{}
	w.releaseExpiredLegalHolds(ctx, report)

	if report.LegalHoldsReleased != 1 {
		t.Fatalf("expected 1 legal hold released, got %d", report.LegalHoldsReleased)
	}

	got, err := complianceRepo.GetLegalHold(ctx, expired.ID)
	if err != nil {
		t.Fatalf("fetch failed: %v", err)
	}
	if got.Status != compliance.LegalHoldExpired {
		t.Fatalf("expected status %q, got %q", compliance.LegalHoldExpired, got.Status)
	}
	if got.ReleasedAt == nil || got.ReleasedBy == nil || *got.ReleasedBy != "system:cleanup_worker" {
		t.Fatalf("expected ReleasedAt/ReleasedBy to be set by the system, got %+v", got)
	}

	active, err := complianceRepo.ListActiveLegalHolds(ctx)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(active) != 2 {
		t.Fatalf("expected 2 holds still active (one with a future expiry, one indefinite), got %d", len(active))
	}
}

// --- Responsibility 4: remove orphaned compliance data ---

func TestCleanupWorker_RemoveOrphanedComplianceData(t *testing.T) {
	db := newCleanupTestDB(t)
	complianceRepo := compliance.NewRepository(db)
	ctx := context.Background()

	policy := &compliance.RetentionPolicy{
		ID:   uuid.NewString(),
		Name: "kept policy", DataCategory: compliance.DataCategoryUserProfile, RetentionPeriodDays: 30,
	}
	if err := complianceRepo.CreateRetentionPolicy(ctx, policy); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	attached := &compliance.RetentionSchedule{
		ID:       uuid.NewString(),
		PolicyID: policy.ID, DataType: "user_profile", NextReviewDate: time.Now(),
	}
	orphaned := &compliance.RetentionSchedule{
		ID:       uuid.NewString(),
		PolicyID: uuid.NewString(), DataType: "user_profile", NextReviewDate: time.Now(),
	}
	for _, s := range []*compliance.RetentionSchedule{attached, orphaned} {
		if err := complianceRepo.CreateRetentionSchedule(ctx, s); err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	w := newTestCleanupWorker(t, db, nil)
	report := &CleanupReport{}
	w.removeOrphanedComplianceData(ctx, report)

	if report.OrphanedRecordsRemoved != 1 {
		t.Fatalf("expected 1 orphaned record removed, got %d", report.OrphanedRecordsRemoved)
	}

	remaining, err := complianceRepo.ListRetentionSchedules(ctx, "")
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(remaining) != 1 || remaining[0].PolicyID != policy.ID {
		t.Fatalf("expected only the attached schedule to remain, got %+v", remaining)
	}
}

// --- Responsibility 5: remove stale API keys ---

func TestCleanupWorker_RemoveStaleAPIKeys(t *testing.T) {
	db := newCleanupTestDB(t)
	settingsRepo := settings.NewRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(365 * 24 * time.Hour)

	expiredKey := &settings.APIKey{ID: uuid.New(), UserID: userID, Name: "expired", KeyPrefix: "csk_", KeyHash: "h1", KeyLastFour: "aaaa", IsActive: true, ExpiresAt: &past}
	longInactiveKey := &settings.APIKey{ID: uuid.New(), UserID: userID, Name: "revoked long ago", KeyPrefix: "csk_", KeyHash: "h2", KeyLastFour: "bbbb", IsActive: true}
	recentlyInactiveKey := &settings.APIKey{ID: uuid.New(), UserID: userID, Name: "just revoked", KeyPrefix: "csk_", KeyHash: "h3", KeyLastFour: "cccc", IsActive: true}
	activeKey := &settings.APIKey{ID: uuid.New(), UserID: userID, Name: "active", KeyPrefix: "csk_", KeyHash: "h4", KeyLastFour: "dddd", IsActive: true, ExpiresAt: &future}

	for _, k := range []*settings.APIKey{expiredKey, longInactiveKey, recentlyInactiveKey, activeKey} {
		if err := settingsRepo.CreateAPIKey(ctx, k); err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	// Revoke the two keys meant to be inactive via SaveAPIKey, mirroring
	// the real revocation flow (settings.Service sets IsActive = false,
	// then calls SaveAPIKey) — IsActive is tagged `gorm:"default:true"`, so
	// setting it to false (bool's zero value) on CreateAPIKey above would
	// have been silently omitted from the INSERT and left as the DB
	// default (true); Save writes every field regardless, so it actually
	// persists false.
	longInactiveKey.IsActive = false
	recentlyInactiveKey.IsActive = false
	if err := settingsRepo.SaveAPIKey(ctx, longInactiveKey); err != nil {
		t.Fatalf("revoking long-inactive key failed: %v", err)
	}
	if err := settingsRepo.SaveAPIKey(ctx, recentlyInactiveKey); err != nil {
		t.Fatalf("revoking recently-inactive key failed: %v", err)
	}

	// APIKey.CreatedAt is `gorm:"autoCreateTime"`, so CreateAPIKey always
	// overwrote it to "now" above regardless of what the struct literals
	// said; backdate it directly so the grace-period comparison below
	// actually exercises both branches.
	if err := db.Exec("UPDATE api_keys SET created_at = ? WHERE id = ?", time.Now().Add(-120*24*time.Hour), longInactiveKey.ID).Error; err != nil {
		t.Fatalf("backdating long-inactive key failed: %v", err)
	}
	if err := db.Exec("UPDATE api_keys SET created_at = ? WHERE id = ?", time.Now().Add(-1*24*time.Hour), recentlyInactiveKey.ID).Error; err != nil {
		t.Fatalf("backdating recently-inactive key failed: %v", err)
	}

	w := newTestCleanupWorker(t, db, nil)
	report := &CleanupReport{}
	w.removeStaleAPIKeys(ctx, report)

	if report.APIKeysRemoved != 2 {
		t.Fatalf("expected 2 stale API keys removed, got %d", report.APIKeysRemoved)
	}

	remaining, err := settingsRepo.ListAPIKeys(ctx, userID)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(remaining) != 2 {
		t.Fatalf("expected 2 keys to remain, got %d", len(remaining))
	}
	for _, k := range remaining {
		if k.ID == expiredKey.ID || k.ID == longInactiveKey.ID {
			t.Fatalf("expected key %s to have been removed", k.ID)
		}
	}
}

// --- RunOnce: full cycle + audit report ---

func TestCleanupWorker_RunOnce_EmitsAuditLogReport(t *testing.T) {
	db := newCleanupTestDB(t)
	complianceRepo := compliance.NewRepository(db)
	w := newTestCleanupWorker(t, db, nil)

	report, err := w.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce failed: %v", err)
	}
	if report == nil {
		t.Fatal("expected a non-nil report")
	}

	query := compliance.AuditLogQuery{EventType: "data_cleanup"}
	logs, total, err := complianceRepo.QueryAuditLogs(context.Background(), query)
	if err != nil {
		t.Fatalf("querying audit logs failed: %v", err)
	}
	if total != 1 || len(logs) != 1 {
		t.Fatalf("expected exactly 1 cleanup audit log entry, got %d", total)
	}
	if logs[0].ServiceName != "cleanup_worker" {
		t.Fatalf("expected ServiceName %q, got %q", "cleanup_worker", logs[0].ServiceName)
	}
}

func TestCleanupWorker_RunOnce_NilRepos(t *testing.T) {
	if _, err := NewCleanupWorker(nil, settings.NewRepository(nil), nil, time.Minute, nil).RunOnce(context.Background()); err == nil {
		t.Fatal("expected error for nil compliance repository")
	}
}

func TestCleanupWorker_RunNilGuards(t *testing.T) {
	db := newCleanupTestDB(t)
	w := newTestCleanupWorker(t, db, nil)
	if err := w.Run(nil); err == nil {
		t.Fatal("expected error for nil context")
	}
}

func TestCleanupWorker_RunStopsOnCancel(t *testing.T) {
	db := newCleanupTestDB(t)
	w := newTestCleanupWorker(t, db, nil)
	w.interval = 10 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- w.Run(ctx) }()
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
