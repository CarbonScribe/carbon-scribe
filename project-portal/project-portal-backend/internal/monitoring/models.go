package monitoring

import (
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// Re-export ingestion types so callers only import this package.
type BoundingBox = ingestion.BoundingBox
type SatelliteReading = ingestion.SatelliteReading

// IngestSatelliteRequest is the API payload for POST /api/v1/monitoring/satellite.
type IngestSatelliteRequest struct {
	ProjectID   string            `json:"project_id" binding:"required"`
	Source      string            `json:"source" binding:"required"`
	DataType    string            `json:"data_type" binding:"required"`
	NDVIMean    *float64          `json:"ndvi_mean"`
	NDVIMin     *float64          `json:"ndvi_min"`
	NDVIMax     *float64          `json:"ndvi_max"`
	BiomassTons *float64          `json:"biomass_tons"`
	ImageryURL  string            `json:"imagery_url"`
	BoundingBox *BoundingBox      `json:"bounding_box"`
	Metadata    map[string]string `json:"metadata"`
	CapturedAt  time.Time         `json:"captured_at" binding:"required"`
}
