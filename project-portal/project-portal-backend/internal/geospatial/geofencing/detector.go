package geofencing

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

const (
	BreachTypeEntry     = "entry"
	BreachTypeExit      = "exit"
	BreachTypeProximity = "proximity"
)

type EntityPosition struct {
	EntityID     string
	EntityType   string
	Latitude     float64
	Longitude    float64
	Timestamp    time.Time
}

type EntityState struct {
	Inside         bool
	DistanceMeters float64
	LastBreachAt   time.Time
	LastBreachType string
}

type BreachResult struct {
	BreachType     string
	EntityID       string
	EntityType     string
	GeofenceID     uuid.UUID
	GeofenceName   string
	DistanceMeters float64
	Inside         bool
	Coordinates    [2]float64
	Timestamp      time.Time
}

type Detector struct {
	cooldown time.Duration
	states   map[string]EntityState
}

func NewDetector(cooldown time.Duration) *Detector {
	if cooldown <= 0 {
		cooldown = 5 * time.Minute
	}
	return &Detector{cooldown: cooldown, states: make(map[string]EntityState)}
}

func IsCrossing(previousDistance, currentDistance, threshold float64) bool {
	return previousDistance > threshold && currentDistance <= threshold
}

func (d *Detector) DetectBreach(geofence *Geofence, entity EntityPosition, previous *EntityState, observedAt time.Time) (*BreachResult, bool, error) {
	if geofence == nil {
		return nil, false, errors.New("geofence cannot be nil")
	}
	if entity.EntityID == "" {
		return nil, false, errors.New("entity id cannot be empty")
	}
	if !hasCoordinates(entity) {
		return nil, false, errors.New("entity coordinates missing")
	}
	if observedAt.IsZero() {
		observedAt = time.Now().UTC()
	}

	var state EntityState
	if previous != nil {
		state = *previous
	} else if existing, ok := d.states[d.stateKey(entity.EntityID, geofence.ID)]; ok {
		state = existing
	}

	polygon, err := parsePolygon(geofence.Geometry)
	if err != nil {
		return nil, false, err
	}

	inside := pointInPolygon([2]float64{entity.Longitude, entity.Latitude}, polygon)
	distance := distanceToPolygonMeters(entity.Latitude, entity.Longitude, polygon)
	threshold := defaultProximityThreshold(geofence)

	var breachType string
	switch {
	case previous != nil && previous.Inside != inside:
		if previous.Inside {
			breachType = BreachTypeExit
		} else {
			breachType = BreachTypeEntry
		}
	case previous != nil && threshold > 0 && !previous.Inside && distance <= float64(threshold):
		breachType = BreachTypeProximity
	case previous == nil && inside:
		breachType = BreachTypeEntry
	default:
		return &BreachResult{BreachType: "", EntityID: entity.EntityID, EntityType: entity.EntityType, GeofenceID: geofence.ID, GeofenceName: geofence.Name, DistanceMeters: distance, Inside: inside, Coordinates: [2]float64{entity.Longitude, entity.Latitude}, Timestamp: observedAt}, false, nil
	}

	if previous != nil && d.cooldownActive(previous, observedAt) {
		return &BreachResult{BreachType: breachType, EntityID: entity.EntityID, EntityType: entity.EntityType, GeofenceID: geofence.ID, GeofenceName: geofence.Name, DistanceMeters: distance, Inside: inside, Coordinates: [2]float64{entity.Longitude, entity.Latitude}, Timestamp: observedAt}, false, nil
	}

	state.Inside = inside
	state.DistanceMeters = distance
	state.LastBreachAt = observedAt
	state.LastBreachType = breachType
	d.states[d.stateKey(entity.EntityID, geofence.ID)] = state

	result := &BreachResult{BreachType: breachType, EntityID: entity.EntityID, EntityType: entity.EntityType, GeofenceID: geofence.ID, GeofenceName: geofence.Name, DistanceMeters: distance, Inside: inside, Coordinates: [2]float64{entity.Longitude, entity.Latitude}, Timestamp: observedAt}
	return result, true, nil
}

func (d *Detector) stateKey(entityID string, geofenceID uuid.UUID) string {
	return fmt.Sprintf("%s:%s", entityID, geofenceID.String())
}

