package geofencing

import "github.com/google/uuid"

type Rule struct {
	OnEnter         bool `json:"on_enter"`
	OnExit          bool `json:"on_exit"`
	OnProximity     bool `json:"on_proximity"`
	ProximityMeters int  `json:"proximity_meters"`
}

type Geofence struct {
	ID   uuid.UUID
	Name string
}
