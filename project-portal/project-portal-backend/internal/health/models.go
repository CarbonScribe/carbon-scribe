package health

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/datatypes"
)

// SystemMetric represents a time-series metric for system health monitoring
// This model is designed to work with TimescaleDB hypertables.
type SystemMetric struct {
	Time       time.Time `gorm:"type:timestamptz;not null;primaryKey" json:"time"`
	MetricName string    `gorm:"type:varchar(255);not null;index:idx_system_metrics_name_time,priority:1" json:"metric_name"`
	MetricType string    `gorm:"type:varchar(50);not null" json:"metric_type"` // gauge, counter, histogram, summary

	// Labels/dimensions for the metric
	ServiceName    string `gorm:"type:varchar(100);index:idx_system_metrics_service,priority:1" json:"service_name,omitempty"`
	Endpoint       string `gorm:"type:varchar(500)" json:"endpoint,omitempty"`
	HTTPMethod     string `gorm:"type:varchar(10)" json:"http_method,omitempty"`
	HTTPStatusCode int    `gorm:"type:integer" json:"http_status_code,omitempty"`
	InstanceID     string `gorm:"type:varchar(100)" json:"instance_id,omitempty"`
	Region         string `gorm:"type:varchar(50)" json:"region,omitempty"`

	// Metric values
	Value        float64         `gorm:"type:double precision;not null" json:"value"`
	Count        int             `gorm:"type:integer" json:"count,omitempty"`
	BucketBounds pq.Float64Array `gorm:"type:double precision[]" json:"bucket_bounds,omitempty"`

	// Additional metadata
	Labels   datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"labels,omitempty"`
	Metadata datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
}

// ServiceHealthCheck represents a configured health check for a service
type ServiceHealthCheck struct {
	ID          string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ServiceName string         `gorm:"type:varchar(100);not null" json:"service_name"`
	CheckType   string         `gorm:"type:varchar(50);not null" json:"check_type"` // http, tcp, database, custom
	CheckConfig datatypes.JSON `gorm:"type:jsonb;not null" json:"check_config"`     // Type-specific configuration

	// Scheduling
	IntervalSeconds int `gorm:"type:integer;not null;default:60" json:"interval_seconds"`
	TimeoutSeconds  int `gorm:"type:integer;not null;default:10" json:"timeout_seconds"`

	// Status
	LastCheckTime       *time.Time `gorm:"type:timestamptz" json:"last_check_time"`
	LastSuccessTime     *time.Time `gorm:"type:timestamptz" json:"last_success_time"`
	ConsecutiveFailures int        `gorm:"type:integer;default:0" json:"consecutive_failures"`
	IsEnabled           bool       `gorm:"type:boolean;default:true" json:"is_enabled"`

	// Alerting
	AlertOnFailure         bool   `gorm:"type:boolean;default:true" json:"alert_on_failure"`
	AlertThresholdFailures int    `gorm:"type:integer;default:3" json:"alert_threshold_failures"`
	AlertSeverity          string `gorm:"type:varchar(20);default:'critical'" json:"alert_severity"`

	CreatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"updated_at"`
}

// HealthCheckResult represents the result of a health check execution
type HealthCheckResult struct {
	ID      string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CheckID string `gorm:"type:uuid;not null;index:idx_health_check_results_check,priority:1" json:"check_id"`

	// Execution details
	CheckTime  time.Time `gorm:"type:timestamptz;not null;index:idx_health_check_results_check,priority:2" json:"check_time"`
	DurationMs int       `gorm:"type:integer;not null" json:"duration_ms"`
	Success    bool      `gorm:"type:boolean;not null" json:"success"`

	// Result details
	StatusCode   int    `gorm:"type:integer" json:"status_code,omitempty"`
	ResponseBody string `gorm:"type:text" json:"response_body,omitempty"`
	ErrorMessage string `gorm:"type:text" json:"error_message,omitempty"`

	// Metadata
	InstanceID string         `gorm:"type:varchar(100)" json:"instance_id,omitempty"`
	Region     string         `gorm:"type:varchar(50)" json:"region,omitempty"`
	Metadata   datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`

	CreatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"created_at"`
}

