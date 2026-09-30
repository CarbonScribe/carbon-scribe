package monitoring

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// PostgresRepository implements Repository using a *sql.DB connection.
type PostgresRepository struct {
	db *sql.DB
	*PostgresMetricRepository
}

// NewPostgresRepository constructs a PostgresRepository.
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{
		db:                       db,
		PostgresMetricRepository: NewPostgresMetricRepository(db),
	}
}

// ============================================================================
// Satellite Methods
// ============================================================================

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

// ============================================================================
// Webhook Methods
// ============================================================================

// SaveWebhookReading inserts a WebhookReading into the webhook_readings table.
func (r *PostgresRepository) SaveWebhookReading(ctx context.Context, reading *ingestion.WebhookReading) error {
	metaJSON, err := json.Marshal(reading.Metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	var locationJSON []byte
	if reading.Location != nil {
		locationJSON, err = json.Marshal(reading.Location)
		if err != nil {
			return fmt.Errorf("marshal location: %w", err)
		}
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO webhook_readings
			(id, project_id, source, source_type, metric_name, metric_value, unit,
			 location, metadata, webhook_id, captured_at, ingested_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		reading.ID, reading.ProjectID, reading.Source, reading.SourceType,
		reading.MetricName, reading.MetricValue, reading.Unit,
		locationJSON, metaJSON, reading.WebhookID,
		reading.CapturedAt, reading.IngestedAt,
	)
	return err
}

// GetWebhookReadingByID retrieves a webhook reading by its webhook ID (for deduplication).
func (r *PostgresRepository) GetWebhookReadingByID(ctx context.Context, webhookID string) (*ingestion.WebhookReading, error) {
	var reading ingestion.WebhookReading
	var locationJSON, metaJSON []byte

	err := r.db.QueryRowContext(ctx, `
		SELECT id, project_id, source, source_type, metric_name, metric_value, unit,
		       location, metadata, webhook_id, captured_at, ingested_at
		FROM webhook_readings
		WHERE webhook_id = $1`, webhookID).Scan(
		&reading.ID, &reading.ProjectID, &reading.Source, &reading.SourceType,
		&reading.MetricName, &reading.MetricValue, &reading.Unit,
		&locationJSON, &metaJSON, &reading.WebhookID,
		&reading.CapturedAt, &reading.IngestedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if len(locationJSON) > 0 {
		reading.Location = &ingestion.Location{}
		_ = json.Unmarshal(locationJSON, reading.Location)
	}
	if len(metaJSON) > 0 {
		_ = json.Unmarshal(metaJSON, &reading.Metadata)
	}
	return &reading, nil
}

// ListWebhookReadings returns the most recent webhook readings for a project.
func (r *PostgresRepository) ListWebhookReadings(ctx context.Context, projectID string, limit int) ([]ingestion.WebhookReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, source, source_type, metric_name, metric_value, unit,
		       location, metadata, webhook_id, captured_at, ingested_at
		FROM webhook_readings
		WHERE project_id = $1
		ORDER BY captured_at DESC
		LIMIT $2`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWebhookReadings(rows)
}

// ListWebhookReadingsByMetric returns readings filtered by metric name.
func (r *PostgresRepository) ListWebhookReadingsByMetric(ctx context.Context, projectID, metricName string, limit int) ([]ingestion.WebhookReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, source, source_type, metric_name, metric_value, unit,
		       location, metadata, webhook_id, captured_at, ingested_at
		FROM webhook_readings
		WHERE project_id = $1 AND metric_name = $2
		ORDER BY captured_at DESC
		LIMIT $3`, projectID, metricName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWebhookReadings(rows)
}

// ListWebhookReadingsBySource returns readings filtered by source.
func (r *PostgresRepository) ListWebhookReadingsBySource(ctx context.Context, projectID, source string, limit int) ([]ingestion.WebhookReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, source, source_type, metric_name, metric_value, unit,
		       location, metadata, webhook_id, captured_at, ingested_at
		FROM webhook_readings
		WHERE project_id = $1 AND source = $2
		ORDER BY captured_at DESC
		LIMIT $3`, projectID, source, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWebhookReadings(rows)
}

// GetWebhookReadingsByTimeRange returns readings within a time range.
func (r *PostgresRepository) GetWebhookReadingsByTimeRange(ctx context.Context, projectID string, start, end time.Time) ([]ingestion.WebhookReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, source, source_type, metric_name, metric_value, unit,
		       location, metadata, webhook_id, captured_at, ingested_at
		FROM webhook_readings
		WHERE project_id = $1 AND captured_at BETWEEN $2 AND $3
		ORDER BY captured_at ASC`, projectID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWebhookReadings(rows)
}

// scanWebhookReadings is a helper to scan webhook readings from rows.
func scanWebhookReadings(rows *sql.Rows) ([]ingestion.WebhookReading, error) {
	var results []ingestion.WebhookReading
	for rows.Next() {
		var wr ingestion.WebhookReading
		var locationJSON, metaJSON []byte
		if err := rows.Scan(
			&wr.ID, &wr.ProjectID, &wr.Source, &wr.SourceType,
			&wr.MetricName, &wr.MetricValue, &wr.Unit,
			&locationJSON, &metaJSON, &wr.WebhookID,
			&wr.CapturedAt, &wr.IngestedAt,
		); err != nil {
			return nil, err
		}
		if len(locationJSON) > 0 {
			wr.Location = &ingestion.Location{}
			_ = json.Unmarshal(locationJSON, wr.Location)
		}
		if len(metaJSON) > 0 {
			_ = json.Unmarshal(metaJSON, &wr.Metadata)
		}
		results = append(results, wr)
	}
	return results, rows.Err()
}

// ============================================================================
// IoT Methods
// ============================================================================

// SaveIoTReading inserts an IoTReading into the iot_readings table.
func (r *PostgresRepository) SaveIoTReading(ctx context.Context, reading *ingestion.IoTReading) error {
	metaJSON, err := json.Marshal(reading.Metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	var locationJSON []byte
	if reading.Location != nil {
		locationJSON, err = json.Marshal(reading.Location)
		if err != nil {
			return fmt.Errorf("marshal location: %w", err)
		}
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO iot_readings
			(id, project_id, sensor_id, sensor_type, value, unit,
			 location, metadata, device_id, battery_level, signal_strength, captured_at, ingested_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		reading.ID, reading.ProjectID, reading.SensorID, reading.SensorType,
		reading.Value, reading.Unit,
		locationJSON, metaJSON, reading.DeviceID,
		reading.BatteryLevel, reading.SignalStrength,
		reading.CapturedAt, reading.IngestedAt,
	)
	return err
}

// GetIoTReadingsByProject returns the most recent IoT readings for a project.
func (r *PostgresRepository) GetIoTReadingsByProject(ctx context.Context, projectID string, limit int) ([]ingestion.IoTReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, sensor_id, sensor_type, value, unit,
		       location, metadata, device_id, battery_level, signal_strength, captured_at, ingested_at
		FROM iot_readings
		WHERE project_id = $1
		ORDER BY captured_at DESC
		LIMIT $2`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanIoTReadings(rows)
}

// GetIoTReadingsBySensor returns readings filtered by sensor ID.
func (r *PostgresRepository) GetIoTReadingsBySensor(ctx context.Context, projectID, sensorID string, limit int) ([]ingestion.IoTReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, sensor_id, sensor_type, value, unit,
		       location, metadata, device_id, battery_level, signal_strength, captured_at, ingested_at
		FROM iot_readings
		WHERE project_id = $1 AND sensor_id = $2
		ORDER BY captured_at DESC
		LIMIT $3`, projectID, sensorID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanIoTReadings(rows)
}

// GetIoTReadingsByType returns readings filtered by sensor type.
func (r *PostgresRepository) GetIoTReadingsByType(ctx context.Context, projectID, sensorType string, limit int) ([]ingestion.IoTReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, sensor_id, sensor_type, value, unit,
		       location, metadata, device_id, battery_level, signal_strength, captured_at, ingested_at
		FROM iot_readings
		WHERE project_id = $1 AND sensor_type = $2
		ORDER BY captured_at DESC
		LIMIT $3`, projectID, sensorType, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanIoTReadings(rows)
}

// GetIoTReadingsByTimeRange returns readings within a time range.
func (r *PostgresRepository) GetIoTReadingsByTimeRange(ctx context.Context, projectID string, start, end time.Time) ([]ingestion.IoTReading, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, project_id, sensor_id, sensor_type, value, unit,
		       location, metadata, device_id, battery_level, signal_strength, captured_at, ingested_at
		FROM iot_readings
		WHERE project_id = $1 AND captured_at BETWEEN $2 AND $3
		ORDER BY captured_at ASC`, projectID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanIoTReadings(rows)
}

// scanIoTReadings is a helper to scan IoT readings from rows.
func scanIoTReadings(rows *sql.Rows) ([]ingestion.IoTReading, error) {
	var results []ingestion.IoTReading
	for rows.Next() {
		var ir ingestion.IoTReading
		var locationJSON, metaJSON []byte
		if err := rows.Scan(
			&ir.ID, &ir.ProjectID, &ir.SensorID, &ir.SensorType,
			&ir.Value, &ir.Unit,
			&locationJSON, &metaJSON,
			&ir.DeviceID, &ir.BatteryLevel, &ir.SignalStrength,
			&ir.CapturedAt, &ir.IngestedAt,
		); err != nil {
			return nil, err
		}
		if len(locationJSON) > 0 {
			ir.Location = &ingestion.Location{}
			_ = json.Unmarshal(locationJSON, ir.Location)
		}
		if len(metaJSON) > 0 {
			_ = json.Unmarshal(metaJSON, &ir.Metadata)
		}
		results = append(results, ir)
	}
	return results, rows.Err()
}

// ============================================================================
// Health Check Methods
// ============================================================================

// SaveHealthCheck inserts a ServiceHealthCheck into the service_health_checks table.
func (r *PostgresRepository) SaveHealthCheck(ctx context.Context, check *ServiceHealthCheck) error {
	detailsJSON, err := json.Marshal(check.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO service_health_checks
			(id, service_name, check_type, status, latency_ms, error, details, checked_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		check.ID, check.ServiceName, check.CheckType, check.Status,
		check.LatencyMs, check.Error, detailsJSON, check.CheckedAt, check.CreatedAt,
	)
	return err
}

// SaveHealthCheckResult inserts a HealthCheckResult into the health_check_results table.
func (r *PostgresRepository) SaveHealthCheckResult(ctx context.Context, result *HealthCheckResult) error {
	detailsJSON, err := json.Marshal(result.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO health_check_results
			(id, check_id, service_name, status, latency_ms, error, details, checked_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		result.ID, result.CheckID, result.ServiceName, result.Status,
		result.LatencyMs, result.Error, detailsJSON, result.CheckedAt, result.CreatedAt,
	)
	return err
}

// GetHealthCheck retrieves a health check by ID.
func (r *PostgresRepository) GetHealthCheck(ctx context.Context, checkID string) (*ServiceHealthCheck, error) {
	var check ServiceHealthCheck
	var detailsJSON []byte

	err := r.db.QueryRowContext(ctx, `
		SELECT id, service_name, check_type, status, latency_ms, error, details, checked_at, created_at
		FROM service_health_checks
		WHERE id = $1`, checkID).Scan(
		&check.ID, &check.ServiceName, &check.CheckType, &check.Status,
		&check.LatencyMs, &check.Error, &detailsJSON, &check.CheckedAt, &check.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get health check: %w", err)
	}

	if len(detailsJSON) > 0 {
		_ = json.Unmarshal(detailsJSON, &check.Details)
	}
	return &check, nil
}

// GetHealthCheckResults retrieves health check results for a check ID.
func (r *PostgresRepository) GetHealthCheckResults(ctx context.Context, checkID string, limit int) ([]HealthCheckResult, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, check_id, service_name, status, latency_ms, error, details, checked_at, created_at
		FROM health_check_results
		WHERE check_id = $1
		ORDER BY checked_at DESC
		LIMIT $2`, checkID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanHealthCheckResults(rows)
}

// GetHealthChecksByService retrieves all health checks for a service.
func (r *PostgresRepository) GetHealthChecksByService(ctx context.Context, serviceName string) ([]ServiceHealthCheck, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, service_name, check_type, status, latency_ms, error, details, checked_at, created_at
		FROM service_health_checks
		WHERE service_name = $1`, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var checks []ServiceHealthCheck
	for rows.Next() {
		var check ServiceHealthCheck
		var detailsJSON []byte
		if err := rows.Scan(&check.ID, &check.ServiceName, &check.CheckType, &check.Status,
			&check.LatencyMs, &check.Error, &detailsJSON, &check.CheckedAt, &check.CreatedAt); err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			_ = json.Unmarshal(detailsJSON, &check.Details)
		}
		checks = append(checks, check)
	}
	return checks, rows.Err()
}

// GetHealthCheckResultsByTimeRange retrieves health check results within a time range.
func (r *PostgresRepository) GetHealthCheckResultsByTimeRange(ctx context.Context, serviceName string, start, end time.Time) ([]HealthCheckResult, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, check_id, service_name, status, latency_ms, error, details, checked_at, created_at
		FROM health_check_results
		WHERE service_name = $1 AND checked_at BETWEEN $2 AND $3
		ORDER BY checked_at ASC`, serviceName, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanHealthCheckResults(rows)
}

// GetLatestHealthCheckResult retrieves the latest health check result for a service.
func (r *PostgresRepository) GetLatestHealthCheckResult(ctx context.Context, serviceName string) (*HealthCheckResult, error) {
	var result HealthCheckResult
	var detailsJSON []byte

	err := r.db.QueryRowContext(ctx, `
		SELECT id, check_id, service_name, status, latency_ms, error, details, checked_at, created_at
		FROM health_check_results
		WHERE service_name = $1
		ORDER BY checked_at DESC
		LIMIT 1`, serviceName).Scan(
		&result.ID, &result.CheckID, &result.ServiceName, &result.Status,
		&result.LatencyMs, &result.Error, &detailsJSON, &result.CheckedAt, &result.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get latest health check: %w", err)
	}

	if len(detailsJSON) > 0 {
		_ = json.Unmarshal(detailsJSON, &result.Details)
	}
	return &result, nil
}

// scanHealthCheckResults is a helper to scan health check results from rows.
func scanHealthCheckResults(rows *sql.Rows) ([]HealthCheckResult, error) {
	var results []HealthCheckResult
	for rows.Next() {
		var r HealthCheckResult
		var detailsJSON []byte
		if err := rows.Scan(&r.ID, &r.CheckID, &r.ServiceName, &r.Status,
			&r.LatencyMs, &r.Error, &detailsJSON, &r.CheckedAt, &r.CreatedAt); err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			_ = json.Unmarshal(detailsJSON, &r.Details)
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// ============================================================================
// Alert Methods
// ============================================================================

// SaveAlert inserts a SystemAlert into the system_alerts table.
func (r *PostgresRepository) SaveAlert(ctx context.Context, alert *SystemAlert) error {
	detailsJSON, err := json.Marshal(alert.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO system_alerts
			(id, service_name, severity, status, title, message, details,
			 triggered_by, resolved_by, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		alert.ID, alert.ServiceName, alert.Severity, alert.Status,
		alert.Title, alert.Message, detailsJSON,
		alert.TriggeredBy, alert.ResolvedBy, alert.AcknowledgedBy,
		alert.AcknowledgedAt, alert.ResolvedAt, alert.CreatedAt, alert.UpdatedAt,
	)
	return err
}

// GetAlert retrieves an alert by ID.
func (r *PostgresRepository) GetAlert(ctx context.Context, alertID string) (*SystemAlert, error) {
	var alert SystemAlert
	var detailsJSON []byte
	var acknowledgedAt, resolvedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, `
		SELECT id, service_name, severity, status, title, message, details,
		       triggered_by, resolved_by, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at
		FROM system_alerts
		WHERE id = $1`, alertID).Scan(
		&alert.ID, &alert.ServiceName, &alert.Severity, &alert.Status,
		&alert.Title, &alert.Message, &detailsJSON,
		&alert.TriggeredBy, &alert.ResolvedBy, &alert.AcknowledgedBy,
		&acknowledgedAt, &resolvedAt, &alert.CreatedAt, &alert.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get alert: %w", err)
	}

	if acknowledgedAt.Valid {
		alert.AcknowledgedAt = &acknowledgedAt.Time
	}
	if resolvedAt.Valid {
		alert.ResolvedAt = &resolvedAt.Time
	}
	if len(detailsJSON) > 0 {
		_ = json.Unmarshal(detailsJSON, &alert.Details)
	}
	return &alert, nil
}

// ListAlerts retrieves alerts with optional filters.
func (r *PostgresRepository) ListAlerts(ctx context.Context, status AlertStatus, severity AlertSeverity, limit int) ([]SystemAlert, error) {
	query := `SELECT id, service_name, severity, status, title, message, details,
	          triggered_by, resolved_by, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at
	          FROM system_alerts WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}
	if severity != "" {
		query += fmt.Sprintf(" AND severity = $%d", argIndex)
		args = append(args, severity)
		argIndex++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIndex)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAlerts(rows)
}

// ListAlertsByService retrieves alerts for a specific service.
func (r *PostgresRepository) ListAlertsByService(ctx context.Context, serviceName string, limit int) ([]SystemAlert, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, service_name, severity, status, title, message, details,
		       triggered_by, resolved_by, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at
		FROM system_alerts
		WHERE service_name = $1
		ORDER BY created_at DESC
		LIMIT $2`, serviceName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAlerts(rows)
}

// UpdateAlert updates an alert.
func (r *PostgresRepository) UpdateAlert(ctx context.Context, alertID string, req UpdateAlertRequest) (*SystemAlert, error) {
	// First, get the current alert
	alert, err := r.GetAlert(ctx, alertID)
	if err != nil || alert == nil {
		return nil, err
	}

	// Update fields if provided
	if req.Status != "" {
		alert.Status = req.Status
	}
	if req.ResolvedBy != "" {
		alert.ResolvedBy = req.ResolvedBy
	}
	if req.Details != nil {
		alert.Details = req.Details
	}
	alert.UpdatedAt = time.Now()

	detailsJSON, err := json.Marshal(alert.Details)
	if err != nil {
		return nil, fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		UPDATE system_alerts
		SET status = $1, resolved_by = $2, details = $3, updated_at = $4,
		    resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
		WHERE id = $5`,
		alert.Status, alert.ResolvedBy, detailsJSON, alert.UpdatedAt, alertID)
	if err != nil {
		return nil, fmt.Errorf("update alert: %w", err)
	}

	return alert, nil
}

// AcknowledgeAlert acknowledges an alert.
func (r *PostgresRepository) AcknowledgeAlert(ctx context.Context, alertID, acknowledgedBy string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE system_alerts
		SET status = $1, acknowledged_by = $2, acknowledged_at = $3, updated_at = $3
		WHERE id = $4`,
		AlertStatusAcknowledged, acknowledgedBy, now, alertID)
	return err
}

// ResolveAlert resolves an alert.
func (r *PostgresRepository) ResolveAlert(ctx context.Context, alertID, resolvedBy string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE system_alerts
		SET status = $1, resolved_by = $2, resolved_at = $3, updated_at = $3
		WHERE id = $4`,
		AlertStatusResolved, resolvedBy, now, alertID)
	return err
}

// GetActiveAlerts retrieves all active alerts.
func (r *PostgresRepository) GetActiveAlerts(ctx context.Context) ([]SystemAlert, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, service_name, severity, status, title, message, details,
		       triggered_by, resolved_by, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at
		FROM system_alerts
		WHERE status IN ('active', 'acknowledged')
		ORDER BY severity DESC, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAlerts(rows)
}

// GetAlertCountsBySeverity returns alert counts grouped by severity.
func (r *PostgresRepository) GetAlertCountsBySeverity(ctx context.Context) (map[AlertSeverity]int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT severity, COUNT(*) as count
		FROM system_alerts
		WHERE status IN ('active', 'acknowledged')
		GROUP BY severity`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[AlertSeverity]int)
	for rows.Next() {
		var severity AlertSeverity
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			return nil, err
		}
		counts[severity] = count
	}
	return counts, rows.Err()
}

// scanAlerts is a helper to scan alerts from rows.
func scanAlerts(rows *sql.Rows) ([]SystemAlert, error) {
	var alerts []SystemAlert
	for rows.Next() {
		var a SystemAlert
		var detailsJSON []byte
		var acknowledgedAt, resolvedAt sql.NullTime
		if err := rows.Scan(&a.ID, &a.ServiceName, &a.Severity, &a.Status,
			&a.Title, &a.Message, &detailsJSON,
			&a.TriggeredBy, &a.ResolvedBy, &a.AcknowledgedBy,
			&acknowledgedAt, &resolvedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		if acknowledgedAt.Valid {
			a.AcknowledgedAt = &acknowledgedAt.Time
		}
		if resolvedAt.Valid {
			a.ResolvedAt = &resolvedAt.Time
		}
		if len(detailsJSON) > 0 {
			_ = json.Unmarshal(detailsJSON, &a.Details)
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

// ============================================================================
// Service Dependency Methods
// ============================================================================

// SaveServiceDependency inserts a ServiceDependency.
func (r *PostgresRepository) SaveServiceDependency(ctx context.Context, dependency *ServiceDependency) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO service_dependencies
			(id, service_name, depends_on, dependency_type, description, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		dependency.ID, dependency.ServiceName, dependency.DependsOn,
		dependency.DependencyType, dependency.Description, dependency.IsActive,
		dependency.CreatedAt, dependency.UpdatedAt)
	return err
}

// GetServiceDependency retrieves a service dependency by ID.
func (r *PostgresRepository) GetServiceDependency(ctx context.Context, dependencyID string) (*ServiceDependency, error) {
	var dep ServiceDependency
	err := r.db.QueryRowContext(ctx, `
		SELECT id, service_name, depends_on, dependency_type, description, is_active, created_at, updated_at
		FROM service_dependencies
		WHERE id = $1`, dependencyID).Scan(
		&dep.ID, &dep.ServiceName, &dep.DependsOn, &dep.DependencyType,
		&dep.Description, &dep.IsActive, &dep.CreatedAt, &dep.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get dependency: %w", err)
	}
	return &dep, nil
}

// ListServiceDependencies retrieves all dependencies for a service.
func (r *PostgresRepository) ListServiceDependencies(ctx context.Context, serviceName string) ([]ServiceDependency, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, service_name, depends_on, dependency_type, description, is_active, created_at, updated_at
		FROM service_dependencies
		WHERE service_name = $1
		ORDER BY dependency_type, created_at`, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deps []ServiceDependency
	for rows.Next() {
		var d ServiceDependency
		if err := rows.Scan(&d.ID, &d.ServiceName, &d.DependsOn, &d.DependencyType,
			&d.Description, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		deps = append(deps, d)
	}
	return deps, rows.Err()
}

// GetDependenciesByService retrieves services that depend on a given service.
func (r *PostgresRepository) GetDependenciesByService(ctx context.Context, serviceName string) ([]ServiceDependency, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, service_name, depends_on, dependency_type, description, is_active, created_at, updated_at
		FROM service_dependencies
		WHERE depends_on = $1
		ORDER BY dependency_type, created_at`, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deps []ServiceDependency
	for rows.Next() {
		var d ServiceDependency
		if err := rows.Scan(&d.ID, &d.ServiceName, &d.DependsOn, &d.DependencyType,
			&d.Description, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		deps = append(deps, d)
	}
	return deps, rows.Err()
}

// DeleteServiceDependency deletes a service dependency.
func (r *PostgresRepository) DeleteServiceDependency(ctx context.Context, dependencyID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM service_dependencies WHERE id = $1`, dependencyID)
	return err
}

// UpdateServiceDependency updates a service dependency's active status.
func (r *PostgresRepository) UpdateServiceDependency(ctx context.Context, dependencyID string, isActive bool) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE service_dependencies
		SET is_active = $1, updated_at = NOW()
		WHERE id = $2`, isActive, dependencyID)
	return err
}

// ============================================================================
// Status Snapshot Methods
// ============================================================================

// SaveStatusSnapshot inserts a SystemStatusSnapshot.
func (r *PostgresRepository) SaveStatusSnapshot(ctx context.Context, snapshot *SystemStatusSnapshot) error {
	servicesJSON, err := json.Marshal(snapshot.Services)
	if err != nil {
		return fmt.Errorf("marshal services: %w", err)
	}
	metadataJSON, err := json.Marshal(snapshot.Metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO system_status_snapshots
			(id, overall_status, services, active_alert_count, resolved_alert_count,
			 uptime_percent, latency_ms, error_rate, metadata, snapshot_time, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		snapshot.ID, snapshot.OverallStatus, servicesJSON,
		snapshot.ActiveAlertCount, snapshot.ResolvedAlertCount,
		snapshot.UptimePercent, snapshot.LatencyMs, snapshot.ErrorRate,
		metadataJSON, snapshot.SnapshotTime, snapshot.CreatedAt)
	return err
}

// GetStatusSnapshot retrieves a status snapshot by ID.
func (r *PostgresRepository) GetStatusSnapshot(ctx context.Context, snapshotID string) (*SystemStatusSnapshot, error) {
	var snapshot SystemStatusSnapshot
	var servicesJSON, metadataJSON []byte

	err := r.db.QueryRowContext(ctx, `
		SELECT id, overall_status, services, active_alert_count, resolved_alert_count,
		       uptime_percent, latency_ms, error_rate, metadata, snapshot_time, created_at
		FROM system_status_snapshots
		WHERE id = $1`, snapshotID).Scan(
		&snapshot.ID, &snapshot.OverallStatus, &servicesJSON,
		&snapshot.ActiveAlertCount, &snapshot.ResolvedAlertCount,
		&snapshot.UptimePercent, &snapshot.LatencyMs, &snapshot.ErrorRate,
		&metadataJSON, &snapshot.SnapshotTime, &snapshot.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get snapshot: %w", err)
	}

	if len(servicesJSON) > 0 {
		_ = json.Unmarshal(servicesJSON, &snapshot.Services)
	}
	if len(metadataJSON) > 0 {
		_ = json.Unmarshal(metadataJSON, &snapshot.Metadata)
	}
	return &snapshot, nil
}

// GetLatestStatusSnapshot retrieves the most recent status snapshot.
func (r *PostgresRepository) GetLatestStatusSnapshot(ctx context.Context) (*SystemStatusSnapshot, error) {
	var snapshot SystemStatusSnapshot
	var servicesJSON, metadataJSON []byte

	err := r.db.QueryRowContext(ctx, `
		SELECT id, overall_status, services, active_alert_count, resolved_alert_count,
		       uptime_percent, latency_ms, error_rate, metadata, snapshot_time, created_at
		FROM system_status_snapshots
		ORDER BY snapshot_time DESC
		LIMIT 1`).Scan(
		&snapshot.ID, &snapshot.OverallStatus, &servicesJSON,
		&snapshot.ActiveAlertCount, &snapshot.ResolvedAlertCount,
		&snapshot.UptimePercent, &snapshot.LatencyMs, &snapshot.ErrorRate,
		&metadataJSON, &snapshot.SnapshotTime, &snapshot.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get latest snapshot: %w", err)
	}

	if len(servicesJSON) > 0 {
		_ = json.Unmarshal(servicesJSON, &snapshot.Services)
	}
	if len(metadataJSON) > 0 {
		_ = json.Unmarshal(metadataJSON, &snapshot.Metadata)
	}
	return &snapshot, nil
}

// ListStatusSnapshots retrieves a list of status snapshots.
func (r *PostgresRepository) ListStatusSnapshots(ctx context.Context, limit int) ([]SystemStatusSnapshot, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, overall_status, services, active_alert_count, resolved_alert_count,
		       uptime_percent, latency_ms, error_rate, metadata, snapshot_time, created_at
		FROM system_status_snapshots
		ORDER BY snapshot_time DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanStatusSnapshots(rows)
}

// GetStatusSnapshotsByTimeRange retrieves status snapshots within a time range.
func (r *PostgresRepository) GetStatusSnapshotsByTimeRange(ctx context.Context, start, end time.Time) ([]SystemStatusSnapshot, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, overall_status, services, active_alert_count, resolved_alert_count,
		       uptime_percent, latency_ms, error_rate, metadata, snapshot_time, created_at
		FROM system_status_snapshots
		WHERE snapshot_time BETWEEN $1 AND $2
		ORDER BY snapshot_time ASC`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanStatusSnapshots(rows)
}

// GetSystemStatusSummary computes a summary of the current system status.
func (r *PostgresRepository) GetSystemStatusSummary(ctx context.Context) (*SystemStatusSummary, error) {
	// Get latest snapshot
	snapshot, err := r.GetLatestStatusSnapshot(ctx)
	if err != nil || snapshot == nil {
		return nil, err
	}

	// Get alert counts
	alertCounts, err := r.GetAlertCountsBySeverity(ctx)
	if err != nil {
		return nil, err
	}

	// Get health check results for services
	servicesQuery := `
		SELECT DISTINCT service_name
		FROM service_health_checks`

	rows, err := r.db.QueryContext(ctx, servicesQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []string
	for rows.Next() {
		var service string
		if err := rows.Scan(&service); err != nil {
			continue
		}
		services = append(services, service)
	}

	// Count healthy services
	healthyCount := 0
	degradedCount := 0
	unhealthyCount := 0
	unknownCount := 0

	for _, service := range services {
		latest, err := r.GetLatestHealthCheckResult(ctx, service)
		if err != nil || latest == nil {
			unknownCount++
			continue
		}
		switch latest.Status {
		case HealthCheckStatusHealthy:
			healthyCount++
		case HealthCheckStatusDegraded:
			degradedCount++
		case HealthCheckStatusUnhealthy:
			unhealthyCount++
		default:
			unknownCount++
		}
	}

	totalAlerts := 0
	for _, count := range alertCounts {
		totalAlerts += count
	}

	uptimePercent := 0.0
	if snapshot.UptimePercent != nil {
		uptimePercent = *snapshot.UptimePercent
	}
	latencyMs := 0.0
	if snapshot.LatencyMs != nil {
		latencyMs = *snapshot.LatencyMs
	}
	errorRate := 0.0
	if snapshot.ErrorRate != nil {
		errorRate = *snapshot.ErrorRate
	}

	return &SystemStatusSummary{
		OverallStatus:     snapshot.OverallStatus,
		TotalServices:     len(services),
		HealthyServices:   healthyCount,
		DegradedServices:  degradedCount,
		UnhealthyServices: unhealthyCount,
		UnknownServices:   unknownCount,
		ActiveAlerts:      totalAlerts,
		TotalAlerts:       totalAlerts,
		UptimePercent:     uptimePercent,
		AvgLatencyMs:      latencyMs,
		ErrorRate:         errorRate,
		Timestamp:         snapshot.SnapshotTime,
	}, nil
}

// scanStatusSnapshots is a helper to scan status snapshots from rows.
func scanStatusSnapshots(rows *sql.Rows) ([]SystemStatusSnapshot, error) {
	var snapshots []SystemStatusSnapshot
	for rows.Next() {
		var s SystemStatusSnapshot
		var servicesJSON, metadataJSON []byte
		if err := rows.Scan(&s.ID, &s.OverallStatus, &servicesJSON,
			&s.ActiveAlertCount, &s.ResolvedAlertCount,
			&s.UptimePercent, &s.LatencyMs, &s.ErrorRate,
			&metadataJSON, &s.SnapshotTime, &s.CreatedAt); err != nil {
			return nil, err
		}
		if len(servicesJSON) > 0 {
			_ = json.Unmarshal(servicesJSON, &s.Services)
		}
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &s.Metadata)
		}
		snapshots = append(snapshots, s)
	}
	return snapshots, rows.Err()
}

// ============================================================================
// Notification Delivery Log Methods
// ============================================================================

// SaveNotificationDeliveryLog inserts a notification delivery log entry.
func (r *PostgresRepository) SaveNotificationDeliveryLog(ctx context.Context, log *NotificationDeliveryLog) error {
	detailsJSON, err := json.Marshal(log.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO notification_delivery_logs
			(id, alert_id, rule_id, channel, status, attempt_count, error, error_code, details, sent_at, delivered_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		log.ID, log.AlertID, log.RuleID, log.Channel, log.Status,
		log.AttemptCount, log.Error, log.ErrorCode, detailsJSON,
		log.SentAt, log.DeliveredAt, log.CreatedAt, log.UpdatedAt)
	return err
}

// GetNotificationDeliveryLogs retrieves delivery logs for a specific alert.
func (r *PostgresRepository) GetNotificationDeliveryLogs(ctx context.Context, alertID string, limit int) ([]NotificationDeliveryLog, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, alert_id, rule_id, channel, status, attempt_count, error, error_code, details,
		       sent_at, delivered_at, created_at, updated_at
		FROM notification_delivery_logs
		WHERE alert_id = $1
		ORDER BY created_at DESC
		LIMIT $2`, alertID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanNotificationDeliveryLogs(rows)
}

// GetNotificationDeliveryLogsByRule retrieves delivery logs for a specific rule.
func (r *PostgresRepository) GetNotificationDeliveryLogsByRule(ctx context.Context, ruleID string, limit int) ([]NotificationDeliveryLog, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, alert_id, rule_id, channel, status, attempt_count, error, error_code, details,
		       sent_at, delivered_at, created_at, updated_at
		FROM notification_delivery_logs
		WHERE rule_id = $1
		ORDER BY created_at DESC
		LIMIT $2`, ruleID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanNotificationDeliveryLogs(rows)
}

// MarkNotificationDeliverySuccess marks a delivery log as successful.
func (r *PostgresRepository) MarkNotificationDeliverySuccess(ctx context.Context, logID string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE notification_delivery_logs
		SET status = $1, delivered_at = $2, updated_at = $2
		WHERE id = $3`,
		NotificationDeliveryStatusSuccess, now, logID)
	return err
}

// MarkNotificationDeliveryFailed marks a delivery log as failed.
func (r *PostgresRepository) MarkNotificationDeliveryFailed(ctx context.Context, logID string, errMsg string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE notification_delivery_logs
		SET status = $1, error = $2, updated_at = $3
		WHERE id = $4`,
		NotificationDeliveryStatusFailed, errMsg, now, logID)
	return err
}

// scanNotificationDeliveryLogs is a helper to scan notification delivery logs from rows.
func scanNotificationDeliveryLogs(rows *sql.Rows) ([]NotificationDeliveryLog, error) {
	var logs []NotificationDeliveryLog
	for rows.Next() {
		var log NotificationDeliveryLog
		var detailsJSON []byte
		var sentAt, deliveredAt sql.NullTime
		if err := rows.Scan(&log.ID, &log.AlertID, &log.RuleID, &log.Channel, &log.Status,
			&log.AttemptCount, &log.Error, &log.ErrorCode, &detailsJSON,
			&sentAt, &deliveredAt, &log.CreatedAt, &log.UpdatedAt); err != nil {
			return nil, err
		}
		if sentAt.Valid {
			log.SentAt = &sentAt.Time
		}
		if deliveredAt.Valid {
			log.DeliveredAt = &deliveredAt.Time
		}
		if len(detailsJSON) > 0 {
			_ = json.Unmarshal(detailsJSON, &log.Details)
		}
		logs = append(logs, log)
	}
	return logs, rows.Err()
}
