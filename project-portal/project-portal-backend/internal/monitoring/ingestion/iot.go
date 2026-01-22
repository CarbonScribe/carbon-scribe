package ingestion

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"

	"github.com/google/uuid"
)

// IoTIngestion handles IoT sensor data ingestion
type IoTIngestion struct {
	repo              monitoring.Repository
	validationRules   map[string]SensorValidationRule
	mu                sync.RWMutex
}

// SensorValidationRule defines validation rules for sensor readings
type SensorValidationRule struct {
	SensorType string
	MinValue   float64
	MaxValue   float64
	Unit       string
}

// NewIoTIngestion creates a new IoT ingestion handler
func NewIoTIngestion(repo monitoring.Repository) *IoTIngestion {
	ingestion := &IoTIngestion{
		repo:            repo,
		validationRules: make(map[string]SensorValidationRule),
	}
	
	// Initialize default validation rules
	ingestion.initializeDefaultValidationRules()
	
	return ingestion
}

// initializeDefaultValidationRules sets up default validation rules for common sensor types
func (i *IoTIngestion) initializeDefaultValidationRules() {
	i.validationRules = map[string]SensorValidationRule{
		"soil_moisture": {
			SensorType: "soil_moisture",
			MinValue:   0,
			MaxValue:   100,
			Unit:       "percent",
		},
		"temperature": {
			SensorType: "temperature",
			MinValue:   -50,
			MaxValue:   60,
			Unit:       "celsius",
		},
		"humidity": {
			SensorType: "humidity",
			MinValue:   0,
			MaxValue:   100,
			Unit:       "percent",
		},
		"co2": {
			SensorType: "co2",
			MinValue:   300,
			MaxValue:   5000,
			Unit:       "ppm",
		},
		"ph": {
			SensorType: "ph",
			MinValue:   0,
			MaxValue:   14,
			Unit:       "ph",
		},
		"rainfall": {
			SensorType: "rainfall",
			MinValue:   0,
			MaxValue:   500,
			Unit:       "mm",
		},
		"light_intensity": {
			SensorType: "light_intensity",
			MinValue:   0,
			MaxValue:   200000,
			Unit:       "lux",
		},
		"wind_speed": {
			SensorType: "wind_speed",
			MinValue:   0,
			MaxValue:   200,
			Unit:       "km/h",
		},
	}
}

// IngestSensorReading ingests a single sensor reading
func (i *IoTIngestion) IngestSensorReading(ctx context.Context, reading monitoring.SensorReading) error {
	// Validate the reading
	if err := i.validateReading(&reading); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Update sensor last seen time
	if reading.SensorID != "" {
		_ = i.repo.UpdateSensorLastSeen(ctx, reading.SensorID, reading.Time)
	}

	// Store the reading
	if err := i.repo.CreateSensorReading(ctx, &reading); err != nil {
		return fmt.Errorf("failed to store sensor reading: %w", err)
	}

	return nil
}

// IngestBatch ingests multiple sensor readings in batch
func (i *IoTIngestion) IngestBatch(ctx context.Context, readings []monitoring.SensorReading) error {
	if len(readings) == 0 {
		return errors.New("empty readings batch")
	}

	// Validate all readings
	validReadings := make([]monitoring.SensorReading, 0, len(readings))
	for _, reading := range readings {
		if err := i.validateReading(&reading); err != nil {
			// Log validation error but continue with other readings
			fmt.Printf("Skipping invalid reading from sensor %s: %v\n", reading.SensorID, err)
			continue
		}
		validReadings = append(validReadings, reading)
	}

	if len(validReadings) == 0 {
		return errors.New("no valid readings in batch")
	}

	// Batch insert
	if err := i.repo.CreateSensorReadingBatch(ctx, validReadings); err != nil {
		return fmt.Errorf("failed to store readings batch: %w", err)
	}

	// Update last seen times for sensors
	go i.updateSensorLastSeenTimes(context.Background(), validReadings)

	return nil
}

// validateReading validates a sensor reading against defined rules
func (i *IoTIngestion) validateReading(reading *monitoring.SensorReading) error {
	if reading == nil {
		return errors.New("reading cannot be nil")
	}

	// Basic field validation
	if reading.SensorID == "" {
		return errors.New("sensor ID is required")
	}

	if reading.SensorType == "" {
		return errors.New("sensor type is required")
	}

	if reading.Unit == "" {
		return errors.New("unit is required")
	}

	if reading.ProjectID == uuid.Nil {
		return errors.New("project ID is required")
	}

	// Set default time if not provided
	if reading.Time.IsZero() {
		reading.Time = time.Now()
	}

	// Set default data quality if not provided
	if reading.DataQuality == "" {
		reading.DataQuality = "good"
	}

	// Validate against sensor type rules
	i.mu.RLock()
	rule, exists := i.validationRules[reading.SensorType]
	i.mu.RUnlock()

	if exists {
		// Check value range
		if reading.Value < rule.MinValue || reading.Value > rule.MaxValue {
			return fmt.Errorf("value %.2f out of valid range [%.2f, %.2f] for %s",
				reading.Value, rule.MinValue, rule.MaxValue, reading.SensorType)
		}

		// Check unit consistency
		if reading.Unit != rule.Unit {
			return fmt.Errorf("expected unit '%s' for %s, got '%s'",
				rule.Unit, reading.SensorType, reading.Unit)
		}
	}

	// Validate battery level if provided
	if reading.BatteryLevel != nil && (*reading.BatteryLevel < 0 || *reading.BatteryLevel > 100) {
		return errors.New("battery level must be between 0 and 100")
	}

	// Check for future timestamps
	if reading.Time.After(time.Now().Add(5 * time.Minute)) {
		return errors.New("reading timestamp is in the future")
	}

	// Check for very old readings (older than 1 year)
	if reading.Time.Before(time.Now().AddDate(-1, 0, 0)) {
		return errors.New("reading timestamp is too old (>1 year)")
	}

	return nil
}

