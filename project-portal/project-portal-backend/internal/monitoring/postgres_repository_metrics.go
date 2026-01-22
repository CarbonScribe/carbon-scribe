package monitoring

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// =============================================
// PROJECT METRICS
// =============================================

// CreateProjectMetric inserts a new project metric
func (r *PostgresRepository) CreateProjectMetric(ctx context.Context, metric *ProjectMetric) error {
	query := `
		INSERT INTO project_metrics (
			time, project_id, metric_name, value, aggregation_period,
			calculation_method, confidence_score, unit, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (time, project_id, metric_name, aggregation_period)
		DO UPDATE SET value = EXCLUDED.value,
					  calculation_method = EXCLUDED.calculation_method,
					  confidence_score = EXCLUDED.confidence_score,
					  metadata = EXCLUDED.metadata
	`

	_, err := r.db.ExecContext(ctx, query,
		metric.Time, metric.ProjectID, metric.MetricName, metric.Value,
		metric.AggregationPeriod, metric.CalculationMethod, metric.ConfidenceScore,
		metric.Unit, metric.Metadata, metric.CreatedAt,
	)

	return err
}

// CreateProjectMetricBatch inserts multiple project metrics
func (r *PostgresRepository) CreateProjectMetricBatch(ctx context.Context, metrics []ProjectMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO project_metrics (
			time, project_id, metric_name, value, aggregation_period,
			calculation_method, confidence_score, unit, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (time, project_id, metric_name, aggregation_period)
		DO UPDATE SET value = EXCLUDED.value
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, metric := range metrics {
		_, err := stmt.ExecContext(ctx,
			metric.Time, metric.ProjectID, metric.MetricName, metric.Value,
			metric.AggregationPeriod, metric.CalculationMethod, metric.ConfidenceScore,
			metric.Unit, metric.Metadata, metric.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert metric: %w", err)
		}
	}

	return tx.Commit()
}

// GetProjectMetrics retrieves project metrics with filters
func (r *PostgresRepository) GetProjectMetrics(ctx context.Context, query MetricsQuery) ([]ProjectMetric, int64, error) {
	whereClause := []string{"project_id = $1", "time >= $2", "time <= $3"}
	args := []interface{}{query.ProjectID, query.StartTime, query.EndTime}
	argCount := 3

	if query.MetricName != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("metric_name = $%d", argCount))
		args = append(args, *query.MetricName)
	}

	if query.AggregationPeriod != "" {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("aggregation_period = $%d", argCount))
		args = append(args, query.AggregationPeriod)
	}

	where := strings.Join(whereClause, " AND ")

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM project_metrics WHERE %s", where)
	var total int64
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Get paginated results
	if query.Limit == 0 {
		query.Limit = 1000
	}

	selectQuery := fmt.Sprintf(`
		SELECT time, project_id, metric_name, value, aggregation_period,
			   calculation_method, confidence_score, unit, metadata, created_at
		FROM project_metrics
		WHERE %s
		ORDER BY time DESC
		LIMIT $%d OFFSET $%d
	`, where, argCount+1, argCount+2)

	args = append(args, query.Limit, query.Offset)

	var metrics []ProjectMetric
	if err := r.db.SelectContext(ctx, &metrics, selectQuery, args...); err != nil {
		return nil, 0, err
	}

	return metrics, total, nil
}

// GetLatestMetricValue retrieves the most recent value for a metric
func (r *PostgresRepository) GetLatestMetricValue(ctx context.Context, projectID uuid.UUID, metricName, aggregationPeriod string) (*ProjectMetric, error) {
	query := `
		SELECT time, project_id, metric_name, value, aggregation_period,
			   calculation_method, confidence_score, unit, metadata, created_at
		FROM project_metrics
		WHERE project_id = $1 AND metric_name = $2 AND aggregation_period = $3
		ORDER BY time DESC
		LIMIT 1
	`

	var metric ProjectMetric
	err := r.db.GetContext(ctx, &metric, query, projectID, metricName, aggregationPeriod)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &metric, nil
}

// GetMetricTimeSeries retrieves time-series data for a specific metric
func (r *PostgresRepository) GetMetricTimeSeries(ctx context.Context, projectID uuid.UUID, metricName, aggregationPeriod string, start, end time.Time) ([]ProjectMetric, error) {
	query := `
		SELECT time, project_id, metric_name, value, aggregation_period,
			   calculation_method, confidence_score, unit, metadata, created_at
		FROM project_metrics
		WHERE project_id = $1 AND metric_name = $2 AND aggregation_period = $3
		  AND time >= $4 AND time <= $5
		ORDER BY time ASC
	`

	var metrics []ProjectMetric
	err := r.db.SelectContext(ctx, &metrics, query, projectID, metricName, aggregationPeriod, start, end)
	return metrics, err
}