// SystemAlert represents an alert in the system
type SystemAlert struct {
	ID      string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AlertID string `gorm:"type:varchar(100);unique;not null" json:"alert_id"` // External alert ID for deduplication

	// Alert definition
	AlertName     string `gorm:"type:varchar(255);not null" json:"alert_name"`
	AlertSeverity string `gorm:"type:varchar(20);not null" json:"alert_severity"` // info, warning, critical
	AlertSource   string `gorm:"type:varchar(100);not null" json:"alert_source"`  // metric_threshold, health_check, manual

	// Affected resources
	ServiceName string `gorm:"type:varchar(100);index:idx_system_alerts_service,priority:1" json:"service_name,omitempty"`
	MetricName  string `gorm:"type:varchar(255)" json:"metric_name,omitempty"`
	ResourceID  string `gorm:"type:varchar(255)" json:"resource_id,omitempty"`

	// Alert details
	Description    string         `gorm:"type:text;not null" json:"description"`
	Condition      datatypes.JSON `gorm:"type:jsonb;not null" json:"condition"`
	CurrentValue   *float64       `gorm:"type:double precision" json:"current_value,omitempty"`
	ThresholdValue *float64       `gorm:"type:double precision" json:"threshold_value,omitempty"`

	// Status and lifecycle
	Status         string     `gorm:"type:varchar(50);default:'firing';index:idx_system_alerts_status,priority:1" json:"status"` // firing, resolved, acknowledged, silenced
	FiredAt        time.Time  `gorm:"type:timestamptz;not null;index:idx_system_alerts_status,priority:2;index:idx_system_alerts_service,priority:2" json:"fired_at"`
	ResolvedAt     *time.Time `gorm:"type:timestamptz" json:"resolved_at,omitempty"`
	AcknowledgedBy *string    `gorm:"type:uuid" json:"acknowledged_by,omitempty"`
	AcknowledgedAt *time.Time `gorm:"type:timestamptz" json:"acknowledged_at,omitempty"`

	// Additional context
	Labels      datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"labels,omitempty"`
	Annotations datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"annotations,omitempty"`

	CreatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"updated_at"`
}

// ServiceDependency represents a relationship between services
type ServiceDependency struct {
	ID             string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SourceService  string `gorm:"type:varchar(100);not null;uniqueIndex:idx_source_target" json:"source_service"`
	TargetService  string `gorm:"type:varchar(100);not null;uniqueIndex:idx_source_target" json:"target_service"`
	DependencyType string `gorm:"type:varchar(50);not null" json:"dependency_type"` // hard, soft, data

	// Health impact
	FailureImpact       string `gorm:"type:varchar(20);default:'medium'" json:"failure_impact"` // 'low', 'medium', 'high', 'critical'
	DegradationBehavior string `gorm:"type:varchar(100)" json:"degradation_behavior,omitempty"` // How source behaves when target fails

	// Monitoring
	HealthCheckID *string `gorm:"type:uuid" json:"health_check_id,omitempty"`
	IsMonitored   bool    `gorm:"type:boolean;default:true" json:"is_monitored"`

	// Metadata
	Description string         `gorm:"type:text" json:"description,omitempty"`
	Metadata    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`

	CreatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:timestamptz;default:current_timestamp" json:"updated_at"`
}

// SystemStatusSnapshot represents a snapshot of the system's overall health
type SystemStatusSnapshot struct {
	ID           string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SnapshotTime time.Time `gorm:"type:timestamptz;not null;index:idx_snapshots_type_time,priority:2" json:"snapshot_time"`
	SnapshotType string    `gorm:"type:varchar(50);not null;index:idx_snapshots_type_time,priority:1" json:"snapshot_type"` // hourly, daily, weekly, incident

	// Status summary
	OverallStatus     string `gorm:"type:varchar(20);not null" json:"overall_status"` // healthy, degraded, unhealthy
	ServicesTotal     int    `gorm:"type:integer;not null" json:"services_total"`
	ServicesHealthy   int    `gorm:"type:integer;not null" json:"services_healthy"`
	ServicesDegraded  int    `gorm:"type:integer;not null" json:"services_degraded"`
	ServicesUnhealthy int    `gorm:"type:integer;not null" json:"services_unhealthy"`

	// Key metrics at snapshot time
	APIP99ResponseTimeMs           float64 `gorm:"type:double precision" json:"api_p99_response_time_ms,omitempty"`
	DBConnectionUtilizationPercent float64 `gorm:"type:double precision" json:"db_connection_utilization_percent,omitempty"`
	ErrorRatePercent               float64 `gorm:"type:double precision" json:"error_rate_percent,omitempty"`

	// Active incidents
	ActiveUsers          int `gorm:"type:integer" json:"active_users,omitempty"`
	ActiveCriticalAlerts int `gorm:"type:integer;default:0" json:"active_critical_alerts"`
	ActiveWarningAlerts  int `gorm:"type:integer;default:0" json:"active_warning_alerts"`

	// Detailed status
	ServiceStatus   datatypes.JSON `gorm:"type:jsonb;not null" json:"service_status"`   // Per-service status details
	MetricSummaries datatypes.JSON `gorm:"type:jsonb;not null" json:"metric_summaries"` // Key metric summarie
	CreatedAt       time.Time      `gorm:"type:timestamptz;default:current_timestamp" json:"created_at"`
}

// TableName specifications
func (SystemMetric) TableName() string         { return "system_metrics" }
func (ServiceHealthCheck) TableName() string   { return "service_health_checks" }
func (HealthCheckResult) TableName() string    { return "health_check_results" }
func (SystemAlert) TableName() string          { return "system_alerts" }
func (ServiceDependency) TableName() string    { return "service_dependencies" }
func (SystemStatusSnapshot) TableName() string { return "system_status_snapshots" }

// ========== Request/Response Types ==========

