package alerts

import (
	"context"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"

	"github.com/google/uuid"
)

// Engine handles alert rule evaluation and alert generation
type Engine struct {
	repo              monitoring.Repository
	notificationQueue chan *monitoring.Alert
}

// NewEngine creates a new alert engine
func NewEngine(repo monitoring.Repository) *Engine {
	return &Engine{
		repo:              repo,
		notificationQueue: make(chan *monitoring.Alert, 1000),
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
			alert := &monitoring.Alert{
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
func (e *Engine) evaluateRule(ctx context.Context, rule *monitoring.AlertRule, projectID uuid.UUID) (bool, monitoring.JSONB, error) {
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
func (e *Engine) evaluateThresholdCondition(ctx context.Context, rule *monitoring.AlertRule, projectID uuid.UUID) (bool, monitoring.JSONB, error) {
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

	details := monitoring.JSONB{
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
func (e *Engine) evaluateRateOfChangeCondition(ctx context.Context, rule *monitoring.AlertRule, projectID uuid.UUID) (bool, monitoring.JSONB, error) {
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

	var timeSeries []monitoring.ProjectMetric
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

	details := monitoring.JSONB{
		"condition_type":      "rate_of_change",
		"max_rate":            maxRate,
		"actual_rate":         rateOfChange,
		"first_value":         firstValue,
		"last_value":          lastValue,
		"time_window_minutes": timeWindowMinutes,
		"evaluation_time":     time.Now().Format(time.RFC3339),
	}

	return triggered, details, nil
}

// evaluateDataGapCondition checks for missing data
func (e *Engine) evaluateDataGapCondition(ctx context.Context, rule *monitoring.AlertRule, projectID uuid.UUID) (bool, monitoring.JSONB, error) {
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
		readings, err := e.repo.GetSensorReadingsByType(ctx, projectID, *rule.SensorType, time.Now().Add(-24*time.Hour), time.Now())
		if err != nil || len(readings) == 0 {
			lastDataTime = time.Time{} // No data
		} else {
			lastDataTime = readings[0].Time
		}
		
	case "satellite":
		obs, err := e.repo.GetLatestSatelliteObservation(ctx, projectID, "sentinel2")
		if err != nil || obs == nil {
			lastDataTime = time.Time{}
		} else {
			lastDataTime = obs.Time
		}
		
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

	details := monitoring.JSONB{
		"condition_type":    "data_gap",
		"max_gap_minutes":   maxGapMinutes,
		"actual_gap_minutes": gapDuration.Minutes(),
		"last_data_time":    lastDataTime.Format(time.RFC3339),
		"evaluation_time":   time.Now().Format(time.RFC3339),
	}

	return triggered, details, nil
}

// evaluateAnomalyCondition detects anomalous values using statistical methods
func (e *Engine) evaluateAnomalyCondition(ctx context.Context, rule *monitoring.AlertRule, projectID uuid.UUID) (bool, monitoring.JSONB, error) {
	config := rule.ConditionConfig
	
	stdDevThreshold, ok := config["std_dev_threshold"].(float64)
	if !ok {
		stdDevThreshold = 3.0 // Default to 3 standard deviations
	}

	lookbackHours, ok := config["lookback_hours"].(float64)
	if !ok {
		lookbackHours = 24 // Default to 24 hours
	}

	// Get historical data for statistical analysis
	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(lookbackHours) * time.Hour)

	// This is a simplified implementation
	// In production, you'd want more sophisticated anomaly detection (e.g., using ML)
	
	details := monitoring.JSONB{
		"condition_type":     "anomaly",
		"std_dev_threshold":  stdDevThreshold,
		"lookback_hours":     lookbackHours,
		"evaluation_time":    time.Now().Format(time.RFC3339),
		"note":               "Anomaly detection requires historical data analysis",
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

func (e *Engine) generateAlertMessage(rule *monitoring.AlertRule, details monitoring.JSONB) string {
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
func (e *Engine) GetNotificationQueue() <-chan *monitoring.Alert {
	return e.notificationQueue
}
