package monitoring

import (
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
)

// Re-export ingestion types so callers only import this package.
type BoundingBox = ingestion.BoundingBox
type SatelliteReading = ingestion.SatelliteReading
type WebhookReading = ingestion.WebhookReading
type Location = ingestion.Location
type IoTReading = ingestion.IoTReading

// IngestSatelliteRequest is the API payload for POST /api/v1/monitoring/satellite.
type IngestSatelliteRequest struct {
	ProjectID   string            `json:"project_id" binding:"required"`
	Source      string            `json:"source" binding:"required"`
	DataType    string            `json:"data_type" binding:"required"`
	NDVIMean    *float64          `json:"ndvi_mean"`
	NDVIMin     *float64          `json:"ndvi_min"`
	NDVIMax     *float64          `json:"ndvi_max"`
	BiomassTons *float64          `json:"biomass_tons"`
	ImageryURL  string            `json:"imagery_url"`
	BoundingBox *BoundingBox      `json:"bounding_box"`
	Metadata    map[string]string `json:"metadata"`
	CapturedAt  time.Time         `json:"captured_at" binding:"required"`
}

// IngestWebhookRequest is the API payload for POST /api/v1/monitoring/webhook.
type IngestWebhookRequest struct {
	ProjectID   string            `json:"project_id" binding:"required"`
	Source      string            `json:"source" binding:"required"`
	SourceType  string            `json:"source_type" binding:"required"`
	MetricName  string            `json:"metric_name" binding:"required"`
	MetricValue float64           `json:"metric_value" binding:"required"`
	Unit        string            `json:"unit"`
	Location    *Location         `json:"location"`
	Metadata    map[string]string `json:"metadata"`
	CapturedAt  time.Time         `json:"captured_at" binding:"required"`
	WebhookID   string            `json:"webhook_id" binding:"required"` // For idempotency
}

// IngestIoTRequest is the API payload for POST /api/v1/monitoring/iot.
type IngestIoTRequest struct {
	ProjectID      string            `json:"project_id" binding:"required"`
	SensorID       string            `json:"sensor_id" binding:"required"`
	SensorType     string            `json:"sensor_type" binding:"required"`
	Value          float64           `json:"value" binding:"required"`
	Unit           string            `json:"unit"`
	Location       *Location         `json:"location"`
	Metadata       map[string]string `json:"metadata"`
	CapturedAt     time.Time         `json:"captured_at" binding:"required"`
	DeviceID       string            `json:"device_id"`
	BatteryLevel   *float64          `json:"battery_level"`
	SignalStrength *int              `json:"signal_strength"`
}

// ============================================================================
// Health Check Models
// ============================================================================

// HealthCheckStatus represents the status of a health check
type HealthCheckStatus string

const (
	HealthCheckStatusHealthy   HealthCheckStatus = "healthy"
	HealthCheckStatusDegraded  HealthCheckStatus = "degraded"
	HealthCheckStatusUnhealthy HealthCheckStatus = "unhealthy"
	HealthCheckStatusUnknown   HealthCheckStatus = "unknown"
)

// ServiceHealthCheck represents a health check for a service
type ServiceHealthCheck struct {
	ID          string
	ServiceName string
	CheckType   string
	Status      HealthCheckStatus
	LatencyMs   *float64
	Error       string
	Details     map[string]interface{}
	CheckedAt   time.Time
	CreatedAt   time.Time
}

// HealthCheckResult represents a historical health check result
type HealthCheckResult struct {
	ID          string
	CheckID     string
	ServiceName string
	Status      HealthCheckStatus
	LatencyMs   *float64
	Error       string
	Details     map[string]interface{}
	CheckedAt   time.Time
	CreatedAt   time.Time
}

// ============================================================================
// Alert Models
// ============================================================================

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusActive       AlertStatus = "active"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusResolved     AlertStatus = "resolved"
	AlertStatusIgnored      AlertStatus = "ignored"
)

// SystemAlert represents a system alert
type SystemAlert struct {
	ID             string
	ServiceName    string
	Severity       AlertSeverity
	Status         AlertStatus
	Title          string
	Message        string
	Details        map[string]interface{}
	TriggeredBy    string
	ResolvedBy     string
	AcknowledgedBy string
	AcknowledgedAt *time.Time
	ResolvedAt     *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// CreateAlertRequest is the API payload for creating an alert
type CreateAlertRequest struct {
	ServiceName string                 `json:"service_name" binding:"required"`
	Severity    AlertSeverity          `json:"severity" binding:"required"`
	Title       string                 `json:"title" binding:"required"`
	Message     string                 `json:"message" binding:"required"`
	Details     map[string]interface{} `json:"details"`
	TriggeredBy string                 `json:"triggered_by"`
}

// UpdateAlertRequest is the API payload for updating an alert
type UpdateAlertRequest struct {
	Status     AlertStatus            `json:"status"`
	ResolvedBy string                 `json:"resolved_by"`
	Details    map[string]interface{} `json:"details"`
}

// ============================================================================
// Service Dependency Models
// ============================================================================

// ServiceDependency represents a dependency between services
type ServiceDependency struct {
	ID             string
	ServiceName    string
	DependsOn      string
	DependencyType string // "hard", "soft", "optional"
	Description    string
	IsActive       bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ============================================================================
// Status Snapshot Models
// ============================================================================

// SystemStatusSnapshot represents a snapshot of system status at a point in time
type SystemStatusSnapshot struct {
	ID                 string
	OverallStatus      HealthCheckStatus
	Services           map[string]HealthCheckStatus
	ActiveAlertCount   int
	ResolvedAlertCount int
	UptimePercent      *float64
	LatencyMs          *float64
	ErrorRate          *float64
	Metadata           map[string]interface{}
	SnapshotTime       time.Time
	CreatedAt          time.Time
}

// SystemStatusSummary represents a summary of system status
type SystemStatusSummary struct {
	OverallStatus     HealthCheckStatus
	TotalServices     int
	HealthyServices   int
	DegradedServices  int
	UnhealthyServices int
	UnknownServices   int
	ActiveAlerts      int
	TotalAlerts       int
	UptimePercent     float64
	AvgLatencyMs      float64
	ErrorRate         float64
	Timestamp         time.Time
}

// NotificationDeliveryStatus represents the status of a notification delivery attempt
type NotificationDeliveryStatus string

const (
	NotificationDeliveryStatusPending   NotificationDeliveryStatus = "pending"
	NotificationDeliveryStatusSuccess   NotificationDeliveryStatus = "success"
	NotificationDeliveryStatusFailed    NotificationDeliveryStatus = "failed"
	NotificationDeliveryStatusRetrying  NotificationDeliveryStatus = "retrying"
)

// NotificationDeliveryLog tracks delivery attempts for alert notifications
type NotificationDeliveryLog struct {
	ID           string                       `json:"id"`
	AlertID      string                       `json:"alert_id"`
	RuleID       string                       `json:"rule_id"`
	Channel      string                       `json:"channel"` // "email", "webhook", "websocket", "sms"
	Status       NotificationDeliveryStatus   `json:"status"`
	AttemptCount int                          `json:"attempt_count"`
	Error        string                       `json:"error,omitempty"`
	ErrorCode    string                       `json:"error_code,omitempty"`
	Details      map[string]interface{}       `json:"details,omitempty"`
	SentAt       *time.Time                   `json:"sent_at,omitempty"`
	DeliveredAt  *time.Time                   `json:"delivered_at,omitempty"`
	CreatedAt    time.Time                    `json:"created_at"`
	UpdatedAt    time.Time                    `json:"updated_at"`
}