// =============================================
// ALERT RULES
// =============================================

// CreateAlertRule creates a new alert rule
func (r *PostgresRepository) CreateAlertRule(ctx context.Context, rule *AlertRule) error {
	query := `
		INSERT INTO alert_rules (
			id, project_id, name, description, condition_type, metric_source,
			metric_name, sensor_type, condition_config, severity,
			notification_channels, cooldown_minutes, is_active, created_by,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err := r.db.ExecContext(ctx, query,
		rule.ID, rule.ProjectID, rule.Name, rule.Description, rule.ConditionType,
		rule.MetricSource, rule.MetricName, rule.SensorType, rule.ConditionConfig,
		rule.Severity, rule.NotificationChannels, rule.CooldownMinutes,
		rule.IsActive, rule.CreatedBy, rule.CreatedAt, rule.UpdatedAt,
	)

	return err
}

// GetAlertRuleByID retrieves an alert rule by ID
func (r *PostgresRepository) GetAlertRuleByID(ctx context.Context, id uuid.UUID) (*AlertRule, error) {
	query := `
		SELECT id, project_id, name, description, condition_type, metric_source,
			   metric_name, sensor_type, condition_config, severity,
			   notification_channels, cooldown_minutes, is_active, created_by,
			   created_at, updated_at
		FROM alert_rules
		WHERE id = $1
	`

	var rule AlertRule
	err := r.db.GetContext(ctx, &rule, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &rule, nil
}

// GetActiveAlertRules retrieves all active alert rules (optionally filtered by project)
func (r *PostgresRepository) GetActiveAlertRules(ctx context.Context, projectID *uuid.UUID) ([]AlertRule, error) {
	var query string
	var args []interface{}

	if projectID != nil {
		query = `
			SELECT id, project_id, name, description, condition_type, metric_source,
				   metric_name, sensor_type, condition_config, severity,
				   notification_channels, cooldown_minutes, is_active, created_by,
				   created_at, updated_at
			FROM alert_rules
			WHERE is_active = true AND (project_id = $1 OR project_id IS NULL)
			ORDER BY severity DESC, created_at ASC
		`
		args = append(args, *projectID)
	} else {
		query = `
			SELECT id, project_id, name, description, condition_type, metric_source,
				   metric_name, sensor_type, condition_config, severity,
				   notification_channels, cooldown_minutes, is_active, created_by,
				   created_at, updated_at
			FROM alert_rules
			WHERE is_active = true
			ORDER BY severity DESC, created_at ASC
		`
	}

	var rules []AlertRule
	err := r.db.SelectContext(ctx, &rules, query, args...)
	return rules, err
}

// GetProjectAlertRules retrieves all alert rules for a project
func (r *PostgresRepository) GetProjectAlertRules(ctx context.Context, projectID uuid.UUID) ([]AlertRule, error) {
	query := `
		SELECT id, project_id, name, description, condition_type, metric_source,
			   metric_name, sensor_type, condition_config, severity,
			   notification_channels, cooldown_minutes, is_active, created_by,
			   created_at, updated_at
		FROM alert_rules
		WHERE project_id = $1
		ORDER BY created_at DESC
	`

	var rules []AlertRule
	err := r.db.SelectContext(ctx, &rules, query, projectID)
	return rules, err
}

// UpdateAlertRule updates an alert rule
func (r *PostgresRepository) UpdateAlertRule(ctx context.Context, rule *AlertRule) error {
	query := `
		UPDATE alert_rules
		SET name = $1, description = $2, condition_type = $3, metric_source = $4,
			metric_name = $5, sensor_type = $6, condition_config = $7, severity = $8,
			notification_channels = $9, cooldown_minutes = $10, is_active = $11,
			updated_at = $12
		WHERE id = $13
	`

	_, err := r.db.ExecContext(ctx, query,
		rule.Name, rule.Description, rule.ConditionType, rule.MetricSource,
		rule.MetricName, rule.SensorType, rule.ConditionConfig, rule.Severity,
		rule.NotificationChannels, rule.CooldownMinutes, rule.IsActive,
		time.Now(), rule.ID,
	)

	return err
}

// DeleteAlertRule deletes an alert rule
func (r *PostgresRepository) DeleteAlertRule(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM alert_rules WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// =============================================
// ALERTS
// =============================================

// CreateAlert creates a new alert
func (r *PostgresRepository) CreateAlert(ctx context.Context, alert *Alert) error {
	query := `
		INSERT INTO alerts (
			id, rule_id, project_id, trigger_time, severity, title, message,
			details, status, notification_sent, notification_attempts,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := r.db.ExecContext(ctx, query,
		alert.ID, alert.RuleID, alert.ProjectID, alert.TriggerTime, alert.Severity,
		alert.Title, alert.Message, alert.Details, alert.Status,
		alert.NotificationSent, alert.NotificationAttempts,
		alert.CreatedAt, alert.UpdatedAt,
	)

	return err
}

// GetAlertByID retrieves an alert by ID
func (r *PostgresRepository) GetAlertByID(ctx context.Context, id uuid.UUID) (*Alert, error) {
	query := `
		SELECT id, rule_id, project_id, trigger_time, resolved_time, severity,
			   title, message, details, status, acknowledged_by, acknowledged_at,
			   resolved_by, resolution_notes, notification_sent, notification_attempts,
			   created_at, updated_at
		FROM alerts
		WHERE id = $1
	`

	var alert Alert
	err := r.db.GetContext(ctx, &alert, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &alert, nil
}

// GetAlerts retrieves alerts with filters
func (r *PostgresRepository) GetAlerts(ctx context.Context, query AlertQuery) ([]Alert, int64, error) {
	whereClause := []string{}
	args := []interface{}{}
	argCount := 0

	if query.ProjectID != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("project_id = $%d", argCount))
		args = append(args, *query.ProjectID)
	}

	if query.Status != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("status = $%d", argCount))
		args = append(args, *query.Status)
	}

	if query.Severity != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("severity = $%d", argCount))
		args = append(args, *query.Severity)
	}

	if query.StartTime != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("trigger_time >= $%d", argCount))
		args = append(args, *query.StartTime)
	}

	if query.EndTime != nil {
		argCount++
		whereClause = append(whereClause, fmt.Sprintf("trigger_time <= $%d", argCount))
		args = append(args, *query.EndTime)
	}

	where := ""
	if len(whereClause) > 0 {
		where = "WHERE " + strings.Join(whereClause, " AND ")
	}

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM alerts %s", where)
	var total int64
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Get paginated results
	if query.Limit == 0 {
		query.Limit = 100
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, rule_id, project_id, trigger_time, resolved_time, severity,
			   title, message, details, status, acknowledged_by, acknowledged_at,
			   resolved_by, resolution_notes, notification_sent, notification_attempts,
			   created_at, updated_at
		FROM alerts
		%s
		ORDER BY trigger_time DESC
		LIMIT $%d OFFSET $%d
	`, where, argCount+1, argCount+2)

	args = append(args, query.Limit, query.Offset)

	var alerts []Alert
	if err := r.db.SelectContext(ctx, &alerts, selectQuery, args...); err != nil {
		return nil, 0, err
	}

	return alerts, total, nil
}

// GetActiveProjectAlerts retrieves all active alerts for a project
func (r *PostgresRepository) GetActiveProjectAlerts(ctx context.Context, projectID uuid.UUID) ([]Alert, error) {
	query := `
		SELECT id, rule_id, project_id, trigger_time, resolved_time, severity,
			   title, message, details, status, acknowledged_by, acknowledged_at,
			   resolved_by, resolution_notes, notification_sent, notification_attempts,
			   created_at, updated_at
		FROM alerts
		WHERE project_id = $1 AND status = 'active'
		ORDER BY severity DESC, trigger_time DESC
	`

	var alerts []Alert
	err := r.db.SelectContext(ctx, &alerts, query, projectID)
	return alerts, err
}

// AcknowledgeAlert marks an alert as acknowledged
func (r *PostgresRepository) AcknowledgeAlert(ctx context.Context, alertID, userID uuid.UUID) error {
	query := `
		UPDATE alerts
		SET status = 'acknowledged',
			acknowledged_by = $1,
			acknowledged_at = $2,
			updated_at = $3
		WHERE id = $4
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, userID, now, now, alertID)
	return err
}

