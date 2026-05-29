package monitoring

import (
	"context"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// Repository defines persistence operations for satellite monitoring data.
type Repository interface {
	ingestion.Repository
	ListByProject(ctx context.Context, projectID string, limit int) ([]SatelliteReading, error)
}
