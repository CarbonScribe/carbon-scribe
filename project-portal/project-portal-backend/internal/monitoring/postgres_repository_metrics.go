package monitoring

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// MetricRepository defines the interface for system metrics persistence and querying.
type MetricRepository interface {
	// SaveMetric stores a single system metric
	SaveMetric(ctx context.Context, metric *SystemMetric) error

	// SaveMetricsBatch stores multiple metrics in a single transaction
	SaveMetricsBatch(ctx context.Context, metrics []SystemMetric) error

	// QueryMetrics retrieves metrics by name, time range, and service labels
	QueryMetrics(ctx context.Context, req MetricQueryRequest) ([]SystemMetric, error)

	// GetMetricAggregation computes aggregates (avg, min, max, p95, p99, count) over a time window
	GetMetricAggregation(ctx context.Context, req AggregationRequest) (*MetricAggregationResult, error)

	// GetMetricRate computes the rate of change for a metric over a time window
	GetMetricRate(ctx context.Context, req RateRequest) (*RateResult, error)

	// GetLatestMetric retrieves the most recent metric for a given name and service
	GetLatestMetric(ctx context.Context, metricName, service string) (*SystemMetric, error)

	// GetMetricLabels returns distinct label combinations for a metric
	GetMetricLabels(ctx context.Context, metricName string) ([]map[string]string, error)

	// CleanupOldMetrics removes metrics older than the retention period
	CleanupOldMetrics(ctx context.Context, retentionDays int) (int64, error)
}

// SystemMetric represents a single system performance metric
type SystemMetric struct {
	ID         string
	MetricName string
	Value      float64
	Unit       string
	Service    string
	Labels     map[string]string
	Timestamp  time.Time
	CreatedAt  time.Time
}

// MetricQueryRequest defines filters for querying metrics
type MetricQueryRequest struct {
	MetricName string
	Service    string
	Labels     map[string]string
	StartTime  time.Time
	EndTime    time.Time
	Limit      int
	Offset     int
	OrderBy    string // "timestamp", "value"
	OrderDir   string // "ASC", "DESC"
}

// AggregationRequest defines parameters for aggregation queries
type AggregationRequest struct {
	MetricName   string
	Service      string
	Labels       map[string]string
	StartTime    time.Time
	EndTime      time.Time
	Interval     string   // "1m", "5m", "1h", "1d"
	Aggregations []string // "avg", "min", "max", "p95", "p99", "count", "sum"
}

// MetricAggregationResult contains aggregated metric values
type MetricAggregationResult struct {
	MetricName   string
	Service      string
	Labels       map[string]string
	Interval     string
	Aggregations map[string]float64
	DataPoints   []AggregationDataPoint
}

// AggregationDataPoint represents a single aggregation data point
type AggregationDataPoint struct {
	Timestamp time.Time
	Value     float64
}

// RateRequest defines parameters for rate calculations
type RateRequest struct {
	MetricName string
	Service    string
	Labels     map[string]string
	StartTime  time.Time
	EndTime    time.Time
	Interval   string // "1m", "5m", "1h"
}

// RateResult contains rate calculation results
type RateResult struct {
	MetricName string
	Service    string
	Rate       float64
	TimeWindow time.Duration
	DataPoints []RateDataPoint
}

// RateDataPoint represents a single rate data point
type RateDataPoint struct {
	Timestamp time.Time
	Value     float64
	Rate      float64
}

// PostgresMetricRepository implements MetricRepository using PostgreSQL/TimescaleDB
type PostgresMetricRepository struct {
	db *sql.DB
}

// NewPostgresMetricRepository creates a new PostgresMetricRepository
func NewPostgresMetricRepository(db *sql.DB) *PostgresMetricRepository {
	return &PostgresMetricRepository{db: db}
}