// ResolveAlert marks an alert as resolved
func (r *PostgresRepository) ResolveAlert(ctx context.Context, alertID, userID uuid.UUID, notes string) error {
	query := `
		UPDATE alerts
		SET status = 'resolved',
			resolved_time = $1,
			resolved_by = $2,
			resolution_notes = $3,
			updated_at = $4
		WHERE id = $5
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, now, userID, notes, now, alertID)
	return err
}

// UpdateAlert updates an alert
func (r *PostgresRepository) UpdateAlert(ctx context.Context, alert *Alert) error {
	query := `
		UPDATE alerts
		SET status = $1, acknowledged_by = $2, acknowledged_at = $3,
			resolved_by = $4, resolved_time = $5, resolution_notes = $6,
			notification_sent = $7, notification_attempts = $8, updated_at = $9
		WHERE id = $10
	`

	_, err := r.db.ExecContext(ctx, query,
		alert.Status, alert.AcknowledgedBy, alert.AcknowledgedAt,
		alert.ResolvedBy, alert.ResolvedTime, alert.ResolutionNotes,
		alert.NotificationSent, alert.NotificationAttempts, time.Now(), alert.ID,
	)

	return err
}

// CheckAlertCooldown checks if an alert is in cooldown period
func (r *PostgresRepository) CheckAlertCooldown(ctx context.Context, ruleID, projectID uuid.UUID, cooldownMinutes int) (bool, error) {
	query := `SELECT is_alert_in_cooldown($1, $2, $3)`

	var inCooldown bool
	err := r.db.GetContext(ctx, &inCooldown, query, ruleID, projectID, cooldownMinutes)
	return inCooldown, err
}

// =============================================
// AGGREGATIONS AND ANALYTICS
// =============================================

// GetHourlySensorAggregates retrieves hourly aggregated sensor data
func (r *PostgresRepository) GetHourlySensorAggregates(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) ([]SensorAggregate, error) {
	query := `
		SELECT bucket, project_id, sensor_id, sensor_type,
			   avg_value, min_value, max_value, stddev_value, reading_count
		FROM sensor_readings_hourly
		WHERE project_id = $1 AND sensor_type = $2 AND bucket >= $3 AND bucket <= $4
		ORDER BY bucket ASC
	`

	var aggregates []SensorAggregate
	err := r.db.SelectContext(ctx, &aggregates, query, projectID, sensorType, start, end)
	return aggregates, err
}

// GetDailySatelliteAggregates retrieves daily aggregated satellite data
func (r *PostgresRepository) GetDailySatelliteAggregates(ctx context.Context, projectID uuid.UUID, source string, start, end time.Time) ([]SatelliteAggregate, error) {
	query := `
		SELECT bucket, project_id, satellite_source,
			   avg_ndvi, max_ndvi, min_ndvi, avg_biomass,
			   avg_cloud_coverage, observation_count
		FROM satellite_observations_daily
		WHERE project_id = $1 AND satellite_source = $2 AND bucket >= $3 AND bucket <= $4
		ORDER BY bucket ASC
	`

	var aggregates []SatelliteAggregate
	err := r.db.SelectContext(ctx, &aggregates, query, projectID, source, start, end)
	return aggregates, err
}

// CalculateAverageNDVI calculates average NDVI for a project over a time period
func (r *PostgresRepository) CalculateAverageNDVI(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error) {
	query := `
		SELECT AVG(ndvi) 
		FROM satellite_observations
		WHERE project_id = $1 AND time >= $2 AND time <= $3 
		  AND ndvi IS NOT NULL AND data_quality_score > 0.5
	`

	var avgNDVI sql.NullFloat64
	err := r.db.GetContext(ctx, &avgNDVI, query, projectID, start, end)
	if err != nil {
		return 0, err
	}

	if !avgNDVI.Valid {
		return 0, nil
	}

	return avgNDVI.Float64, nil
}

// CalculateAverageBiomass calculates average biomass for a project over a time period
func (r *PostgresRepository) CalculateAverageBiomass(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error) {
	query := `
		SELECT AVG(biomass_kg_per_ha)
		FROM satellite_observations
		WHERE project_id = $1 AND time >= $2 AND time <= $3
		  AND biomass_kg_per_ha IS NOT NULL AND data_quality_score > 0.5
	`

	var avgBiomass sql.NullFloat64
	err := r.db.GetContext(ctx, &avgBiomass, query, projectID, start, end)
	if err != nil {
		return 0, err
	}

	if !avgBiomass.Valid {
		return 0, nil
	}

	return avgBiomass.Float64, nil
}
