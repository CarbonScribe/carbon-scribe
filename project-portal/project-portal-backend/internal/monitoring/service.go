package monitoring

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Service defines the business logic interface for monitoring operations
type Service interface {
	// Satellite Data Ingestion
	ProcessSatelliteWebhook(ctx context.Context, payload SatelliteWebhookPayload) error
	IngestSatelliteObservations(ctx context.Context, observations []SatelliteObservation) error
	GetSatelliteData(ctx context.Context, query SatelliteObservationQuery) ([]SatelliteObservation, int64, error)
	
	// IoT Sensor Management
	RegisterSensor(ctx context.Context, req SensorRegistrationRequest) (*Sensor, error)
	GetSensor(ctx context.Context, id uuid.UUID) (*Sensor, error)
	GetProjectSensors(ctx context.Context, projectID uuid.UUID, sensorType *string) ([]Sensor, error)
	UpdateSensor(ctx context.Context, id uuid.UUID, sensor *Sensor) error
	DecommissionSensor(ctx context.Context, id uuid.UUID) error
	
	// IoT Data Ingestion
	IngestSensorReadings(ctx context.Context, readings []SensorReading) error
	GetSensorData(ctx context.Context, projectID uuid.UUID, sensorID string, start, end time.Time) ([]SensorReading, error)
	GetSensorDataByType(ctx context.Context, projectID uuid.UUID, sensorType string, start, end time.Time) ([]SensorReading, error)
	
	// Metrics Calculation and Retrieval
	CalculateProjectMetrics(ctx context.Context, projectID uuid.UUID, period string) error
	GetProjectMetrics(ctx context.Context, query MetricsQuery) ([]ProjectMetric, int64, error)
	GetPerformanceDashboard(ctx context.Context, projectID uuid.UUID, period string) (*PerformanceDashboard, error)
	GetMetricTrends(ctx context.Context, projectID uuid.UUID, metricNames []string, start, end time.Time) (map[string]TrendAnalysis, error)
	
	// Alert Management
	CreateAlertRule(ctx context.Context, req AlertRuleRequest, createdBy uuid.UUID) (*AlertRule, error)
	GetAlertRule(ctx context.Context, id uuid.UUID) (*AlertRule, error)
	GetProjectAlertRules(ctx context.Context, projectID uuid.UUID) ([]AlertRule, error)
	UpdateAlertRule(ctx context.Context, id uuid.UUID, req AlertRuleRequest) error
	DeleteAlertRule(ctx context.Context, id uuid.UUID) error
	ToggleAlertRule(ctx context.Context, id uuid.UUID, isActive bool) error
	
	// Alert Operations
	EvaluateAlertRules(ctx context.Context, projectID uuid.UUID) error
	GetAlerts(ctx context.Context, query AlertQuery) ([]Alert, int64, error)
	GetProjectActiveAlerts(ctx context.Context, projectID uuid.UUID) ([]Alert, error)
	AcknowledgeAlert(ctx context.Context, alertID uuid.UUID, req AlertAcknowledgeRequest) error
	ResolveAlert(ctx context.Context, alertID uuid.UUID, req AlertResolveRequest) error
	
	// Real-time Streaming (WebSocket support methods)
	StreamMonitoringData(ctx context.Context, subscription WebSocketSubscription) (<-chan WebSocketMessage, error)
	BroadcastSensorReading(ctx context.Context, reading SensorReading) error
	BroadcastAlert(ctx context.Context, alert Alert) error
}
