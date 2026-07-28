package workers

import (
	"context"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	geofencepkg "carbon-scribe/project-portal/project-portal-backend/internal/geospatial/geofencing"
	"github.com/google/uuid"
)

// GeofenceRecord captures the geofence state needed by the worker.
type GeofenceRecord struct {
	ID         uuid.UUID
	Name       string
	Geometry   []byte
	AlertRules *geofencepkg.Rule
	Metadata   map[string]any
	IsActive   bool
	Priority   int
}

// EntityPositionRecord is the tracked entity position used during a worker cycle.
type EntityPositionRecord struct {
	EntityID   string
	EntityType string
	Latitude   float64
	Longitude  float64
	Timestamp  time.Time
}

// EntityStateRecord stores the last evaluated breach state for an entity/geofence pair.
type EntityStateRecord struct {
	EntityID       string
	GeofenceID     uuid.UUID
	Inside         bool
	DistanceMeters float64
	LastBreachAt   time.Time
	LastBreachType string
}

// BreachRecord persists the emitted breach and its notification state.
type BreachRecord struct {
	ID               uuid.UUID
	GeofenceID       uuid.UUID
	EntityID         string
	EntityType       string
	EventType        string
	Coordinates      [2]float64
	Timestamp        time.Time
	NotificationStatus string
	Metadata         map[string]any
}

// EventRecord describes the event emitted to the event bus.
type EventRecord struct {
	EventType   string
	GeofenceID  uuid.UUID
	EntityID    string
	EntityType  string
	Coordinates [2]float64
	Timestamp   time.Time
	Metadata    map[string]any
}

// GeofenceWorker executes geofence monitoring cycles.
type GeofenceWorker struct {
	interval time.Duration
	logger   *log.Logger
	repo     geofenceRepository
	detector *geofencepkg.Detector
	lastErr  error
	mu       sync.RWMutex
}

type geofenceRepository interface {
	ListActiveGeofences(ctx context.Context) ([]*GeofenceRecord, error)
	ListTrackedEntityPositions(ctx context.Context) ([]EntityPositionRecord, error)
	GetEntityState(ctx context.Context, entityID string, geofenceID uuid.UUID) (*EntityStateRecord, error)
	SaveEntityState(ctx context.Context, entityID string, geofenceID uuid.UUID, state *EntityStateRecord) error
	SaveBreachHistory(ctx context.Context, breach *BreachRecord) error
	EmitEvent(ctx context.Context, event *EventRecord) error
	Notify(ctx context.Context, breach *BreachRecord) error
}

type noopGeofenceRepository struct{}

func (n *noopGeofenceRepository) ListActiveGeofences(context.Context) ([]*GeofenceRecord, error) {
	return nil, nil
}

func (n *noopGeofenceRepository) ListTrackedEntityPositions(context.Context) ([]EntityPositionRecord, error) {
	return nil, nil
}

func (n *noopGeofenceRepository) GetEntityState(context.Context, string, uuid.UUID) (*EntityStateRecord, error) {
	return nil, nil
}

func (n *noopGeofenceRepository) SaveEntityState(context.Context, string, uuid.UUID, *EntityStateRecord) error {
	return nil
}

func (n *noopGeofenceRepository) SaveBreachHistory(context.Context, *BreachRecord) error {
	return nil
}

func (n *noopGeofenceRepository) EmitEvent(context.Context, *EventRecord) error {
	return nil
}

func (n *noopGeofenceRepository) Notify(context.Context, *BreachRecord) error {
	return nil
}

func NewGeofenceWorker(interval time.Duration, logger *log.Logger) *GeofenceWorker {
	if interval <= 0 {
		interval = time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}
	return &GeofenceWorker{interval: interval, logger: logger, repo: &noopGeofenceRepository{}, detector: geofencepkg.NewDetector(5 * time.Minute)}
}

func RunGeofenceWorker() {
	interval := getWorkerInterval("GEOFENCE_WORKER_INTERVAL", time.Minute)
	worker := NewGeofenceWorker(interval, log.Default())
	_ = worker.Start(context.Background())
}

func (w *GeofenceWorker) Start(ctx context.Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	w.logger.Printf("geofence worker started with interval: %v", w.interval)
	for {
		select {
		case <-ctx.Done():
			w.logger.Println("geofence worker: context cancelled, initiating graceful shutdown")
			return ctx.Err()
		case <-ticker.C:
			w.processCycle(ctx)
		}
	}
}