// CreateSystemMetricRequest represents the request to create a system metric
type CreateSystemMetricRequest struct {
	MetricName  string `json:"metric_name" binding:"required"`
	MetricType  string `json:"metric_type" binding:"required"` // gauge, counter, histogram, summary
	ServiceName string `json:"service_name,omitempty"`

	// Labels/dimensions for the metric
	Endpoint       string `json:"endpoint,omitempty"`
	HTTPMethod     string `json:"http_method,omitempty"`
	HTTPStatusCode int    `json:"http_status_code,omitempty"`
	InstanceID     string `json:"instance_id,omitempty"`
	Region         string `json:"region,omitempty"`

	// Metric values
	Value        float64   `json:"value" binding:"required"`
	Count        int       `json:"count,omitempty"`
	BucketBounds []float64 `json:"bucket_bounds,omitempty"`

	// Additional metadata
	Labels   map[string]any `json:"labels,omitempty" swaggertype:"object"`
	Metadata map[string]any `json:"metadata,omitempty" swaggertype:"object"`
}

// SystemStatusResponse represents the basic health status of the system
type SystemStatusResponse struct {
	Status    string    `json:"status"` // healthy, degraded, unhealthy
	Service   string    `json:"service"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
}

// DetailedStatusResponse represents detailed health status with components
type DetailedStatusResponse struct {
	Status     string                     `json:"status"`
	Service    string                     `json:"service"`
	Timestamp  time.Time                  `json:"timestamp"`
	Version    string                     `json:"version"`
	Uptime     string                     `json:"uptime"`
	Components map[string]ComponentStatus `json:"components"`
}

// ComponentStatus represents the status of a single system component
type ComponentStatus struct {
	Status        string         `json:"status"` // up, down, degraded
	Details       string         `json:"details,omitempty"`
	LatencyMs     int64          `json:"latency_ms,omitempty"`
	LastCheckTime time.Time      `json:"last_check_time"`
	Metadata      map[string]any `json:"metadata,omitempty"`
}

// ServiceHealthInfo represents the health status of a monitored service
type ServiceHealthInfo struct {
	ServiceName            string     `json:"service_name"`
	Status                 string     `json:"status"` // healthy, degraded, unhealthy
	CheckType              string     `json:"check_type"`
	LastCheck              *time.Time `json:"last_check,omitempty"`
	Failures               int        `json:"consecutive_failures"`
	IntervalSeconds        int        `json:"interval_seconds"`
	TimeoutSeconds         int        `json:"timeout_seconds"`
	AlertThresholdFailures int        `json:"alert_threshold_failures"`
	AlertSeverity          string     `json:"alert_severity"`
}

// ServiceHealthResponse represents the response for the services health endpoint
type ServiceHealthResponse struct {
	Services  []ServiceHealthInfo `json:"services"`
	Timestamp time.Time           `json:"timestamp"`
}

// MetricQuery represents query parameters for filtering metrics
type MetricQuery struct {
	MetricName  string    `form:"metric_name"`
	MetricType  string    `form:"metric_type"`
	ServiceName string    `form:"service_name"`
	Endpoint    string    `form:"endpoint"`
	InstanceID  string    `form:"instance_id"`
	Region      string    `form:"region"`
	StartTime   time.Time `form:"start_time"`
	EndTime     time.Time `form:"end_time"`
	Limit       int       `form:"limit,default=100"`
}

// CreateServiceHealthCheckRequest represents the request to create/configure a health check
type CreateServiceHealthCheckRequest struct {
	ServiceName            string         `json:"service_name" binding:"required"`
	CheckType              string         `json:"check_type" binding:"required"` // http, tcp, database, custom
	CheckConfig            map[string]any `json:"check_config" binding:"required"`
	IntervalSeconds        int            `json:"interval_seconds"`
	TimeoutSeconds         int            `json:"timeout_seconds"`
	AlertOnFailure         bool           `json:"alert_on_failure"`
	AlertThresholdFailures int            `json:"alert_threshold_failures"`
	AlertSeverity          string         `json:"alert_severity"`
	IsEnabled              bool           `json:"is_enabled"`
}

// AlertQuery represents query parameters for filtering alerts
type AlertQuery struct {
	Status      string    `form:"status"`
	Severity    string    `form:"severity"`
	ServiceName string    `form:"service_name"`
	AlertSource string    `form:"alert_source"`
	StartTime   time.Time `form:"start_time"`
	EndTime     time.Time `form:"end_time"`
	Limit       int       `form:"limit,default=100"`
}

// AcknowledgeAlertRequest represents the request to acknowledge an alert
type AcknowledgeAlertRequest struct {
	AcknowledgedBy string `json:"acknowledged_by" binding:"required"`
}

// ServiceUptime represents uptime statistics for a service
type ServiceUptime struct {
	ServiceName string  `json:"service_name"`
	Uptime24h   float64 `json:"uptime_24h"`
	Uptime7d    float64 `json:"uptime_7d"`
	Uptime30d   float64 `json:"uptime_30d"`
}

// UptimeResponse represents the response for the uptime statistics endpoint
type UptimeResponse struct {
	Services  []ServiceUptime `json:"services"`
	Timestamp time.Time       `json:"timestamp"`
}
