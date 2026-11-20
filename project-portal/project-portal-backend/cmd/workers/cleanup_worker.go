package workers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/compliance"
	"carbon-scribe/project-portal/project-portal-backend/internal/compliance/requests"
	"carbon-scribe/project-portal/project-portal-backend/internal/compliance/retention"
	"carbon-scribe/project-portal/project-portal-backend/internal/settings"
)

// Defaults for the cleanup worker's time-based thresholds and batch size
// (issue #691). These are deliberately conservative: an export file is kept
// a full month after it was generated (giving the requester plenty of time
// to download it) and a revoked API key's hash is kept for a full quarter
// (giving support/audit staff a lookback window) before either is purged.
const (
	DefaultCleanupInterval         = 24 * time.Hour
	DefaultExportRetention         = 30 * 24 * time.Hour
	DefaultAPIKeyInactiveRetention = 90 * 24 * time.Hour
	cleanupBatchSize               = 100
)

// ExportFileDeleter abstracts the storage backend expired export files are
// deleted from. *storage.S3Client (see pkg/storage) satisfies this; tests
// use a fake so no real S3 credentials are needed.
type ExportFileDeleter interface {
	Delete(ctx context.Context, key string) error
}

// DataPresenceChecker reports what user data remains across this system's
// data sources, filtered to the given categories. requests.Discoverer
// satisfies it in production; tests use a fake so a verification failure
// (data that should have been deleted but wasn't) can actually be exercised
// — the real Discoverer is a stub that always reports zero records, so it
// alone can never demonstrate a failing verification (see the doc comment
// on verifyCompletedDeletions).
type DataPresenceChecker interface {
	DiscoverUserData(ctx context.Context, userID string, categories []string) ([]requests.DataLocation, error)
}

// CleanupReport summarizes a single cleanup run for compliance audit
// purposes (issue #691's fourth required change). RunOnce both logs this
// and persists it as a compliance.AuditLog entry.
type CleanupReport struct {
	RunAt                  time.Time `json:"run_at"`
	VerifiedDeletions      int       `json:"verified_deletions"`
	FailedVerifications    []string  `json:"failed_verifications,omitempty"`
	ExportsPurged          int       `json:"exports_purged"`
	LegalHoldsReleased     int       `json:"legal_holds_released"`
	OrphanedRecordsRemoved int       `json:"orphaned_records_removed"`
	APIKeysRemoved         int       `json:"api_keys_removed"`
	Errors                 []string  `json:"errors,omitempty"`
}

// CleanupWorker performs secure data cleanup and verification.
//
// Responsibilities (issue #691):
//   - Verify completed deletion requests by checking data absence
//   - Clean up expired export files from storage
//   - Release expired legal holds
//   - Clean up orphaned compliance data
//   - Remove expired API keys and stale settings artifacts
//
// It should run daily during low-traffic hours — see Run, and
// DefaultCleanupInterval.
type CleanupWorker struct {
	complianceRepo          compliance.Repository
	settingsRepo            settings.Repository
	exportStorage           ExportFileDeleter // may be nil: export purge is then skipped, logged once per run
	discoverer              DataPresenceChecker
	holdManager             *retention.LegalHoldManager
	interval                time.Duration
	exportRetention         time.Duration
	apiKeyInactiveRetention time.Duration
	logger                  *log.Logger
	now                     func() time.Time
}

// NewCleanupWorker creates a cleanup worker. A non-positive interval
// defaults to DefaultCleanupInterval (24h, per the worker's own doc
// comment). exportStorage may be nil in environments with no file storage
// configured (expired-export purging is then skipped, not attempted and
// failed).
func NewCleanupWorker(
	complianceRepo compliance.Repository,
	settingsRepo settings.Repository,
	exportStorage ExportFileDeleter,
	interval time.Duration,
	logger *log.Logger,
) *CleanupWorker {
	if interval <= 0 {
		interval = DefaultCleanupInterval
	}
	if logger == nil {
		logger = log.Default()
	}
	return &CleanupWorker{
		complianceRepo:          complianceRepo,
		settingsRepo:            settingsRepo,
		exportStorage:           exportStorage,
		discoverer:              requests.NewDiscoverer(),
		holdManager:             retention.NewLegalHoldManager(nil),
		interval:                interval,
		exportRetention:         DefaultExportRetention,
		apiKeyInactiveRetention: DefaultAPIKeyInactiveRetention,
		logger:                  logger,
		now:                     func() time.Time { return time.Now().UTC() },
	}
}

