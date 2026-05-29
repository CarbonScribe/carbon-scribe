package ingestion

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// SatelliteReading is a local copy of the reading type to avoid import cycles.
// The monitoring package embeds this via its own SatelliteReading type.
type SatelliteReading struct {
	ID          string
	ProjectID   string
	Source      string
	DataType    string
	NDVIMean    *float64
	NDVIMin     *float64
	NDVIMax     *float64
	BiomassTons *float64
	ImageryURL  string
	BoundingBox *BoundingBox
	Metadata    map[string]string
	CapturedAt  time.Time
	IngestedAt  time.Time
}

// BoundingBox is a geographic bounding box (WGS-84).
type BoundingBox struct {
	MinLat float64 `json:"min_lat"`
	MaxLat float64 `json:"max_lat"`
	MinLon float64 `json:"min_lon"`
	MaxLon float64 `json:"max_lon"`
}

// IngestRequest is the validated input for the satellite pipeline.
type IngestRequest struct {
	ProjectID   string
	Source      string
	DataType    string
	NDVIMean    *float64
	NDVIMin     *float64
	NDVIMax     *float64
	BiomassTons *float64
	ImageryURL  string
	BoundingBox *BoundingBox
	Metadata    map[string]string
	CapturedAt  time.Time
}

// Repository is the persistence contract used by the pipeline.
type Repository interface {
	Save(ctx context.Context, r *SatelliteReading) error
}

// allowedSources lists accepted satellite data providers.
var allowedSources = map[string]bool{
	"sentinel-2":  true,
	"planet-labs": true,
	"landsat-8":   true,
	"landsat-9":   true,
	"drone":       true,
}

// allowedDataTypes lists accepted data type identifiers.
var allowedDataTypes = map[string]bool{
	"NDVI":    true,
	"BIOMASS": true,
	"IMAGERY": true,
}

// SatellitePipeline validates and persists incoming satellite data.
type SatellitePipeline struct {
	repo Repository
}

// NewSatellitePipeline constructs a SatellitePipeline backed by the given repository.
func NewSatellitePipeline(repo Repository) *SatellitePipeline {
	return &SatellitePipeline{repo: repo}
}

// Ingest validates the request and persists a SatelliteReading.
func (p *SatellitePipeline) Ingest(ctx context.Context, req IngestRequest) (*SatelliteReading, error) {
	if err := validate(req); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	reading := &SatelliteReading{
		ID:          uuid.NewString(),
		ProjectID:   req.ProjectID,
		Source:      strings.ToLower(req.Source),
		DataType:    strings.ToUpper(req.DataType),
		NDVIMean:    req.NDVIMean,
		NDVIMin:     req.NDVIMin,
		NDVIMax:     req.NDVIMax,
		BiomassTons: req.BiomassTons,
		ImageryURL:  req.ImageryURL,
		BoundingBox: req.BoundingBox,
		Metadata:    req.Metadata,
		CapturedAt:  req.CapturedAt.UTC(),
		IngestedAt:  now,
	}

	if err := p.repo.Save(ctx, reading); err != nil {
		return nil, fmt.Errorf("satellite ingestion: persist failed: %w", err)
	}

	return reading, nil
}

// validate checks required fields, allowed values, and data-type-specific constraints.
func validate(req IngestRequest) error {
	if strings.TrimSpace(req.ProjectID) == "" {
		return errors.New("project_id is required")
	}
	if !allowedSources[strings.ToLower(req.Source)] {
		return fmt.Errorf("unsupported source %q; allowed: sentinel-2, planet-labs, landsat-8, landsat-9, drone", req.Source)
	}
	if !allowedDataTypes[strings.ToUpper(req.DataType)] {
		return fmt.Errorf("unsupported data_type %q; allowed: NDVI, BIOMASS, IMAGERY", req.DataType)
	}
	if req.CapturedAt.IsZero() {
		return errors.New("captured_at is required")
	}
	if req.CapturedAt.After(time.Now().UTC().Add(5 * time.Minute)) {
		return errors.New("captured_at cannot be in the future")
	}

	switch strings.ToUpper(req.DataType) {
	case "NDVI":
		if req.NDVIMean == nil {
			return errors.New("ndvi_mean is required for NDVI data type")
		}
		if *req.NDVIMean < -1 || *req.NDVIMean > 1 {
			return errors.New("ndvi_mean must be in range [-1, 1]")
		}
	case "BIOMASS":
		if req.BiomassTons == nil {
			return errors.New("biomass_tons is required for BIOMASS data type")
		}
		if *req.BiomassTons < 0 {
			return errors.New("biomass_tons must be non-negative")
		}
	case "IMAGERY":
		if strings.TrimSpace(req.ImageryURL) == "" {
			return errors.New("imagery_url is required for IMAGERY data type")
		}
	}

	return nil
}
