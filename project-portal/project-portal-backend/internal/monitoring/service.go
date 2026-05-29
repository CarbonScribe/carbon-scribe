package monitoring

import (
	"context"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// Service orchestrates satellite data ingestion and retrieval.
type Service struct {
	pipeline *ingestion.SatellitePipeline
	repo     Repository
}

// NewService constructs a monitoring Service.
func NewService(repo Repository) *Service {
	return &Service{
		pipeline: ingestion.NewSatellitePipeline(repo),
		repo:     repo,
	}
}

// IngestSatellite validates and persists a satellite reading.
func (s *Service) IngestSatellite(ctx context.Context, req IngestSatelliteRequest) (*SatelliteReading, error) {
	ir := ingestion.IngestRequest{
		ProjectID:   req.ProjectID,
		Source:      req.Source,
		DataType:    req.DataType,
		NDVIMean:    req.NDVIMean,
		NDVIMin:     req.NDVIMin,
		NDVIMax:     req.NDVIMax,
		BiomassTons: req.BiomassTons,
		ImageryURL:  req.ImageryURL,
		BoundingBox: req.BoundingBox,
		Metadata:    req.Metadata,
		CapturedAt:  req.CapturedAt,
	}
	return s.pipeline.Ingest(ctx, ir)
}

// ListReadings returns the most recent satellite readings for a project.
func (s *Service) ListReadings(ctx context.Context, projectID string, limit int) ([]SatelliteReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListByProject(ctx, projectID, limit)
}
