package workers

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"
)

// SatelliteDataSyncWorker manages periodic synchronization of satellite data for active projects.
type SatelliteDataSyncWorker struct {
	interval time.Duration
	logger   *log.Logger
	mu       sync.RWMutex
}

// NewSatelliteDataSyncWorker creates a new satellite data sync worker.
// If interval is <= 0, defaults to 5 minutes for production.
func NewSatelliteDataSyncWorker(interval time.Duration, logger *log.Logger) *SatelliteDataSyncWorker {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}
	return &SatelliteDataSyncWorker{
		interval: interval,
		logger:   logger,
	}
}

// Start begins the satellite data sync loop and blocks until context is cancelled.
// Returns error if context is nil.
func (w *SatelliteDataSyncWorker) Start(ctx context.Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.logger.Printf("satellite data sync worker started with interval: %v\n", w.interval)

	for {
		select {
		case <-ctx.Done():
			w.logger.Println("satellite data sync worker: context cancelled, initiating graceful shutdown")
			return ctx.Err()

		case <-ticker.C:
			w.syncSatelliteData(ctx)
		}
	}
}

// syncSatelliteData evaluates active projects and syncs satellite data.
// Errors are isolated per project; one project failure does not crash the loop.
func (w *SatelliteDataSyncWorker) syncSatelliteData(ctx context.Context) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	w.logger.Println("satellite data sync worker: triggered sync cycle")

	// Mock: Retrieve active projects
	activeProjects := w.getActiveProjectsMock()
	if len(activeProjects) == 0 {
		w.logger.Println("satellite data sync worker: no active projects to sync")
		return
	}

	w.logger.Printf("satellite data sync worker: syncing %d projects\n", len(activeProjects))

	// Process each project independently to isolate errors
	for _, projectID := range activeProjects {
		if err := w.syncProjectData(ctx, projectID); err != nil {
			// Error is logged and isolated; loop continues
			w.logger.Printf("satellite data sync worker: error syncing project %s: %v (will retry on next cycle)\n", projectID, err)
		} else {
			w.logger.Printf("satellite data sync worker: successfully synced project %s\n", projectID)
		}
	}

	w.logger.Println("satellite data sync worker: sync cycle completed")
}

// syncProjectData syncs satellite data for a single project.
// This is a mock implementation; real logic would fetch from satellite APIs (e.g., Sentinel Hub).
func (w *SatelliteDataSyncWorker) syncProjectData(ctx context.Context, projectID string) error {
	// Simulate context check for graceful shutdown
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Mock: Simulate data fetch from satellite provider
	if err := w.fetchSatelliteDataMock(projectID); err != nil {
		return err
	}

	// Mock: Simulate NDVI processing
	if err := w.processNDVIMock(projectID); err != nil {
		return err
	}

	// Mock: Simulate persistence to database
	if err := w.persistSatelliteResultsMock(projectID); err != nil {
		return err
	}

	return nil
}

// getActiveProjectsMock returns a list of mock active project IDs.
// In production, this would query the database for projects with active monitoring.
func (w *SatelliteDataSyncWorker) getActiveProjectsMock() []string {
	return []string{
		"project-001",
		"project-002",
		"project-003",
	}
}

// fetchSatelliteDataMock simulates fetching satellite imagery from a remote provider.
// Returns error if projectID is empty or matches an error pattern for testing.
func (w *SatelliteDataSyncWorker) fetchSatelliteDataMock(projectID string) error {
	if projectID == "" {
		return errors.New("empty project id")
	}

	// Simulate successful fetch (in real implementation, calls Sentinel Hub, USGS, etc.)
	return nil
}

// processNDVIMock simulates NDVI calculation on fetched satellite bands.
// Returns error for certain mock project patterns to test error handling.
func (w *SatelliteDataSyncWorker) processNDVIMock(projectID string) error {
	if projectID == "error-project" {
		return errors.New("ndvi processing failed")
	}

	// Simulate successful NDVI computation
	return nil
}

// persistSatelliteResultsMock simulates storing computed NDVI and satellite data to the database.
// Returns error if database persistence fails for the given project.
func (w *SatelliteDataSyncWorker) persistSatelliteResultsMock(projectID string) error {
	// Simulate successful persistence
	return nil
}
