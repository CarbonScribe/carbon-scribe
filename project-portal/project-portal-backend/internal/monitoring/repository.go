package monitoring

import (
	"context"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// Repository defines the persistence contract for monitoring data.
type Repository interface {
	// Satellite methods
	Save(ctx context.Context, reading *ingestion.SatelliteReading) error
	ListByProject(ctx context.Context, projectID string, limit int) ([]ingestion.SatelliteReading, error)

	// Webhook methods
	SaveWebhookReading(ctx context.Context, reading *ingestion.WebhookReading) error
	GetWebhookReadingByID(ctx context.Context, webhookID string) (*ingestion.WebhookReading, error)
	ListWebhookReadings(ctx context.Context, projectID string, limit int) ([]ingestion.WebhookReading, error)
	ListWebhookReadingsByMetric(ctx context.Context, projectID, metricName string, limit int) ([]ingestion.WebhookReading, error)
	ListWebhookReadingsBySource(ctx context.Context, projectID, source string, limit int) ([]ingestion.WebhookReading, error)
	GetWebhookReadingsByTimeRange(ctx context.Context, projectID string, start, end time.Time) ([]ingestion.WebhookReading, error)

	// IoT methods
	SaveIoTReading(ctx context.Context, reading *ingestion.IoTReading) error
	GetIoTReadingsByProject(ctx context.Context, projectID string, limit int) ([]ingestion.IoTReading, error)
	GetIoTReadingsBySensor(ctx context.Context, projectID, sensorID string, limit int) ([]ingestion.IoTReading, error)
	GetIoTReadingsByType(ctx context.Context, projectID, sensorType string, limit int) ([]ingestion.IoTReading, error)
	GetIoTReadingsByTimeRange(ctx context.Context, projectID string, start, end time.Time) ([]ingestion.IoTReading, error)

	// Metrics methods
	MetricRepository

	// ============================================================================
	// Health Check Methods
	// ============================================================================

	SaveHealthCheck(ctx context.Context, check *ServiceHealthCheck) error
	SaveHealthCheckResult(ctx context.Context, result *HealthCheckResult) error
	GetHealthCheck(ctx context.Context, checkID string) (*ServiceHealthCheck, error)
	GetHealthCheckResults(ctx context.Context, checkID string, limit int) ([]HealthCheckResult, error)
	GetHealthChecksByService(ctx context.Context, serviceName string) ([]ServiceHealthCheck, error)
	GetHealthCheckResultsByTimeRange(ctx context.Context, serviceName string, start, end time.Time) ([]HealthCheckResult, error)
	GetLatestHealthCheckResult(ctx context.Context, serviceName string) (*HealthCheckResult, error)

	// ============================================================================
	// Alert Methods
	// ============================================================================

	SaveAlert(ctx context.Context, alert *SystemAlert) error
	GetAlert(ctx context.Context, alertID string) (*SystemAlert, error)
	ListAlerts(ctx context.Context, status AlertStatus, severity AlertSeverity, limit int) ([]SystemAlert, error)
	ListAlertsByService(ctx context.Context, serviceName string, limit int) ([]SystemAlert, error)
	UpdateAlert(ctx context.Context, alertID string, req UpdateAlertRequest) (*SystemAlert, error)
	AcknowledgeAlert(ctx context.Context, alertID, acknowledgedBy string) error
	ResolveAlert(ctx context.Context, alertID, resolvedBy string) error
	GetActiveAlerts(ctx context.Context) ([]SystemAlert, error)
	GetAlertCountsBySeverity(ctx context.Context) (map[AlertSeverity]int, error)

	// ============================================================================
	// Service Dependency Methods
	// ============================================================================

	SaveServiceDependency(ctx context.Context, dependency *ServiceDependency) error
	GetServiceDependency(ctx context.Context, dependencyID string) (*ServiceDependency, error)
	ListServiceDependencies(ctx context.Context, serviceName string) ([]ServiceDependency, error)
	GetDependenciesByService(ctx context.Context, serviceName string) ([]ServiceDependency, error)
	DeleteServiceDependency(ctx context.Context, dependencyID string) error
	UpdateServiceDependency(ctx context.Context, dependencyID string, isActive bool) error

	// ============================================================================
	// Status Snapshot Methods
	// ============================================================================

	SaveStatusSnapshot(ctx context.Context, snapshot *SystemStatusSnapshot) error
	GetStatusSnapshot(ctx context.Context, snapshotID string) (*SystemStatusSnapshot, error)
	GetLatestStatusSnapshot(ctx context.Context) (*SystemStatusSnapshot, error)
	ListStatusSnapshots(ctx context.Context, limit int) ([]SystemStatusSnapshot, error)
	GetStatusSnapshotsByTimeRange(ctx context.Context, start, end time.Time) ([]SystemStatusSnapshot, error)
	GetSystemStatusSummary(ctx context.Context) (*SystemStatusSummary, error)

	// ============================================================================
	// Notification Delivery Log Methods
	// ============================================================================

	SaveNotificationDeliveryLog(ctx context.Context, log *NotificationDeliveryLog) error
	GetNotificationDeliveryLogs(ctx context.Context, alertID string, limit int) ([]NotificationDeliveryLog, error)
	GetNotificationDeliveryLogsByRule(ctx context.Context, ruleID string, limit int) ([]NotificationDeliveryLog, error)
	MarkNotificationDeliverySuccess(ctx context.Context, logID string) error
	MarkNotificationDeliveryFailed(ctx context.Context, logID string, errMsg string) error
}