func (w *GeofenceWorker) processCycle(ctx context.Context) {
	w.mu.RLock()
	repo := w.repo
	detector := w.detector
	logger := w.logger
	w.mu.RUnlock()
	if repo == nil {
		repo = &noopGeofenceRepository{}
	}
	if detector == nil {
		detector = geofencepkg.NewDetector(5 * time.Minute)
	}
	if logger == nil {
		logger = log.Default()
	}

	logger.Println("geofence worker: processing cycle")
	geofences, err := repo.ListActiveGeofences(ctx)
	if err != nil {
		w.setLastErr(err)
		logger.Printf("geofence worker: failed to load geofences: %v", err)
		return
	}
	entities, err := repo.ListTrackedEntityPositions(ctx)
	if err != nil {
		w.setLastErr(err)
		logger.Printf("geofence worker: failed to load tracked entities: %v", err)
		return
	}

	logger.Printf("geofence worker: evaluating %d geofence(s) against %d entity position(s)", len(geofences), len(entities))
	for _, geofence := range geofences {
		if geofence == nil || !geofence.IsActive {
			continue
		}
		for _, entity := range entities {
			if entity.EntityID == "" {
				continue
			}
			prevState, err := repo.GetEntityState(ctx, entity.EntityID, geofence.ID)
			if err != nil {
				logger.Printf("geofence worker: failed to read entity state for %s/%s: %v", entity.EntityID, geofence.ID, err)
				continue
			}
			breach, emitted, err := detector.DetectBreach(geofence.ToGeofence(), entity.ToPosition(), prevState.ToEntityState(), time.Now().UTC())
			if err != nil {
				logger.Printf("geofence worker: failed to evaluate breach for %s/%s: %v", entity.EntityID, geofence.ID, err)
				continue
			}
			if !emitted || breach == nil {
				continue
			}
			state := &geofencepkg.EntityState{Inside: breach.Inside, DistanceMeters: breach.DistanceMeters, LastBreachAt: breach.Timestamp, LastBreachType: breach.BreachType}
			savedState := &EntityStateRecord{EntityID: breach.EntityID, GeofenceID: breach.GeofenceID, Inside: state.Inside, DistanceMeters: state.DistanceMeters, LastBreachAt: state.LastBreachAt, LastBreachType: state.LastBreachType}
			if err := repo.SaveEntityState(ctx, breach.EntityID, breach.GeofenceID, savedState); err != nil {
				logger.Printf("geofence worker: failed to persist entity state: %v", err)
			}
			breachRecord := &BreachRecord{ID: uuid.New(), GeofenceID: breach.GeofenceID, EntityID: breach.EntityID, EntityType: breach.EntityType, EventType: breachTypeToEventType(breach.BreachType), Coordinates: breach.Coordinates, Timestamp: breach.Timestamp, NotificationStatus: "pending", Metadata: map[string]any{"geofence_name": breach.GeofenceName, "inside": breach.Inside, "message": geofencepkg.BuildAlertMessage(breach.EntityID, breach.GeofenceName, breach.BreachType)}}
			if err := repo.SaveBreachHistory(ctx, breachRecord); err != nil {
				logger.Printf("geofence worker: failed to persist breach history: %v", err)
			}
			event := &EventRecord{EventType: breachRecord.EventType, GeofenceID: breachRecord.GeofenceID, EntityID: breachRecord.EntityID, EntityType: breachRecord.EntityType, Coordinates: breachRecord.Coordinates, Timestamp: breachRecord.Timestamp, Metadata: breachRecord.Metadata}
			if err := repo.EmitEvent(ctx, event); err != nil {
				logger.Printf("geofence worker: failed to emit breach event: %v", err)
			}
			if err := repo.Notify(ctx, breachRecord); err != nil {
				logger.Printf("geofence worker: failed to deliver breach notification: %v", err)
			}
		}
	}
	logger.Println("geofence worker: cycle completed")
}

func (w *GeofenceWorker) setLastErr(err error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.lastErr = err
}

func getWorkerInterval(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	if seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func breachTypeToEventType(breachType string) string {
	switch breachType {
	case geofencepkg.BreachTypeEntry:
		return "GeofenceEntered"
	case geofencepkg.BreachTypeExit:
		return "GeofenceExited"
	case geofencepkg.BreachTypeProximity:
		return "GeofenceProximity"
	default:
		return "GeofenceBreach"
	}
}

func (r *GeofenceRecord) ToGeofence() *geofencepkg.Geofence {
	return &geofencepkg.Geofence{ID: r.ID, Name: r.Name, Geometry: r.Geometry, AlertRules: r.AlertRules, Metadata: r.Metadata, IsActive: r.IsActive, Priority: r.Priority}
}

func (r EntityPositionRecord) ToPosition() geofencepkg.EntityPosition {
	return geofencepkg.EntityPosition{EntityID: r.EntityID, EntityType: r.EntityType, Latitude: r.Latitude, Longitude: r.Longitude, Timestamp: r.Timestamp}
}

func (r *EntityStateRecord) ToEntityState() *geofencepkg.EntityState {
	if r == nil {
		return nil
	}
	return &geofencepkg.EntityState{Inside: r.Inside, DistanceMeters: r.DistanceMeters, LastBreachAt: r.LastBreachAt, LastBreachType: r.LastBreachType}
}

func (r *EntityStateRecord) ToStateRecord(state *geofencepkg.EntityState) *EntityStateRecord {
	if r == nil {
		r = &EntityStateRecord{}
	}
	if state == nil {
		return &EntityStateRecord{EntityID: r.EntityID, GeofenceID: r.GeofenceID}
	}
	return &EntityStateRecord{EntityID: r.EntityID, GeofenceID: r.GeofenceID, Inside: state.Inside, DistanceMeters: state.DistanceMeters, LastBreachAt: state.LastBreachAt, LastBreachType: state.LastBreachType}
}
