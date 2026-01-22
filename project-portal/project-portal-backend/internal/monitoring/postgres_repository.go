package monitoring

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PostgresRepository implements the Repository interface using PostgreSQL/TimescaleDB
type PostgresRepository struct {
	db *sqlx.DB
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(db *sqlx.DB) Repository {
	return &PostgresRepository{db: db}
}

// =============================================
// SATELLITE OBSERVATIONS
// =============================================

// CreateSatelliteObservation inserts a new satellite observation
func (r *PostgresRepository) CreateSatelliteObservation(ctx context.Context, obs *SatelliteObservation) error {
	query := `
		INSERT INTO satellite_observations (
			time, project_id, satellite_source, tile_id, ndvi, evi, ndwi, savi,
			biomass_kg_per_ha, cloud_coverage_percent, data_quality_score,
			geometry, raw_bands, metadata, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
			ST_GeomFromGeoJSON($12), $13, $14, $15
		)`

	_, err := r.db.ExecContext(ctx, query,
		obs.Time, obs.ProjectID, obs.SatelliteSource, obs.TileID,
		obs.NDVI, obs.EVI, obs.NDWI, obs.SAVI,
		obs.BiomassKgPerHa, obs.CloudCoveragePercent, obs.DataQualityScore,
		obs.Geometry, obs.RawBands, obs.Metadata, obs.CreatedAt,
	)

	return err
}

// CreateSatelliteObservationBatch inserts multiple satellite observations
func (r *PostgresRepository) CreateSatelliteObservationBatch(ctx context.Context, observations []SatelliteObservation) error {
	if len(observations) == 0 {
		return nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO satellite_observations (
			time, project_id, satellite_source, tile_id, ndvi, evi, ndwi, savi,
			biomass_kg_per_ha, cloud_coverage_percent, data_quality_score,
			geometry, raw_bands, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ST_GeomFromGeoJSON($12), $13, $14, $15)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, obs := range observations {
		_, err := stmt.ExecContext(ctx,
			obs.Time, obs.ProjectID, obs.SatelliteSource, obs.TileID,
			obs.NDVI, obs.EVI, obs.NDWI, obs.SAVI,
			obs.BiomassKgPerHa, obs.CloudCoveragePercent, obs.DataQualityScore,
			obs.Geometry, obs.RawBands, obs.Metadata, obs.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert observation: %w", err)
		}
	}

	return tx.Commit()
}

// GetSatelliteObservations retrieves satellite observations with filters
func (r *PostgresRepository) GetSatelliteObservations(ctx context.Context, query SatelliteObservationQuery) ([]SatelliteObservation, int64, error) {
	// Build dynamic query
	whereClause := []string{"project_id = $1", "time >= $2", "time <= $3"}
	args := []interface{}{query.ProjectID, query.StartTime, query.EndTime}
	argCount := 3

	if query.SatelliteSource != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("satellite_source = $%d", argCount))
		args = append(args, *query.SatelliteSource)
	}

	if query.MinQuality != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("data_quality_score >= $%d", argCount))
		args = append(args, *query.MinQuality)
	}

	if query.MaxCloudCover != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("cloud_coverage_percent <= $%d", argCount))
		args = append(args, *query.MaxCloudCover)
	}

	where := strings.Join(whereClause, " AND ")

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM satellite_observations WHERE %s", where)
	var total int64
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Get paginated results
	if query.Limit == 0 {
		query.Limit = 100
	}

	selectQuery := fmt.Sprintf(`
		SELECT time, project_id, satellite_source, tile_id, ndvi, evi, ndwi, savi,
			   biomass_kg_per_ha, cloud_coverage_percent, data_quality_score,
			   ST_AsGeoJSON(geometry) as geometry, raw_bands, metadata, created_at
		FROM satellite_observations
		WHERE %s
		ORDER BY time DESC
		LIMIT $%d OFFSET $%d
	`, where, argCount+1, argCount+2)

	args = append(args, query.Limit, query.Offset)

	var observations []SatelliteObservation
	if err := r.db.SelectContext(ctx, &observations, selectQuery, args...); err != nil {
		return nil, 0, err
	}

	return observations, total, nil
}

// GetLatestSatelliteObservation retrieves the most recent observation
func (r *PostgresRepository) GetLatestSatelliteObservation(ctx context.Context, projectID uuid.UUID, source string) (*SatelliteObservation, error) {
	query := `
		SELECT time, project_id, satellite_source, tile_id, ndvi, evi, ndwi, savi,
			   biomass_kg_per_ha, cloud_coverage_percent, data_quality_score,
			   ST_AsGeoJSON(geometry) as geometry, raw_bands, metadata, created_at
		FROM satellite_observations
		WHERE project_id = $1 AND satellite_source = $2
		ORDER BY time DESC
		LIMIT 1
	`

	var obs SatelliteObservation
	err := r.db.GetContext(ctx, &obs, query, projectID, source)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &obs, nil
}

