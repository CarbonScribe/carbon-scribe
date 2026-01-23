package alerts

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Local type definitions to avoid import cycle

// JSONB is a custom type for PostgreSQL JSONB columns
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// AlertRule represents a monitoring alert rule
type AlertRule struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	ProjectID            *uuid.UUID `json:"project_id,omitempty" db:"project_id"`
	Name                 string     `json:"name" db:"name"`
	Description          *string    `json:"description,omitempty" db:"description"`
	ConditionType        string     `json:"condition_type" db:"condition_type"`
	MetricSource         string     `json:"metric_source" db:"metric_source"`
	MetricName           string     `json:"metric_name" db:"metric_name"`
	SensorType           *string    `json:"sensor_type,omitempty" db:"sensor_type"`
	ConditionConfig      JSONB      `json:"condition_config" db:"condition_config"`
	Severity             string     `json:"severity" db:"severity"`
	NotificationChannels JSONB      `json:"notification_channels" db:"notification_channels"`
	CooldownMinutes      int        `json:"cooldown_minutes" db:"cooldown_minutes"`
	IsActive             bool       `json:"is_active" db:"is_active"`
	CreatedBy            *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// Alert represents a triggered alert
type Alert struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	RuleID               *uuid.UUID `json:"rule_id,omitempty" db:"rule_id"`
	ProjectID            uuid.UUID  `json:"project_id" db:"project_id"`
	TriggerTime          time.Time  `json:"trigger_time" db:"trigger_time"`
	ResolvedTime         *time.Time `json:"resolved_time,omitempty" db:"resolved_time"`
	Severity             string     `json:"severity" db:"severity"`
	Title                string     `json:"title" db:"title"`
	Message              string     `json:"message" db:"message"`
	Details              JSONB      `json:"details,omitempty" db:"details"`
	Status               string     `json:"status" db:"status"`
	AcknowledgedBy       *uuid.UUID `json:"acknowledged_by,omitempty" db:"acknowledged_by"`
	AcknowledgedAt       *time.Time `json:"acknowledged_at,omitempty" db:"acknowledged_at"`
	ResolvedBy           *uuid.UUID `json:"resolved_by,omitempty" db:"resolved_by"`
	ResolutionNotes      *string    `json:"resolution_notes,omitempty" db:"resolution_notes"`
	NotificationSent     bool       `json:"notification_sent" db:"notification_sent"`
	NotificationAttempts int        `json:"notification_attempts" db:"notification_attempts"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// ProjectMetric represents a calculated metric for a project
type ProjectMetric struct {
	Time              time.Time `json:"time" db:"time"`
	ProjectID         uuid.UUID `json:"project_id" db:"project_id"`
	MetricName        string    `json:"metric_name" db:"metric_name"`
	Value             float64   `json:"value" db:"value"`
	AggregationPeriod string    `json:"aggregation_period" db:"aggregation_period"`
	CalculationMethod *string   `json:"calculation_method,omitempty" db:"calculation_method"`
	ConfidenceScore   *float64  `json:"confidence_score,omitempty" db:"confidence_score"`
	Unit              *string   `json:"unit,omitempty" db:"unit"`
	Metadata          JSONB     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

// SensorReading represents a single IoT sensor measurement
type SensorReading struct {
	Time           time.Time `json:"time" db:"time"`
	ProjectID      uuid.UUID `json:"project_id" db:"project_id"`
	SensorID       string    `json:"sensor_id" db:"sensor_id"`
	SensorType     string    `json:"sensor_type" db:"sensor_type"`
	Value          float64   `json:"value" db:"value"`
	Unit           string    `json:"unit" db:"unit"`
	Latitude       *float64  `json:"latitude,omitempty" db:"latitude"`
	Longitude      *float64  `json:"longitude,omitempty" db:"longitude"`
	AltitudeM      *float64  `json:"altitude_m,omitempty" db:"altitude_m"`
	BatteryLevel   *float64  `json:"battery_level,omitempty" db:"battery_level"`
	SignalStrength *int      `json:"signal_strength,omitempty" db:"signal_strength"`
	DataQuality    string    `json:"data_quality" db:"data_quality"`
	Metadata       JSONB     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// SatelliteObservation represents a single satellite data point
type SatelliteObservation struct {
	Time                 time.Time `json:"time" db:"time"`
	ProjectID            uuid.UUID `json:"project_id" db:"project_id"`
	SatelliteSource      string    `json:"satellite_source" db:"satellite_source"`
	TileID               *string   `json:"tile_id,omitempty" db:"tile_id"`
	NDVI                 *float64  `json:"ndvi,omitempty" db:"ndvi"`
	EVI                  *float64  `json:"evi,omitempty" db:"evi"`
	NDWI                 *float64  `json:"ndwi,omitempty" db:"ndwi"`
	SAVI                 *float64  `json:"savi,omitempty" db:"savi"`
	BiomassKgPerHa       *float64  `json:"biomass_kg_per_ha,omitempty" db:"biomass_kg_per_ha"`
	CloudCoveragePercent *float64  `json:"cloud_coverage_percent,omitempty" db:"cloud_coverage_percent"`
	DataQualityScore     *float64  `json:"data_quality_score,omitempty" db:"data_quality_score"`
	Geometry             *string   `json:"geometry,omitempty" db:"geometry"`
	RawBands             JSONB     `json:"raw_bands,omitempty" db:"raw_bands"`
	Metadata             JSONB     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
}

// Repository defines the interface for alert-related data access
type Repository interface {
	GetActiveAlertRules(ctx context.Context, projectID *uuid.UUID) ([]AlertRule, error)
	GetAlertRuleByID(ctx context.Context, id uuid.UUID) (*AlertRule, error)
	CheckAlertCooldown(ctx context.Context, ruleID, projectID uuid.UUID, cooldownMinutes int) (bool, error)
	CreateAlert(ctx context.Context, alert *Alert) error
	UpdateAlert(ctx context.Context, alert *Alert) error
	GetSensorReadingsByType(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) ([]SensorReading, error)
	GetLatestSatelliteObservation(ctx context.Context, projectID uuid.UUID, source string) (*SatelliteObservation, error)
	GetLatestMetricValue(ctx context.Context, projectID uuid.UUID, metricName, aggregationPeriod string) (*ProjectMetric, error)
	GetMetricTimeSeries(ctx context.Context, projectID uuid.UUID, metricName, aggregationPeriod string, start, end time.Time) ([]ProjectMetric, error)
}

// Engine handles alert rule evaluation and alert generation
type Engine struct {
	repo              Repository
	notificationQueue chan *Alert
}

// NewEngine creates a new alert engine
func NewEngine(repo Repository) *Engine {
	return &Engine{
		repo:              repo,
		notificationQueue: make(chan *Alert, 1000),
	}
}

// EvaluateRules evaluates all active alert rules for a project
func (e *Engine) EvaluateRules(ctx context.Context, projectID uuid.UUID) error {
	// Get all active alert rules for the project
	rules, err := e.repo.GetActiveAlertRules(ctx, &projectID)
	if err != nil {
		return fmt.Errorf("failed to get alert rules: %w", err)
	}

	for _, rule := range rules {
		// Check if rule is in cooldown
		inCooldown, err := e.repo.CheckAlertCooldown(ctx, rule.ID, projectID, rule.CooldownMinutes)
		if err != nil {
			fmt.Printf("Error checking cooldown for rule %s: %v\n", rule.ID, err)
			continue
		}

		if inCooldown {
			continue // Skip rules in cooldown
		}

		// Evaluate the rule based on its condition type
		shouldTrigger, details, err := e.evaluateRule(ctx, &rule, projectID)
		if err != nil {
			fmt.Printf("Error evaluating rule %s: %v\n", rule.ID, err)
			continue
		}

		if shouldTrigger {
			// Create alert
			alert := &Alert{
				ID:                   uuid.New(),
				RuleID:               &rule.ID,
				ProjectID:            projectID,
				TriggerTime:          time.Now(),
				Severity:             rule.Severity,
				Title:                rule.Name,
				Message:              e.generateAlertMessage(&rule, details),
				Details:              details,
				Status:               "active",
				NotificationSent:     false,
				NotificationAttempts: 0,
				CreatedAt:            time.Now(),
				UpdatedAt:            time.Now(),
			}

			if err := e.repo.CreateAlert(ctx, alert); err != nil {
				fmt.Printf("Error creating alert: %v\n", err)
				continue
			}

			// Queue for notification
			select {
			case e.notificationQueue <- alert:
			default:
				fmt.Printf("Notification queue full, alert %s not queued\n", alert.ID)
			}
		}
	}

	return nil
}

// evaluateRule evaluates a single alert rule
func (e *Engine) evaluateRule(ctx context.Context, rule *AlertRule, projectID uuid.UUID) (bool, JSONB, error) {
	switch rule.ConditionType {
	case "threshold":
		return e.evaluateThresholdCondition(ctx, rule, projectID)
	case "rate_of_change":
		return e.evaluateRateOfChangeCondition(ctx, rule, projectID)
	case "data_gap":
		return e.evaluateDataGapCondition(ctx, rule, projectID)
	case "anomaly":
		return e.evaluateAnomalyCondition(ctx, rule, projectID)
	default:
		return false, nil, fmt.Errorf("unknown condition type: %s", rule.ConditionType)
	}
}

// evaluateThresholdCondition checks if a metric exceeds a threshold
func (e *Engine) evaluateThresholdCondition(ctx context.Context, rule *AlertRule, projectID uuid.UUID) (bool, JSONB, error) {
	config := rule.ConditionConfig

	threshold, ok := config["threshold"].(float64)
	if !ok {
		return false, nil, fmt.Errorf("threshold not specified in condition config")
	}

	operator, ok := config["operator"].(string)
	if !ok {
		operator = "greater_than" // Default operator
	}

	var currentValue float64
	var err error

	// Get current value based on metric source
	switch rule.MetricSource {
	case "sensor":
		if rule.SensorType == nil {
			return false, nil, fmt.Errorf("sensor type required for sensor metrics")
		}
		currentValue, err = e.getLatestSensorValue(ctx, projectID, *rule.SensorType)

	case "satellite":
		currentValue, err = e.getLatestSatelliteMetric(ctx, projectID, rule.MetricName)

	case "calculated":
		currentValue, err = e.getLatestCalculatedMetric(ctx, projectID, rule.MetricName)

	default:
		return false, nil, fmt.Errorf("unknown metric source: %s", rule.MetricSource)
	}

	if err != nil {
		return false, nil, err
	}

	// Evaluate condition
	triggered := false
	switch operator {
	case "greater_than":
		triggered = currentValue > threshold
	case "less_than":
		triggered = currentValue < threshold
	case "equal_to":
		triggered = currentValue == threshold
	case "greater_than_or_equal":
		triggered = currentValue >= threshold
	case "less_than_or_equal":
		triggered = currentValue <= threshold
	}

	details := JSONB{
		"condition_type":  "threshold",
		"threshold":       threshold,
		"operator":        operator,
		"current_value":   currentValue,
		"metric_name":     rule.MetricName,
		"metric_source":   rule.MetricSource,
		"evaluation_time": time.Now().Format(time.RFC3339),
	}

	return triggered, details, nil
}

// evaluateRateOfChangeCondition checks if metric changes too rapidly
func (e *Engine) evaluateRateOfChangeCondition(ctx context.Context, rule *AlertRule, projectID uuid.UUID) (bool, JSONB, error) {
	config := rule.ConditionConfig

	maxRate, ok := config["max_rate"].(float64)
	if !ok {
		return false, nil, fmt.Errorf("max_rate not specified in condition config")
	}

	timeWindowMinutes, ok := config["time_window_minutes"].(float64)
	if !ok {
		timeWindowMinutes = 60 // Default to 1 hour
	}

	// Get historical values
	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(timeWindowMinutes) * time.Minute)

	var timeSeries []ProjectMetric
	var err error

	if rule.MetricSource == "calculated" {
		timeSeries, err = e.repo.GetMetricTimeSeries(ctx, projectID, rule.MetricName, "raw", startTime, endTime)
	} else {
		// For sensor/satellite, we'd need to fetch and aggregate
		return false, nil, fmt.Errorf("rate of change only supported for calculated metrics currently")
	}

	if err != nil || len(timeSeries) < 2 {
		return false, nil, err
	}

	// Calculate rate of change
	firstValue := timeSeries[0].Value
	lastValue := timeSeries[len(timeSeries)-1].Value
	rateOfChange := (lastValue - firstValue) / firstValue * 100 // Percentage change

	triggered := false
	if rateOfChange > maxRate || rateOfChange < -maxRate {
		triggered = true
	}

	details := JSONB{
		"condition_type":       "rate_of_change",
		"max_rate":             maxRate,
		"actual_rate":          rateOfChange,
		"first_value":          firstValue,
		"last_value":           lastValue,
		"time_window_minutes":  timeWindowMinutes,
		"evaluation_time":      time.Now().Format(time.RFC3339),
	}

	return triggered, details, nil
}

// evaluateDataGapCondition checks for missing data
func (e *Engine) evaluateDataGapCondition(ctx context.Context, rule *AlertRule, projectID uuid.UUID) (bool, JSONB, error) {
	config := rule.ConditionConfig

	maxGapMinutes, ok := config["max_gap_minutes"].(float64)
	if !ok {
		return false, nil, fmt.Errorf("max_gap_minutes not specified in condition config")
	}

	// Check when we last received data
	var lastDataTime time.Time
	var err error

	switch rule.MetricSource {
	case "sensor":
		if rule.SensorType == nil {
			return false, nil, fmt.Errorf("sensor type required")
		}
		// Get last sensor reading time
		readings, readErr := e.repo.GetSensorReadingsByType(ctx, projectID, *rule.SensorType, time.Now().Add(-24*time.Hour), time.Now())
		if readErr != nil || len(readings) == 0 {
			lastDataTime = time.Time{} // No data
		} else {
			lastDataTime = readings[0].Time
		}
		err = readErr

	case "satellite":
		obs, obsErr := e.repo.GetLatestSatelliteObservation(ctx, projectID, "sentinel2")
		if obsErr != nil || obs == nil {
			lastDataTime = time.Time{}
		} else {
			lastDataTime = obs.Time
		}
		err = obsErr

	default:
		return false, nil, fmt.Errorf("data gap check only supported for sensor and satellite sources")
	}

	if err != nil {
		return false, nil, err
	}

	// Calculate gap duration
	gapDuration := time.Since(lastDataTime)
	maxGapDuration := time.Duration(maxGapMinutes) * time.Minute

	triggered := gapDuration > maxGapDuration

	details := JSONB{
		"condition_type":     "data_gap",
		"max_gap_minutes":    maxGapMinutes,
		"actual_gap_minutes": gapDuration.Minutes(),
		"last_data_time":     lastDataTime.Format(time.RFC3339),
		"evaluation_time":    time.Now().Format(time.RFC3339),
	}

	return triggered, details, nil
}

// evaluateAnomalyCondition detects anomalous values using statistical methods
func (e *Engine) evaluateAnomalyCondition(ctx context.Context, rule *AlertRule, projectID uuid.UUID) (bool, JSONB, error) {
	config := rule.ConditionConfig

	stdDevThreshold, ok := config["std_dev_threshold"].(float64)
	if !ok {
		stdDevThreshold = 3.0 // Default to 3 standard deviations
	}

	lookbackHours, ok := config["lookback_hours"].(float64)
	if !ok {
		lookbackHours = 24 // Default to 24 hours
	}

	// This is a simplified implementation
	// In production, you'd want more sophisticated anomaly detection (e.g., using ML)

	details := JSONB{
		"condition_type":    "anomaly",
		"std_dev_threshold": stdDevThreshold,
		"lookback_hours":    lookbackHours,
		"evaluation_time":   time.Now().Format(time.RFC3339),
		"note":              "Anomaly detection requires historical data analysis",
	}

	// For now, return false - full implementation would require time series analysis
	return false, details, nil
}

// Helper methods

func (e *Engine) getLatestSensorValue(ctx context.Context, projectID uuid.UUID, sensorType string) (float64, error) {
	readings, err := e.repo.GetSensorReadingsByType(ctx, projectID, sensorType, time.Now().Add(-1*time.Hour), time.Now())
	if err != nil || len(readings) == 0 {
		return 0, fmt.Errorf("no recent sensor readings found")
	}

	// Calculate average of recent readings
	sum := 0.0
	for _, r := range readings {
		sum += r.Value
	}
	return sum / float64(len(readings)), nil
}

func (e *Engine) getLatestSatelliteMetric(ctx context.Context, projectID uuid.UUID, metricName string) (float64, error) {
	// For satellite metrics, we'd typically query the latest observation
	obs, err := e.repo.GetLatestSatelliteObservation(ctx, projectID, "sentinel2")
	if err != nil || obs == nil {
		return 0, fmt.Errorf("no recent satellite observations found")
	}

	// Map metric name to observation field
	switch metricName {
	case "ndvi":
		if obs.NDVI != nil {
			return *obs.NDVI, nil
		}
	case "biomass":
		if obs.BiomassKgPerHa != nil {
			return *obs.BiomassKgPerHa, nil
		}
	}

	return 0, fmt.Errorf("metric %s not found in satellite observation", metricName)
}

func (e *Engine) getLatestCalculatedMetric(ctx context.Context, projectID uuid.UUID, metricName string) (float64, error) {
	metric, err := e.repo.GetLatestMetricValue(ctx, projectID, metricName, "daily")
	if err != nil || metric == nil {
		return 0, fmt.Errorf("no recent metric value found for %s", metricName)
	}
	return metric.Value, nil
}

func (e *Engine) generateAlertMessage(rule *AlertRule, details JSONB) string {
	switch rule.ConditionType {
	case "threshold":
		return fmt.Sprintf("%s: Threshold breach detected for %s", rule.Name, rule.MetricName)
	case "rate_of_change":
		return fmt.Sprintf("%s: Rapid change detected in %s", rule.Name, rule.MetricName)
	case "data_gap":
		return fmt.Sprintf("%s: Data gap detected - no recent data for %s", rule.Name, rule.MetricName)
	case "anomaly":
		return fmt.Sprintf("%s: Anomalous value detected for %s", rule.Name, rule.MetricName)
	default:
		return fmt.Sprintf("%s: Alert triggered", rule.Name)
	}
}

// GetNotificationQueue returns the notification queue channel
func (e *Engine) GetNotificationQueue() <-chan *Alert {
	return e.notificationQueue
}
