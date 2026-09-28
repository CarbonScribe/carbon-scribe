package workers

import (
	"context"
	"errors"
	"log"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/inventory"
)

// InventoryCachePurgeWorker periodically deletes expired rows from
// project_credit_cache so stale on-chain credit data never accumulates
// indefinitely. It uses the idx_project_credit_cache_expires_at index via
// Repository.PurgeExpiredCache (DELETE WHERE expires_at <= NOW()).
//
// Run it alongside the API server on an interval at or below the inventory
// cache TTL (e.g. every cacheTTL) so expired rows are reaped promptly.
type InventoryCachePurgeWorker struct {
	repo     inventory.Repository
	interval time.Duration
	logger   *log.Logger
}

// NewInventoryCachePurgeWorker creates a purge worker. A non-positive interval
// defaults to 1 hour; pass the inventory cacheTTL to reap at TTL cadence.
func NewInventoryCachePurgeWorker(
	repo inventory.Repository,
	interval time.Duration,
	logger *log.Logger,
) *InventoryCachePurgeWorker {
	if interval <= 0 {
		interval = time.Hour
	}
	if logger == nil {
		logger = log.Default()
	}
	return &InventoryCachePurgeWorker{
		repo:     repo,
		interval: interval,
		logger:   logger,
	}
}

// PurgeOnce executes a single purge cycle and returns the number of rows removed.
func (w *InventoryCachePurgeWorker) PurgeOnce(ctx context.Context) (int64, error) {
	if w.repo == nil {
		return 0, errors.New("inventory repository is nil")
	}
	purged, err := w.repo.PurgeExpiredCache(ctx)
	if err != nil {
		return 0, err
	}
	if purged > 0 {
		w.logger.Printf("inventory cache purge: removed %d expired row(s)", purged)
	}
	return purged, nil
}

// Run starts the periodic purge loop and blocks until the context is cancelled.
func (w *InventoryCachePurgeWorker) Run(ctx context.Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}
	if w.repo == nil {
		return errors.New("inventory repository is nil")
	}

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.logger.Printf("inventory cache purge worker started with interval: %v\n", w.interval)

	// Reap once at startup so restarts promptly clear backlog.
	if _, err := w.PurgeOnce(ctx); err != nil {
		w.logger.Printf("inventory cache purge: initial purge failed: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			w.logger.Println("inventory cache purge worker: context cancelled, shutting down")
			return ctx.Err()
		case <-ticker.C:
			if _, err := w.PurgeOnce(ctx); err != nil {
				w.logger.Printf("inventory cache purge: purge cycle failed: %v", err)
			}
		}
	}
}
