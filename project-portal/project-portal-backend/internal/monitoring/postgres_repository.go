package monitoring

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// PostgresRepository implements Repository using a *sql.DB connection.
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository constructs a PostgresRepository.
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Save inserts a SatelliteReading into the satellite_readings table.
func (r *PostgresRepository) Save(ctx context.Context, reading *ingestion.SatelliteReading) error {
	metaJSON, err := json.Marshal(reading.Metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	var bboxJSON []byte
	if reading.BoundingBox != nil {
		bboxJSON, err = json.Marshal(reading.BoundingBox)
		if err != nil {
			return fmt.Errorf("marshal bounding_box: %w", err)
		}
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO satellite_readings
			(id, project_id, source, data_type, ndvi_mean, ndvi_min, ndvi_max,
			 biomass_tons, imagery_url, bounding_box, metadata, captured_at, ingested_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		reading.ID, reading.ProjectID, reading.Source, reading.DataType,
		reading.NDVIMean, reading.NDVIMin, reading.NDVIMax,
		reading.BiomassTons, reading.ImageryURL, bboxJSON, metaJSON,
		reading.CapturedAt, reading.IngestedAt,
	)
	return err
}

// ListByProject returns the most recent satellite readings for a project.
func (r *PostgresRepository) ListByProject(ctx context.Context, projectID string, limit int) ([]ingestion.SatelliteReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, source, data_type, ndvi_mean, ndvi_min, ndvi_max,
		       biomass_tons, imagery_url, bounding_box, metadata, captured_at, ingested_at
		FROM satellite_readings
		WHERE project_id = $1
		ORDER BY captured_at DESC
		LIMIT $2`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ingestion.SatelliteReading
	for rows.Next() {
		var sr ingestion.SatelliteReading
		var bboxJSON, metaJSON []byte
		if err := rows.Scan(
			&sr.ID, &sr.ProjectID, &sr.Source, &sr.DataType,
			&sr.NDVIMean, &sr.NDVIMin, &sr.NDVIMax,
			&sr.BiomassTons, &sr.ImageryURL, &bboxJSON, &metaJSON,
			&sr.CapturedAt, &sr.IngestedAt,
		); err != nil {
			return nil, err
		}
		if len(bboxJSON) > 0 {
			sr.BoundingBox = &ingestion.BoundingBox{}
			_ = json.Unmarshal(bboxJSON, sr.BoundingBox)
		}
		if len(metaJSON) > 0 {
			_ = json.Unmarshal(metaJSON, &sr.Metadata)
		}
		results = append(results, sr)
	}
	return results, rows.Err()
}
