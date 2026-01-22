package monitoring

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Repository defines the interface for monitoring data persistence
type Repository interface {
	// Satellite Observations
	CreateSatelliteObservation(ctx context.Context, obs *SatelliteObservation) error
	CreateSatelliteObservationBatch(ctx context.Context, observations []SatelliteObservation) error
	GetSatelliteObservations(ctx context.Context, query SatelliteObservationQuery) ([]SatelliteObservation, int64, error)
	GetLatestSatelliteObservation(ctx context.Context, projectID uuid.UUID, source string) (*SatelliteObservation, error)
	
	// Sensor Readings
	CreateSensorReading(ctx context.Context, reading *SensorReading) error
	CreateSensorReadingBatch(ctx context.Context, readings []SensorReading) error
	GetSensorReadings(ctx context.Context, projectID uuid.UUID, sensorID string, start, end time.Time) ([]SensorReading, error)
	GetLatestSensorReading(ctx context.Context, sensorID string) (*SensorReading, error)
	GetSensorReadingsByType(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) ([]SensorReading, error)
	
	// Sensors
	CreateSensor(ctx context.Context, sensor *Sensor) error
	GetSensorByID(ctx context.Context, id uuid.UUID) (*Sensor, error)
	GetSensorBySensorID(ctx context.Context, sensorID string) (*Sensor, error)
	GetProjectSensors(ctx context.Context, projectID uuid.UUID) ([]Sensor, error)
	GetSensorsByType(ctx context.Context, projectID uuid.UUID, sensorType string) ([]Sensor, error)
	UpdateSensor(ctx context.Context, sensor *Sensor) error
	UpdateSensorLastSeen(ctx context.Context, sensorID string, lastSeen time.Time) error
	DeleteSensor(ctx context.Context, id uuid.UUID) error
	
	// Project Metrics
	CreateProjectMetric(ctx context.Context, metric *ProjectMetric) error
	CreateProjectMetricBatch(ctx context.Context, metrics []ProjectMetric) error
	GetProjectMetrics(ctx context.Context, query MetricsQuery) ([]ProjectMetric, int64, error)
	GetLatestMetricValue(ctx context.Context, projectID uuid.UUID, metricName, aggregationPeriod string) (*ProjectMetric, error)
	GetMetricTimeSeries(ctx context.Context, projectID uuid.UUID, metricName, aggregationPeriod string, start, end time.Time) ([]ProjectMetric, error)
	
	// Alert Rules
	CreateAlertRule(ctx context.Context, rule *AlertRule) error
	GetAlertRuleByID(ctx context.Context, id uuid.UUID) (*AlertRule, error)
	GetActiveAlertRules(ctx context.Context, projectID *uuid.UUID) ([]AlertRule, error)
	GetProjectAlertRules(ctx context.Context, projectID uuid.UUID) ([]AlertRule, error)
	UpdateAlertRule(ctx context.Context, rule *AlertRule) error
	DeleteAlertRule(ctx context.Context, id uuid.UUID) error
	
	// Alerts
	CreateAlert(ctx context.Context, alert *Alert) error
	GetAlertByID(ctx context.Context, id uuid.UUID) (*Alert, error)
	GetAlerts(ctx context.Context, query AlertQuery) ([]Alert, int64, error)
	GetActiveProjectAlerts(ctx context.Context, projectID uuid.UUID) ([]Alert, error)
	AcknowledgeAlert(ctx context.Context, alertID, userID uuid.UUID) error
	ResolveAlert(ctx context.Context, alertID, userID uuid.UUID, notes string) error
	UpdateAlert(ctx context.Context, alert *Alert) error
	CheckAlertCooldown(ctx context.Context, ruleID, projectID uuid.UUID, cooldownMinutes int) (bool, error)
	
	// Aggregations and Analytics
	GetHourlySensorAggregates(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) ([]SensorAggregate, error)
	GetDailySatelliteAggregates(ctx context.Context, projectID uuid.UUID, source string, start, end time.Time) ([]SatelliteAggregate, error)
	CalculateAverageNDVI(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error)
	CalculateAverageBiomass(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error)
}

// SensorAggregate represents aggregated sensor data
type SensorAggregate struct {
	Bucket       time.Time `json:"bucket" db:"bucket"`
	ProjectID    uuid.UUID `json:"project_id" db:"project_id"`
	SensorID     string    `json:"sensor_id" db:"sensor_id"`
	SensorType   string    `json:"sensor_type" db:"sensor_type"`
	AvgValue     float64   `json:"avg_value" db:"avg_value"`
	MinValue     float64   `json:"min_value" db:"min_value"`
	MaxValue     float64   `json:"max_value" db:"max_value"`
	StddevValue  *float64  `json:"stddev_value,omitempty" db:"stddev_value"`
	ReadingCount int       `json:"reading_count" db:"reading_count"`
}

// SatelliteAggregate represents aggregated satellite observation data
type SatelliteAggregate struct {
	Bucket             time.Time `json:"bucket" db:"bucket"`
	ProjectID          uuid.UUID `json:"project_id" db:"project_id"`
	SatelliteSource    string    `json:"satellite_source" db:"satellite_source"`
	AvgNDVI            *float64  `json:"avg_ndvi,omitempty" db:"avg_ndvi"`
	MaxNDVI            *float64  `json:"max_ndvi,omitempty" db:"max_ndvi"`
	MinNDVI            *float64  `json:"min_ndvi,omitempty" db:"min_ndvi"`
	AvgBiomass         *float64  `json:"avg_biomass,omitempty" db:"avg_biomass"`
	AvgCloudCoverage   *float64  `json:"avg_cloud_coverage,omitempty" db:"avg_cloud_coverage"`
	ObservationCount   int       `json:"observation_count" db:"observation_count"`
}
