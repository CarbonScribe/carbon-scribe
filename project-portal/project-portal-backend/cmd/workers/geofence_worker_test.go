package workers

import (
	"context"
	"errors"
	"log"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestGeofenceWorkerStartStopsOnContextCancel(t *testing.T) {
	worker := NewGeofenceWorker(10*time.Millisecond, log.Default())
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	err := worker.Start(ctx)
	if err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
}

func TestGeofenceWorkerUsesDefaultInterval(t *testing.T) {
	worker := NewGeofenceWorker(0, nil)
	if worker.interval != 1*time.Minute {
		t.Fatalf("expected default interval of 1m, got %v", worker.interval)
	}
}

func TestGeofenceWorkerProcessCycleHandlesRepositoryFailures(t *testing.T) {
	worker := NewGeofenceWorker(time.Millisecond, log.Default())
	worker.repo = &stubGeofenceRepository{err: errors.New("boom")}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	worker.processCycle(ctx)
	if worker.lastErr == nil {
		t.Fatal("expected worker to record repository failure")
	}
}

type stubGeofenceRepository struct {
	err error
}

func (s *stubGeofenceRepository) ListActiveGeofences(ctx context.Context) ([]*GeofenceRecord, error) {
	return nil, s.err
}

func (s *stubGeofenceRepository) ListTrackedEntityPositions(ctx context.Context) ([]EntityPositionRecord, error) {
	return nil, s.err
}

func (s *stubGeofenceRepository) SaveBreachHistory(ctx context.Context, breach *BreachRecord) error {
	return s.err
}

func (s *stubGeofenceRepository) EmitEvent(ctx context.Context, event *EventRecord) error {
	return s.err
}

func (s *stubGeofenceRepository) Notify(ctx context.Context, breach *BreachRecord) error {
	return s.err
}

func (s *stubGeofenceRepository) GetEntityState(ctx context.Context, entityID string, geofenceID uuid.UUID) (*EntityStateRecord, error) {
	return nil, s.err
}

func (s *stubGeofenceRepository) SaveEntityState(ctx context.Context, entityID string, geofenceID uuid.UUID, state *EntityStateRecord) error {
	return s.err
}