// =============================================
// SENSOR READINGS
// =============================================

// CreateSensorReading inserts a new sensor reading
func (r *PostgresRepository) CreateSensorReading(ctx context.Context, reading *SensorReading) error {
	query := `
		INSERT INTO sensor_readings (
			time, project_id, sensor_id, sensor_type, value, unit,
			latitude, longitude, altitude_m, battery_level, signal_strength,
			data_quality, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := r.db.ExecContext(ctx, query,
		reading.Time, reading.ProjectID, reading.SensorID, reading.SensorType,
		reading.Value, reading.Unit, reading.Latitude, reading.Longitude,
		reading.AltitudeM, reading.BatteryLevel, reading.SignalStrength,
		reading.DataQuality, reading.Metadata, reading.CreatedAt,
	)

	return err
}

// CreateSensorReadingBatch inserts multiple sensor readings
func (r *PostgresRepository) CreateSensorReadingBatch(ctx context.Context, readings []SensorReading) error {
	if len(readings) == 0 {
		return nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO sensor_readings (
			time, project_id, sensor_id, sensor_type, value, unit,
			latitude, longitude, altitude_m, battery_level, signal_strength,
			data_quality, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, reading := range readings {
		_, err := stmt.ExecContext(ctx,
			reading.Time, reading.ProjectID, reading.SensorID, reading.SensorType,
			reading.Value, reading.Unit, reading.Latitude, reading.Longitude,
			reading.AltitudeM, reading.BatteryLevel, reading.SignalStrength,
			reading.DataQuality, reading.Metadata, reading.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert reading: %w", err)
		}
	}

	return tx.Commit()
}

// GetSensorReadings retrieves sensor readings for a specific sensor
func (r *PostgresRepository) GetSensorReadings(ctx context.Context, projectID uuid.UUID, sensorID string, start, end time.Time) ([]SensorReading, error) {
	query := `
		SELECT time, project_id, sensor_id, sensor_type, value, unit,
			   latitude, longitude, altitude_m, battery_level, signal_strength,
			   data_quality, metadata, created_at
		FROM sensor_readings
		WHERE project_id = $1 AND sensor_id = $2 AND time >= $3 AND time <= $4
		ORDER BY time DESC
	`

	var readings []SensorReading
	err := r.db.SelectContext(ctx, &readings, query, projectID, sensorID, start, end)
	return readings, err
}

// GetLatestSensorReading retrieves the most recent reading from a sensor
func (r *PostgresRepository) GetLatestSensorReading(ctx context.Context, sensorID string) (*SensorReading, error) {
	query := `
		SELECT time, project_id, sensor_id, sensor_type, value, unit,
			   latitude, longitude, altitude_m, battery_level, signal_strength,
			   data_quality, metadata, created_at
		FROM sensor_readings
		WHERE sensor_id = $1
		ORDER BY time DESC
		LIMIT 1
	`

	var reading SensorReading
	err := r.db.GetContext(ctx, &reading, query, sensorID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &reading, nil
}

// GetSensorReadingsByType retrieves all readings of a specific type for a project
func (r *PostgresRepository) GetSensorReadingsByType(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) ([]SensorReading, error) {
	query := `
		SELECT time, project_id, sensor_id, sensor_type, value, unit,
			   latitude, longitude, altitude_m, battery_level, signal_strength,
			   data_quality, metadata, created_at
		FROM sensor_readings
		WHERE project_id = $1 AND sensor_type = $2 AND time >= $3 AND time <= $4
		ORDER BY time DESC
	`

	var readings []SensorReading
	err := r.db.SelectContext(ctx, &readings, query, projectID, sensorType, start, end)
	return readings, err
}

// =============================================
// SENSORS
// =============================================

// CreateSensor creates a new sensor registration
func (r *PostgresRepository) CreateSensor(ctx context.Context, sensor *Sensor) error {
	query := `
		INSERT INTO sensors (
			id, sensor_id, project_id, name, sensor_type, manufacturer, model,
			firmware_version, installation_date, latitude, longitude, altitude_m,
			depth_cm, calibration_data, communication_protocol, reporting_interval_seconds,
			status, metadata, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
	`

	_, err := r.db.ExecContext(ctx, query,
		sensor.ID, sensor.SensorID, sensor.ProjectID, sensor.Name, sensor.SensorType,
		sensor.Manufacturer, sensor.Model, sensor.FirmwareVersion, sensor.InstallationDate,
		sensor.Latitude, sensor.Longitude, sensor.AltitudeM, sensor.DepthCm,
		sensor.CalibrationData, sensor.CommunicationProtocol, sensor.ReportingIntervalSeconds,
		sensor.Status, sensor.Metadata, sensor.CreatedAt, sensor.UpdatedAt,
	)

	return err
}

// GetSensorByID retrieves a sensor by its UUID
func (r *PostgresRepository) GetSensorByID(ctx context.Context, id uuid.UUID) (*Sensor, error) {
	query := `
		SELECT id, sensor_id, project_id, name, sensor_type, manufacturer, model,
			   firmware_version, installation_date, latitude, longitude, altitude_m,
			   depth_cm, calibration_data, communication_protocol, reporting_interval_seconds,
			   status, last_seen_at, metadata, created_at, updated_at
		FROM sensors
		WHERE id = $1
	`

	var sensor Sensor
	err := r.db.GetContext(ctx, &sensor, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &sensor, nil
}

// GetSensorBySensorID retrieves a sensor by its sensor_id
func (r *PostgresRepository) GetSensorBySensorID(ctx context.Context, sensorID string) (*Sensor, error) {
	query := `
		SELECT id, sensor_id, project_id, name, sensor_type, manufacturer, model,
			   firmware_version, installation_date, latitude, longitude, altitude_m,
			   depth_cm, calibration_data, communication_protocol, reporting_interval_seconds,
			   status, last_seen_at, metadata, created_at, updated_at
		FROM sensors
		WHERE sensor_id = $1
	`

	var sensor Sensor
	err := r.db.GetContext(ctx, &sensor, query, sensorID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &sensor, nil
}

// GetProjectSensors retrieves all sensors for a project
func (r *PostgresRepository) GetProjectSensors(ctx context.Context, projectID uuid.UUID) ([]Sensor, error) {
	query := `
		SELECT id, sensor_id, project_id, name, sensor_type, manufacturer, model,
			   firmware_version, installation_date, latitude, longitude, altitude_m,
			   depth_cm, calibration_data, communication_protocol, reporting_interval_seconds,
			   status, last_seen_at, metadata, created_at, updated_at
		FROM sensors
		WHERE project_id = $1
		ORDER BY created_at DESC
	`

	var sensors []Sensor
	err := r.db.SelectContext(ctx, &sensors, query, projectID)
	return sensors, err
}

// GetSensorsByType retrieves sensors of a specific type for a project
func (r *PostgresRepository) GetSensorsByType(ctx context.Context, projectID uuid.UUID, sensorType string) ([]Sensor, error) {
	query := `
		SELECT id, sensor_id, project_id, name, sensor_type, manufacturer, model,
			   firmware_version, installation_date, latitude, longitude, altitude_m,
			   depth_cm, calibration_data, communication_protocol, reporting_interval_seconds,
			   status, last_seen_at, metadata, created_at, updated_at
		FROM sensors
		WHERE project_id = $1 AND sensor_type = $2
		ORDER BY created_at DESC
	`

	var sensors []Sensor
	err := r.db.SelectContext(ctx, &sensors, query, projectID, sensorType)
	return sensors, err
}

// UpdateSensor updates a sensor's information
func (r *PostgresRepository) UpdateSensor(ctx context.Context, sensor *Sensor) error {
	query := `
		UPDATE sensors
		SET name = $1, sensor_type = $2, manufacturer = $3, model = $4,
			firmware_version = $5, latitude = $6, longitude = $7, altitude_m = $8,
			depth_cm = $9, calibration_data = $10, communication_protocol = $11,
			reporting_interval_seconds = $12, status = $13, metadata = $14, updated_at = $15
		WHERE id = $16
	`

	_, err := r.db.ExecContext(ctx, query,
		sensor.Name, sensor.SensorType, sensor.Manufacturer, sensor.Model,
		sensor.FirmwareVersion, sensor.Latitude, sensor.Longitude, sensor.AltitudeM,
		sensor.DepthCm, sensor.CalibrationData, sensor.CommunicationProtocol,
		sensor.ReportingIntervalSeconds, sensor.Status, sensor.Metadata,
		time.Now(), sensor.ID,
	)

	return err
}

// UpdateSensorLastSeen updates the last seen timestamp for a sensor
func (r *PostgresRepository) UpdateSensorLastSeen(ctx context.Context, sensorID string, lastSeen time.Time) error {
	query := `UPDATE sensors SET last_seen_at = $1, updated_at = $2 WHERE sensor_id = $3`
	_, err := r.db.ExecContext(ctx, query, lastSeen, time.Now(), sensorID)
	return err
}

// DeleteSensor deletes a sensor
func (r *PostgresRepository) DeleteSensor(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM sensors WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
