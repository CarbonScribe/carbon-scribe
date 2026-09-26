package geofencing

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestDetectBreachEntry(t *testing.T) {
	detector := NewDetector(time.Minute)
	geofence := &Geofence{
		ID:     uuid.New(),
		Name:   "restricted-zone",
		Geometry: []byte(`{"type":"Polygon","coordinates":[[[-0.1,-0.1],[-0.1,0.1],[0.1,0.1],[0.1,-0.1],[-0.1,-0.1]]]}`),
	}
	entity := EntityPosition{EntityID: "entity-1", EntityType: "project", Latitude: 0, Longitude: 0}
	previous := &EntityState{Inside: false, DistanceMeters: 5000}

	result, emitted, err := detector.DetectBreach(geofence, entity, previous, time.Now())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !emitted {
		t.Fatal("expected entry breach to be emitted")
	}
	if result == nil || result.BreachType != BreachTypeEntry {
		t.Fatalf("expected entry breach, got %#v", result)
	}
}

func TestDetectBreachExit(t *testing.T) {
	detector := NewDetector(time.Minute)
	geofence := &Geofence{
		ID:     uuid.New(),
		Name:   "restricted-zone",
		Geometry: []byte(`{"type":"Polygon","coordinates":[[[-0.1,-0.1],[-0.1,0.1],[0.1,0.1],[0.1,-0.1],[-0.1,-0.1]]]}`),
	}
	entity := EntityPosition{EntityID: "entity-2", EntityType: "project", Latitude: 0.2, Longitude: 0.2}
	previous := &EntityState{Inside: true, DistanceMeters: 10}

	result, emitted, err := detector.DetectBreach(geofence, entity, previous, time.Now())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !emitted {
		t.Fatal("expected exit breach to be emitted")
	}
	if result == nil || result.BreachType != BreachTypeExit {
		t.Fatalf("expected exit breach, got %#v", result)
	}
}

func TestDetectBreachProximity(t *testing.T) {
	detector := NewDetector(time.Minute)
	geofence := &Geofence{
		ID:     uuid.New(),
		Name:   "restricted-zone",
		Geometry: []byte(`{"type":"Polygon","coordinates":[[[-0.1,-0.1],[-0.1,0.1],[0.1,0.1],[0.1,-0.1],[-0.1,-0.1]]]}`),
		AlertRules: &Rule{ProximityMeters: 20000},
	}
	entity := EntityPosition{EntityID: "entity-3", EntityType: "project", Latitude: 0.101, Longitude: 0.0}
	previous := &EntityState{Inside: false, DistanceMeters: 2000}

	result, emitted, err := detector.DetectBreach(geofence, entity, previous, time.Now())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !emitted {
		t.Fatal("expected proximity breach to be emitted")
	}
	if result == nil || result.BreachType != BreachTypeProximity {
		t.Fatalf("expected proximity breach, got %#v", result)
	}
}

func TestDetectBreachInvalidPolygon(t *testing.T) {
	detector := NewDetector(time.Minute)
	geofence := &Geofence{ID: uuid.New(), Name: "broken", Geometry: []byte(`{"type":"Polygon","coordinates":[]}`)}
	entity := EntityPosition{EntityID: "entity-4", EntityType: "project", Latitude: 0, Longitude: 0}

	_, _, err := detector.DetectBreach(geofence, entity, nil, time.Now())
	if err == nil {
		t.Fatal("expected invalid polygon error")
	}
}

func TestDetectBreachBoundaryEdge(t *testing.T) {
	detector := NewDetector(time.Minute)
	geofence := &Geofence{ID: uuid.New(), Name: "boundary", Geometry: []byte(`{"type":"Polygon","coordinates":[[[-0.1,-0.1],[-0.1,0.1],[0.1,0.1],[0.1,-0.1],[-0.1,-0.1]]]}`)}
	entity := EntityPosition{EntityID: "entity-5", EntityType: "project", Latitude: 0.1, Longitude: 0.1}

	_, emitted, err := detector.DetectBreach(geofence, entity, nil, time.Now())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if emitted {
		t.Fatal("expected boundary point to be treated as inside without emitting a transition")
	}
}

func TestDetectorSuppressesDuplicateBreachesWhileCooldownActive(t *testing.T) {
	detector := NewDetector(10 * time.Minute)
	geofence := &Geofence{ID: uuid.New(), Name: "restricted-zone", Geometry: []byte(`{"type":"Polygon","coordinates":[[[-0.1,-0.1],[-0.1,0.1],[0.1,0.1],[0.1,-0.1],[-0.1,-0.1]]]}`)}
	entity := EntityPosition{EntityID: "entity-6", EntityType: "project", Latitude: 0, Longitude: 0}
	previous := &EntityState{Inside: false, DistanceMeters: 5000}

	_, emitted, err := detector.DetectBreach(geofence, entity, previous, time.Now())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !emitted {
		t.Fatal("expected first breach to emit")
	}

	_, emitted, err = detector.DetectBreach(geofence, entity, &EntityState{Inside: true, DistanceMeters: 10}, time.Now().Add(1*time.Minute))
	if err != nil {
		t.Fatalf("expected no error on duplicate evaluation, got %v", err)
	}
	if emitted {
		t.Fatal("expected duplicate breach to be suppressed while cooldown active")
	}
}