// updateSensorLastSeenTimes updates last seen times for sensors (async)
func (i *IoTIngestion) updateSensorLastSeenTimes(ctx context.Context, readings []monitoring.SensorReading) {
	sensorTimes := make(map[string]time.Time)

	// Find the latest time for each sensor
	for _, reading := range readings {
		if lastTime, exists := sensorTimes[reading.SensorID]; !exists || reading.Time.After(lastTime) {
			sensorTimes[reading.SensorID] = reading.Time
		}
	}

	// Update each sensor
	for sensorID, lastTime := range sensorTimes {
		if err := i.repo.UpdateSensorLastSeen(ctx, sensorID, lastTime); err != nil {
			fmt.Printf("Failed to update last seen for sensor %s: %v\n", sensorID, err)
		}
	}
}

// AddValidationRule adds or updates a validation rule for a sensor type
func (i *IoTIngestion) AddValidationRule(rule SensorValidationRule) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.validationRules[rule.SensorType] = rule
}

// GetValidationRule retrieves the validation rule for a sensor type
func (i *IoTIngestion) GetValidationRule(sensorType string) (SensorValidationRule, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	rule, exists := i.validationRules[sensorType]
	return rule, exists
}

// DetectAnomalies detects anomalous sensor readings
func (i *IoTIngestion) DetectAnomalies(readings []monitoring.SensorReading) []monitoring.SensorReading {
	anomalies := make([]monitoring.SensorReading, 0)

	// Group readings by sensor
	sensorReadings := make(map[string][]monitoring.SensorReading)
	for _, reading := range readings {
		sensorReadings[reading.SensorID] = append(sensorReadings[reading.SensorID], reading)
	}

	// Check each sensor's readings
	for _, sensorGroup := range sensorReadings {
		if len(sensorGroup) < 3 {
			continue // Need at least 3 readings for statistical analysis
		}

		// Calculate mean and standard deviation
		sum := 0.0
		for _, r := range sensorGroup {
			sum += r.Value
		}
		mean := sum / float64(len(sensorGroup))

		variance := 0.0
		for _, r := range sensorGroup {
			variance += (r.Value - mean) * (r.Value - mean)
		}
		stdDev := 0.0
		if len(sensorGroup) > 1 {
			stdDev = variance / float64(len(sensorGroup)-1)
		}

		// Flag readings that are more than 3 standard deviations from mean
		threshold := 3.0
		for _, r := range sensorGroup {
			if abs(r.Value-mean) > threshold*stdDev {
				anomalies = append(anomalies, r)
			}
		}
	}

	return anomalies
}

// CheckDataGaps checks for gaps in sensor data
func (i *IoTIngestion) CheckDataGaps(ctx context.Context, sensorID string, expectedInterval time.Duration, checkPeriod time.Duration) ([]DataGap, error) {
	endTime := time.Now()
	startTime := endTime.Add(-checkPeriod)

	readings, err := i.repo.GetSensorReadings(ctx, uuid.Nil, sensorID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	if len(readings) == 0 {
		return []DataGap{{
			SensorID:  sensorID,
			StartTime: startTime,
			EndTime:   endTime,
			Duration:  checkPeriod,
		}}, nil
	}

	gaps := make([]DataGap, 0)
	for i := 0; i < len(readings)-1; i++ {
		gap := readings[i+1].Time.Sub(readings[i].Time)
		if gap > expectedInterval*2 { // Allow 2x the expected interval
			gaps = append(gaps, DataGap{
				SensorID:  sensorID,
				StartTime: readings[i].Time,
				EndTime:   readings[i+1].Time,
				Duration:  gap,
			})
		}
	}

	return gaps, nil
}

// DataGap represents a gap in sensor data
type DataGap struct {
	SensorID  string
	StartTime time.Time
	EndTime   time.Time
	Duration  time.Duration
}

// CalculateSensorStatistics calculates statistics for sensor readings over a period
func (i *IoTIngestion) CalculateSensorStatistics(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) (*SensorStatistics, error) {
	readings, err := i.repo.GetSensorReadingsByType(ctx, projectID, sensorType, start, end)
	if err != nil {
		return nil, err
	}

	if len(readings) == 0 {
		return nil, errors.New("no readings found for the specified period")
	}

	stats := &SensorStatistics{
		SensorType: sensorType,
		Count:      len(readings),
		StartTime:  start,
		EndTime:    end,
	}

	// Calculate min, max, sum
	stats.Min = readings[0].Value
	stats.Max = readings[0].Value
	sum := 0.0

	for _, reading := range readings {
		if reading.Value < stats.Min {
			stats.Min = reading.Value
		}
		if reading.Value > stats.Max {
			stats.Max = reading.Value
		}
		sum += reading.Value
	}

	// Calculate mean
	stats.Mean = sum / float64(len(readings))

	// Calculate standard deviation
	variance := 0.0
	for _, reading := range readings {
		variance += (reading.Value - stats.Mean) * (reading.Value - stats.Mean)
	}
	if len(readings) > 1 {
		stats.StdDev = variance / float64(len(readings)-1)
	}

	return stats, nil
}

// SensorStatistics represents statistical summary of sensor data
type SensorStatistics struct {
	SensorType string
	Count      int
	Min        float64
	Max        float64
	Mean       float64
	StdDev     float64
	StartTime  time.Time
	EndTime    time.Time
}

// abs returns the absolute value of a float64
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