// RunOnce executes a single cleanup cycle covering all five responsibilities
// and returns the resulting report. A step failing does not stop the others
// from running — each failure is appended to report.Errors instead — so one
// broken sub-system (e.g. storage unreachable) never blocks the rest of a
// cleanup pass. RunOnce only returns a non-nil error when the worker itself
// is unusable (a required repository is nil).
func (w *CleanupWorker) RunOnce(ctx context.Context) (*CleanupReport, error) {
	if w.complianceRepo == nil {
		return nil, errors.New("compliance repository is nil")
	}
	if w.settingsRepo == nil {
		return nil, errors.New("settings repository is nil")
	}

	report := &CleanupReport{RunAt: w.now()}

	w.verifyCompletedDeletions(ctx, report)
	w.purgeExpiredExports(ctx, report)
	w.releaseExpiredLegalHolds(ctx, report)
	w.removeOrphanedComplianceData(ctx, report)
	w.removeStaleAPIKeys(ctx, report)

	w.emitReport(ctx, report)

	return report, nil
}

// Run starts the daily cleanup loop and blocks until the context is
// cancelled.
func (w *CleanupWorker) Run(ctx context.Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}
	if w.complianceRepo == nil {
		return errors.New("compliance repository is nil")
	}
	if w.settingsRepo == nil {
		return errors.New("settings repository is nil")
	}

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.logger.Printf("cleanup worker started with interval: %v", w.interval)

	if _, err := w.RunOnce(ctx); err != nil {
		w.logger.Printf("cleanup worker: initial run failed: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			w.logger.Println("cleanup worker: context cancelled, shutting down")
			return ctx.Err()
		case <-ticker.C:
			if _, err := w.RunOnce(ctx); err != nil {
				w.logger.Printf("cleanup worker: run failed: %v", err)
			}
		}
	}
}

// verifyCompletedDeletions re-runs data discovery for every completed
// deletion request's categories and confirms nothing turned up — i.e. that
// the earlier deletion actually took. A category still showing records is
// recorded as a failed verification rather than acted on: this worker
// reports discrepancies for a human to investigate, it does not retry
// deletions on its own.
//
// Note: requests.Discoverer (the production DataPresenceChecker) is itself
// a stub — DiscoverUserData always returns RecordCount: 0 — so in
// production this currently always verifies cleanly. That is a pre-existing
// gap in the data-discovery subsystem, not something #691 asks this worker
// to fix; this method is written against the DataPresenceChecker interface
// so it starts reporting real discrepancies the moment that subsystem is
// wired to actual data sources, with no change needed here.
func (w *CleanupWorker) verifyCompletedDeletions(ctx context.Context, report *CleanupReport) {
	reqs, err := w.complianceRepo.ListCompletedRequests(ctx, compliance.RequestTypeDeletion, cleanupBatchSize)
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("listing completed deletion requests: %v", err))
		return
	}

	for _, req := range reqs {
		categories := extractDeletedCategories(req.DeletionSummary)
		locations, err := w.discoverer.DiscoverUserData(ctx, req.UserID, categories)
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("verifying deletion request %s: %v", req.ID, err))
			continue
		}

		clean := true
		for _, loc := range locations {
			if loc.RecordCount > 0 {
				clean = false
				report.FailedVerifications = append(report.FailedVerifications, fmt.Sprintf(
					"deletion request %s: %d record(s) remain in %s/%s", req.ID, loc.RecordCount, loc.Source, loc.Category,
				))
			}
		}
		if clean {
			report.VerifiedDeletions++
		}
	}
}

// extractDeletedCategories reads back the "deleted_categories" list that
// ComplianceRequestWorker.processOne stored in DeletionSummary. It round-
// trips through compliance.PrivacyRequest's JSON serializer, so by the time
// it is read from storage it is a map[string]any whose slice values have
// become []interface{} of strings rather than []string.
func extractDeletedCategories(summary map[string]any) []string {
	raw, ok := summary["deleted_categories"]
	if !ok {
		return nil
	}
	list, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(list))
	for _, v := range list {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// purgeExpiredExports deletes the storage file behind every completed
// export request older than w.exportRetention, then marks the request as
// purged (ExportPurgedAt) so it is never considered again. If no
// ExportFileDeleter is configured, this step is skipped entirely (logged
// once) rather than silently marking files "purged" that were never
// actually deleted from anywhere.
func (w *CleanupWorker) purgeExpiredExports(ctx context.Context, report *CleanupReport) {
	if w.exportStorage == nil {
		w.logger.Println("cleanup worker: no export storage configured, skipping expired export purge")
		return
	}

	reqs, err := w.complianceRepo.ListCompletedRequests(ctx, compliance.RequestTypeExport, cleanupBatchSize)
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("listing completed export requests: %v", err))
		return
	}

	cutoff := w.now().Add(-w.exportRetention)
	for i := range reqs {
		req := reqs[i]
		if req.ExportFileURL == "" || req.ExportPurgedAt != nil {
			continue
		}
		if req.CompletedAt == nil || req.CompletedAt.After(cutoff) {
			continue
		}

		if err := w.exportStorage.Delete(ctx, exportStorageKey(req.ExportFileURL)); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("deleting export file for request %s: %v", req.ID, err))
			continue
		}

		purgedAt := w.now()
		req.ExportPurgedAt = &purgedAt
		if err := w.complianceRepo.UpdatePrivacyRequest(ctx, &req); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("marking export request %s purged: %v", req.ID, err))
			continue
		}
		report.ExportsPurged++
	}
}