// SaveMetric stores a single system metric
func (r *PostgresMetricRepository) SaveMetric(ctx context.Context, metric *SystemMetric) error {
	labelsJSON, err := json.Marshal(metric.Labels)
	if err != nil {
		return fmt.Errorf("marshal labels: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO system_metrics
			(id, metric_name, value, unit, service, labels, time, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		metric.ID, metric.MetricName, metric.Value, metric.Unit,
		metric.Service, labelsJSON, metric.Timestamp, metric.CreatedAt,
	)
	return err
}

// SaveMetricsBatch stores multiple metrics in a single transaction
func (r *PostgresMetricRepository) SaveMetricsBatch(ctx context.Context, metrics []SystemMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO system_metrics
			(id, metric_name, value, unit, service, labels, time, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`)
	if err != nil {
		return fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, metric := range metrics {
		labelsJSON, err := json.Marshal(metric.Labels)
		if err != nil {
			return fmt.Errorf("marshal labels: %w", err)
		}

		_, err = stmt.ExecContext(ctx,
			metric.ID, metric.MetricName, metric.Value, metric.Unit,
			metric.Service, labelsJSON, metric.Timestamp, metric.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("execute insert: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// QueryMetrics retrieves metrics by name, time range, and service labels
func (r *PostgresMetricRepository) QueryMetrics(ctx context.Context, req MetricQueryRequest) ([]SystemMetric, error) {
	query := `
		SELECT id, metric_name, value, unit, service, labels, time, created_at
		FROM system_metrics
		WHERE metric_name = $1
			AND time >= $2
			AND time <= $3
	`

	args := []interface{}{req.MetricName, req.StartTime, req.EndTime}
	argIndex := 4

	if req.Service != "" {
		query += fmt.Sprintf(" AND service = $%d", argIndex)
		args = append(args, req.Service)
		argIndex++
	}

	// Add label filters
	for key, value := range req.Labels {
		query += fmt.Sprintf(" AND labels->>'%s' = $%d", key, argIndex)
		args = append(args, value)
		argIndex++
	}

	if req.OrderBy != "" {
		orderDir := "DESC"
		if req.OrderDir == "ASC" {
			orderDir = "ASC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", req.OrderBy, orderDir)
	}

	if req.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, req.Limit)
		argIndex++

		if req.Offset > 0 {
			query += fmt.Sprintf(" OFFSET $%d", argIndex)
			args = append(args, req.Offset)
			argIndex++
		}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	var metrics []SystemMetric
	for rows.Next() {
		var m SystemMetric
		var labelsJSON []byte
		if err := rows.Scan(&m.ID, &m.MetricName, &m.Value, &m.Unit,
			&m.Service, &labelsJSON, &m.Timestamp, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		if len(labelsJSON) > 0 {
			_ = json.Unmarshal(labelsJSON, &m.Labels)
		}
		metrics = append(metrics, m)
	}

	return metrics, rows.Err()
}

// GetMetricAggregation computes aggregates over a time window
func (r *PostgresMetricRepository) GetMetricAggregation(ctx context.Context, req AggregationRequest) (*MetricAggregationResult, error) {
	// Build aggregation fields
	aggFields := []string{}
	for _, agg := range req.Aggregations {
		switch agg {
		case "avg":
			aggFields = append(aggFields, "AVG(value) as avg")
		case "min":
			aggFields = append(aggFields, "MIN(value) as min")
		case "max":
			aggFields = append(aggFields, "MAX(value) as max")
		case "sum":
			aggFields = append(aggFields, "SUM(value) as sum")
		case "count":
			aggFields = append(aggFields, "COUNT(*) as count")
		case "p95":
			aggFields = append(aggFields, "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95")
		case "p99":
			aggFields = append(aggFields, "PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99")
		}
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM system_metrics
		WHERE metric_name = $1
			AND time >= $2
			AND time <= $3
	`, strings.Join(aggFields, ", "))

	args := []interface{}{req.MetricName, req.StartTime, req.EndTime}
	argIndex := 4

	if req.Service != "" {
		query += fmt.Sprintf(" AND service = $%d", argIndex)
		args = append(args, req.Service)
		argIndex++
	}

	for key, value := range req.Labels {
		query += fmt.Sprintf(" AND labels->>'%s' = $%d", key, argIndex)
		args = append(args, value)
		argIndex++
	}

	var result MetricAggregationResult
	result.MetricName = req.MetricName
	result.Service = req.Service
	result.Labels = req.Labels
	result.Interval = req.Interval
	result.Aggregations = make(map[string]float64)

	row := r.db.QueryRowContext(ctx, query, args...)
	var scanArgs []interface{}
	for _, agg := range req.Aggregations {
		var val sql.NullFloat64
		scanArgs = append(scanArgs, &val)
		result.Aggregations[agg] = 0
	}

	if err := row.Scan(scanArgs...); err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("aggregate query: %w", err)
	}

	// Populate aggregations from scanned values
	for i, agg := range req.Aggregations {
		if val, ok := scanArgs[i].(*sql.NullFloat64); ok && val.Valid {
			result.Aggregations[agg] = val.Float64
		}
	}

	// If interval is specified, also get time-series data points
	if req.Interval != "" {
		interval := req.Interval
		// Remove trailing 's' if present for time_bucket
		if strings.HasSuffix(interval, "s") && len(interval) > 1 {
			interval = interval[:len(interval)-1]
		}

		dataQuery := fmt.Sprintf(`
			SELECT time_bucket('%s', time) as bucket,
			       AVG(value) as avg_value
			FROM system_metrics
			WHERE metric_name = $1
				AND time >= $2
				AND time <= $3
			GROUP BY bucket
			ORDER BY bucket ASC
		`, req.Interval)

		rows, err := r.db.QueryContext(ctx, dataQuery, req.MetricName, req.StartTime, req.EndTime)
		if err != nil {
			return &result, nil // Return aggregations without data points on error
		}
		defer rows.Close()

		for rows.Next() {
			var dp AggregationDataPoint
			if err := rows.Scan(&dp.Timestamp, &dp.Value); err != nil {
				continue
			}
			result.DataPoints = append(result.DataPoints, dp)
		}
	}

	return &result, nil
}

// GetMetricRate computes the rate of change for a metric over a time window
func (r *PostgresMetricRepository) GetMetricRate(ctx context.Context, req RateRequest) (*RateResult, error) {
	query := `
		SELECT time, value
		FROM system_metrics
		WHERE metric_name = $1
			AND service = $2
			AND time >= $3
			AND time <= $4
		ORDER BY time ASC
	`

	args := []interface{}{req.MetricName, req.Service, req.StartTime, req.EndTime}
	argIndex := 5

	for key, value := range req.Labels {
		query += fmt.Sprintf(" AND labels->>'%s' = $%d", key, argIndex)
		args = append(args, value)
		argIndex++
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("rate query: %w", err)
	}
	defer rows.Close()

	var points []RateDataPoint
	// var prevValue float64
	// var prevTime time.Time

	for rows.Next() {
		var dp RateDataPoint
		if err := rows.Scan(&dp.Timestamp, &dp.Value); err != nil {
			continue
		}
		points = append(points, dp)
	}

	if len(points) < 2 {
		return &RateResult{
			MetricName: req.MetricName,
			Service:    req.Service,
			Rate:       0,
			TimeWindow: req.EndTime.Sub(req.StartTime),
			DataPoints: points,
		}, nil
	}

	// Calculate rate using linear regression or simple start/end
	firstValue := points[0].Value
	lastValue := points[len(points)-1].Value
	timeDiff := points[len(points)-1].Timestamp.Sub(points[0].Timestamp).Seconds()

	var rate float64
	if timeDiff > 0 {
		rate = (lastValue - firstValue) / timeDiff
	}

	return &RateResult{
		MetricName: req.MetricName,
		Service:    req.Service,
		Rate:       rate,
		TimeWindow: req.EndTime.Sub(req.StartTime),
		DataPoints: points,
	}, nil
}

// GetLatestMetric retrieves the most recent metric for a given name and service
func (r *PostgresMetricRepository) GetLatestMetric(ctx context.Context, metricName, service string) (*SystemMetric, error) {
	query := `
		SELECT id, metric_name, value, unit, service, labels, time, created_at
		FROM system_metrics
		WHERE metric_name = $1 AND service = $2
		ORDER BY time DESC
		LIMIT 1
	`

	var m SystemMetric
	var labelsJSON []byte

	err := r.db.QueryRowContext(ctx, query, metricName, service).Scan(
		&m.ID, &m.MetricName, &m.Value, &m.Unit,
		&m.Service, &labelsJSON, &m.Timestamp, &m.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get latest metric: %w", err)
	}

	if len(labelsJSON) > 0 {
		_ = json.Unmarshal(labelsJSON, &m.Labels)
	}

	return &m, nil
}

// GetMetricLabels returns distinct label combinations for a metric
func (r *PostgresMetricRepository) GetMetricLabels(ctx context.Context, metricName string) ([]map[string]string, error) {
	query := `
		SELECT DISTINCT labels
		FROM system_metrics
		WHERE metric_name = $1
		AND labels IS NOT NULL
		AND labels != '{}'
		LIMIT 1000
	`

	rows, err := r.db.QueryContext(ctx, query, metricName)
	if err != nil {
		return nil, fmt.Errorf("get labels: %w", err)
	}
	defer rows.Close()

	var results []map[string]string
	for rows.Next() {
		var labelsJSON []byte
		if err := rows.Scan(&labelsJSON); err != nil {
			continue
		}
		var labels map[string]string
		_ = json.Unmarshal(labelsJSON, &labels)
		if len(labels) > 0 {
			results = append(results, labels)
		}
	}

	return results, rows.Err()
}

// CleanupOldMetrics removes metrics older than the retention period
func (r *PostgresMetricRepository) CleanupOldMetrics(ctx context.Context, retentionDays int) (int64, error) {
	cutoffDate := time.Now().AddDate(0, 0, -retentionDays)

	result, err := r.db.ExecContext(ctx, `
		DELETE FROM system_metrics
		WHERE time < $1
	`, cutoffDate)
	if err != nil {
		return 0, fmt.Errorf("cleanup metrics: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// Ensure interfaces are implemented
var _ MetricRepository = (*PostgresMetricRepository)(nil)
