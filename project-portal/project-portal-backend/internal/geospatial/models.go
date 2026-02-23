package geospatial

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ProjectGeometry stores the canonical geometry for a project.
type ProjectGeometry struct {
	ID                     uuid.UUID       `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProjectID              uuid.UUID       `json:"project_id" gorm:"type:uuid;not null;uniqueIndex"`
	GeometryGeoJSON        json.RawMessage `json:"geometry_geojson,omitempty" gorm:"-"`
	CentroidGeoJSON        json.RawMessage `json:"centroid_geojson,omitempty" gorm:"-"`
	BoundingBoxGeoJSON     json.RawMessage `json:"bounding_box_geojson,omitempty" gorm:"-"`
	AreaHectares           float64         `json:"area_hectares"`
	PerimeterMeters        float64         `json:"perimeter_meters"`
	IsValid                bool            `json:"is_valid"`
	ValidationErrors       []string        `json:"validation_errors,omitempty" gorm:"type:text[]"`
	SimplificationTolerance *float64       `json:"simplification_tolerance,omitempty"`
	SourceType             string          `json:"source_type"`
	SourceFile             string          `json:"source_file,omitempty"`
	AccuracyScore          *float64        `json:"accuracy_score,omitempty"`
	Version                int             `json:"version"`
	PreviousVersionID      *uuid.UUID      `json:"previous_version_id,omitempty" gorm:"type:uuid"`
	CreatedAt              time.Time       `json:"created_at"`
	UpdatedAt              time.Time       `json:"updated_at"`
}

// UploadGeometryRequest uploads project geometry as RFC7946 GeoJSON.
type UploadGeometryRequest struct {
	GeoJSON               json.RawMessage `json:"geojson" binding:"required"`
	SimplificationTolerance *float64      `json:"simplification_tolerance,omitempty"`
	SourceType            string          `json:"source_type,omitempty"`
	SourceFile            string          `json:"source_file,omitempty"`
	AccuracyScore         *float64        `json:"accuracy_score,omitempty"`
}

type BoundaryResponse struct {
	ProjectID      uuid.UUID       `json:"project_id"`
	Format         string          `json:"format"`
	Geometry       json.RawMessage `json:"geometry,omitempty"`
	WKT            string          `json:"wkt,omitempty"`
	KML            string          `json:"kml,omitempty"`
	AreaHectares   float64         `json:"area_hectares"`
	PerimeterMeters float64        `json:"perimeter_meters"`
}

type NearbyProject struct {
	ProjectID      uuid.UUID `json:"project_id"`
	Name           string    `json:"name,omitempty"`
	DistanceMeters float64   `json:"distance_meters"`
	Centroid       string    `json:"centroid_geojson,omitempty"`
}

type NearbyQuery struct {
	Lat          float64 `form:"lat" binding:"required"`
	Lon          float64 `form:"lon" binding:"required"`
	RadiusMeters float64 `form:"radius_meters"`
	Limit        int     `form:"limit"`
}

type WithinQuery struct {
	MinLat    *float64 `form:"min_lat"`
	MinLon    *float64 `form:"min_lon"`
	MaxLat    *float64 `form:"max_lat"`
	MaxLon    *float64 `form:"max_lon"`
	GeoJSON   string   `form:"geojson"`
	Limit     int      `form:"limit"`
}

type IntersectRequest struct {
	GeoJSON json.RawMessage `json:"geojson" binding:"required"`
}

type IntersectResult struct {
	ProjectID        uuid.UUID `json:"project_id"`
	IntersectionArea float64   `json:"intersection_area_hectares"`
	Intersects       bool      `json:"intersects"`
}

type StaticMapRequest struct {
	Provider string  `form:"provider"`
	Width    int     `form:"width"`
	Height   int     `form:"height"`
	Zoom     float64 `form:"zoom"`
	Lat      float64 `form:"lat"`
	Lon      float64 `form:"lon"`
	Style    string  `form:"style"`
}

type Geofence struct {
	ID          uuid.UUID       `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Geometry    json.RawMessage `json:"geometry,omitempty" gorm:"-"`
	GeofenceType string         `json:"geofence_type"`
	AlertRules  json.RawMessage `json:"alert_rules"`
	IsActive    bool            `json:"is_active"`
	Priority    int             `json:"priority"`
	Metadata    json.RawMessage `json:"metadata"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type CreateGeofenceRequest struct {
	Name         string          `json:"name" binding:"required"`
	Description  string          `json:"description,omitempty"`
	GeoJSON      json.RawMessage `json:"geojson" binding:"required"`
	GeofenceType string          `json:"geofence_type" binding:"required"`
	AlertRules   json.RawMessage `json:"alert_rules,omitempty"`
	Priority     int             `json:"priority,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
}

type GeofenceCheckResult struct {
	GeofenceID     uuid.UUID `json:"geofence_id"`
	GeofenceName   string    `json:"geofence_name"`
	GeofenceType   string    `json:"geofence_type"`
	Intersects     bool      `json:"intersects"`
	DistanceMeters float64   `json:"distance_meters"`
	Priority       int       `json:"priority"`
}

type AdministrativeBoundary struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	AdminLevel  int       `json:"admin_level"`
	CountryCode string    `json:"country_code,omitempty"`
	Geometry    string    `json:"geometry_geojson"`
}

const (
	BoundaryFormatGeoJSON = "geojson"
	BoundaryFormatWKT     = "wkt"
	BoundaryFormatKML     = "kml"
)