// exportStorageKey converts a PrivacyRequest.ExportFileURL (e.g.
// "/exports/<user>/<ts>.json", see requests.Exporter.Export) into the
// storage key ExportFileDeleter.Delete expects, which — like every other
// S3 key in this codebase (see documents.StorageService.UploadFile) — never
// has a leading slash.
func exportStorageKey(url string) string {
	return strings.TrimPrefix(url, "/")
}

// releaseExpiredLegalHolds releases every active legal hold whose
// ExpiresAt has passed. It sets Status to LegalHoldExpired rather than
// LegalHoldReleased — the status compliance.Service.ReleaseLegalHold uses
// for an admin's explicit action — so the audit trail can always tell an
// automatic, time-based release from a deliberate one.
func (w *CleanupWorker) releaseExpiredLegalHolds(ctx context.Context, report *CleanupReport) {
	holds, err := w.complianceRepo.ListActiveLegalHolds(ctx)
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("listing active legal holds: %v", err))
		return
	}

	const releasedBySystem = "system:cleanup_worker"
	for i := range holds {
		hold := holds[i]
		if !w.holdManager.IsExpired(hold.ExpiresAt) {
			continue
		}

		releasedAt := w.now()
		hold.Status = compliance.LegalHoldExpired
		hold.ReleasedAt = &releasedAt
		releasedBy := releasedBySystem
		hold.ReleasedBy = &releasedBy

		if err := w.complianceRepo.UpdateLegalHold(ctx, &hold); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("releasing legal hold %s: %v", hold.ID, err))
			continue
		}
		report.LegalHoldsReleased++
	}
}

// removeOrphanedComplianceData removes retention_schedules rows left behind
// by a hard-deleted retention policy (compliance.Repository.
// DeleteRetentionPolicy does not cascade to its schedules), since a
// schedule with no policy to action is never going anywhere on its own.
func (w *CleanupWorker) removeOrphanedComplianceData(ctx context.Context, report *CleanupReport) {
	removed, err := w.complianceRepo.DeleteOrphanedRetentionSchedules(ctx)
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("removing orphaned retention schedules: %v", err))
		return
	}
	report.OrphanedRecordsRemoved += int(removed)
}

// removeStaleAPIKeys deletes API keys that are either past their own
// ExpiresAt or have been inactive (revoked) for longer than
// w.apiKeyInactiveRetention.
func (w *CleanupWorker) removeStaleAPIKeys(ctx context.Context, report *CleanupReport) {
	removed, err := w.settingsRepo.DeleteStaleAPIKeys(ctx, w.now(), w.apiKeyInactiveRetention)
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("removing stale API keys: %v", err))
		return
	}
	report.APIKeysRemoved += int(removed)
}

// emitReport logs the run's report and persists it as a compliance audit
// log entry (ServiceName "cleanup_worker"), so "what got purged and when"
// survives for compliance audit purposes beyond process logs.
func (w *CleanupWorker) emitReport(ctx context.Context, report *CleanupReport) {
	reportJSON, err := json.Marshal(report)
	if err != nil {
		w.logger.Printf("cleanup worker: failed to marshal report: %v", err)
		return
	}
	w.logger.Printf("cleanup report: %s", reportJSON)

	var newValues map[string]any
	if err := json.Unmarshal(reportJSON, &newValues); err != nil {
		w.logger.Printf("cleanup worker: failed to prepare report for audit log: %v", err)
		return
	}

	auditEntry := &compliance.AuditLog{
		EventTime:        report.RunAt,
		EventType:        "data_cleanup",
		EventAction:      "cleanup_worker_run",
		ActorType:        compliance.ActorTypeSystem,
		SensitivityLevel: compliance.SensitivityNormal,
		ServiceName:      "cleanup_worker",
		NewValues:        newValues,
	}
	if err := w.complianceRepo.CreateAuditLog(ctx, auditEntry); err != nil {
		w.logger.Printf("cleanup worker: failed to persist cleanup report to audit log: %v", err)
	}
}