func (d *Detector) cooldownActive(previous *EntityState, observedAt time.Time) bool {
	if previous == nil || previous.LastBreachAt.IsZero() || d.cooldown <= 0 {
		return false
	}
	return observedAt.Before(previous.LastBreachAt.Add(d.cooldown)) || observedAt.Equal(previous.LastBreachAt.Add(d.cooldown))
}

func hasCoordinates(entity EntityPosition) bool {
	if math.IsNaN(entity.Latitude) || math.IsNaN(entity.Longitude) {
		return false
	}
	return true
}

func defaultProximityThreshold(geofence *Geofence) int {
	if geofence == nil || geofence.AlertRules == nil {
		return 1000
	}
	if geofence.AlertRules.ProximityMeters > 0 {
		return geofence.AlertRules.ProximityMeters
	}
	return 1000
}

type geoJSON struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

type polygonGeometry struct {
	Rings [][][2]float64
}

func parsePolygon(raw []byte) (polygonGeometry, error) {
	if len(raw) == 0 {
		return polygonGeometry{}, errors.New("geometry cannot be empty")
	}
	var payload geoJSON
	if err := json.Unmarshal(raw, &payload); err != nil {
		return polygonGeometry{}, fmt.Errorf("unmarshal geometry: %w", err)
	}
	if payload.Type != "Polygon" {
		return polygonGeometry{}, fmt.Errorf("unsupported geometry type %q", payload.Type)
	}
	var rings [][][]float64
	if err := json.Unmarshal(payload.Coordinates, &rings); err != nil {
		return polygonGeometry{}, fmt.Errorf("decode polygon coordinates: %w", err)
	}
	if len(rings) == 0 || len(rings[0]) == 0 {
		return polygonGeometry{}, errors.New("polygon has no coordinates")
	}
	result := polygonGeometry{Rings: make([][] [2]float64, 0, len(rings))}
	for _, ring := range rings {
		points := make([][2]float64, 0, len(ring))
		for _, point := range ring {
			if len(point) != 2 {
				return polygonGeometry{}, errors.New("polygon coordinates must contain latitude/longitude pairs")
			}
			points = append(points, [2]float64{point[0], point[1]})
		}
		if len(points) < 4 {
			return polygonGeometry{}, errors.New("polygon must contain at least 4 points")
		}
		result.Rings = append(result.Rings, points)
	}
	return result, nil
}

func pointInPolygon(point [2]float64, polygon polygonGeometry) bool {
	if len(polygon.Rings) == 0 {
		return false
	}
	for _, ring := range polygon.Rings {
		if isPointInRing(point, ring) {
			return true
		}
	}
	return false
}

func isPointInRing(point [2]float64, ring [][2]float64) bool {
	inside := false
	for i, j := 0, len(ring)-1; i < len(ring); j, i = i, i+1 {
		xi, yi := ring[i][0], ring[i][1]
		xj, yj := ring[j][0], ring[j][1]
		intersects := ((yi > point[1]) != (yj > point[1])) && (point[0] < (xj-xi)*(point[1]-yi)/(yj-yi+1e-12)+xi)
		if intersects {
			inside = !inside
		}
	}
	return inside
}

func distanceToPolygonMeters(lat, lon float64, polygon polygonGeometry) float64 {
	if len(polygon.Rings) == 0 {
		return 0
	}
	closest := math.Inf(1)
	for _, ring := range polygon.Rings {
		for _, point := range ring {
			if d := haversineMeters(lat, lon, point[1], point[0]); d < closest {
				closest = d
			}
		}
	}
	if math.IsInf(closest, 0) {
		return 0
	}
	return closest
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0
	phi1 := lat1 * math.Pi / 180
	phi2 := lat2 * math.Pi / 180
	deltaPhi := (lat2 - lat1) * math.Pi / 180
	deltaLambda := (lon2 - lon1) * math.Pi / 180
	var a = math.Sin(deltaPhi/2)*math.Sin(deltaPhi/2) + math.Cos(phi1)*math.Cos(phi2)*math.Sin(deltaLambda/2)*math.Sin(deltaLambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}
