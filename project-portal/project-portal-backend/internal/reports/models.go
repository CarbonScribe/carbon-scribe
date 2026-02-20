package reports

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ReportCategory defines the type of report
type ReportCategory string

const (
	CategoryFinancial   ReportCategory = "financial"
	CategoryOperational ReportCategory = "operational"
	CategoryCompliance  ReportCategory = "compliance"
	CategoryCustom      ReportCategory = "custom"
)

// ReportVisibility defines who can access the report
type ReportVisibility string

const (
	VisibilityPrivate ReportVisibility = "private"
	VisibilityShared  ReportVisibility = "shared"
	VisibilityPublic  ReportVisibility = "public"
)

// ExportFormat defines the output format
type ExportFormat string

const (
	FormatCSV   ExportFormat = "csv"
	FormatExcel ExportFormat = "excel"
	FormatPDF   ExportFormat = "pdf"
	FormatJSON  ExportFormat = "json"
)

// DeliveryMethod defines how reports are delivered
type DeliveryMethod string

const (
	DeliveryEmail   DeliveryMethod = "email"
	DeliveryS3      DeliveryMethod = "s3"
	DeliveryWebhook DeliveryMethod = "webhook"
)

// ExecutionStatus defines the status of a report execution
type ExecutionStatus string

const (
	StatusPending    ExecutionStatus = "pending"
	StatusProcessing ExecutionStatus = "processing"
	StatusCompleted  ExecutionStatus = "completed"
	StatusFailed     ExecutionStatus = "failed"
)

// WidgetType defines the type of dashboard widget
type WidgetType string

const (
	WidgetChart  WidgetType = "chart"
	WidgetMetric WidgetType = "metric"
	WidgetTable  WidgetType = "table"
	WidgetGauge  WidgetType = "gauge"
)

// WidgetSize defines the size of a dashboard widget
type WidgetSize string

const (
	WidgetSmall  WidgetSize = "small"
	WidgetMedium WidgetSize = "medium"
	WidgetLarge  WidgetSize = "large"
	WidgetFull   WidgetSize = "full"
)

// AggregateFunction defines SQL aggregate functions
type AggregateFunction string

const (
	AggregateSum   AggregateFunction = "SUM"
	AggregateAvg   AggregateFunction = "AVG"
	AggregateCount AggregateFunction = "COUNT"
	AggregateMin   AggregateFunction = "MIN"
	AggregateMax   AggregateFunction = "MAX"
)

// ReportDefinition represents a saved report configuration
type ReportDefinition struct {
	ID                uuid.UUID        `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name              string           `gorm:"type:varchar(255);not null" json:"name"`
	Description       string           `gorm:"type:text" json:"description,omitempty"`
	Category          ReportCategory   `gorm:"type:varchar(100)" json:"category,omitempty"`
	Config            datatypes.JSON   `gorm:"type:jsonb;not null" json:"config"`
	CreatedBy         *uuid.UUID       `gorm:"type:uuid" json:"created_by,omitempty"`
	Visibility        ReportVisibility `gorm:"type:varchar(50);default:'private'" json:"visibility"`
	SharedWithUsers   []uuid.UUID      `gorm:"type:uuid[]" json:"shared_with_users,omitempty"`
	SharedWithRoles   []string         `gorm:"type:varchar(50)[]" json:"shared_with_roles,omitempty"`
	Version           int              `gorm:"default:1" json:"version"`
	IsTemplate        bool             `gorm:"default:false" json:"is_template"`
	BasedOnTemplateID *uuid.UUID       `gorm:"type:uuid" json:"based_on_template_id,omitempty"`
	CreatedAt         time.Time        `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time        `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName specifies the table name for GORM
func (ReportDefinition) TableName() string {
	return "report_definitions"
}

// ReportConfig represents the JSON configuration of a report
type ReportConfig struct {
	Dataset      string              `json:"dataset"`
	Fields       []FieldConfig       `json:"fields"`
	Filters      []FilterConfig      `json:"filters,omitempty"`
	Groupings    []GroupConfig       `json:"groupings,omitempty"`
	Sorts        []SortConfig        `json:"sorts,omitempty"`
	Calculations []CalculationConfig `json:"calculations,omitempty"`
	Limit        int                 `json:"limit,omitempty"`
}

// FieldConfig represents a field in the report
type FieldConfig struct {
	Name       string            `json:"name"`
	Alias      string            `json:"alias,omitempty"`
	Aggregate  AggregateFunction `json:"aggregate,omitempty"`
	Format     string            `json:"format,omitempty"`
	IsHidden   bool              `json:"is_hidden,omitempty"`
	SortOrder  int               `json:"sort_order,omitempty"`
	DataType   string            `json:"data_type,omitempty"`
	IsEditable bool              `json:"is_editable,omitempty"`
}

// FilterConfig represents a filter condition
type FilterConfig struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, gte, lt, lte, like, in, between
	Value    interface{} `json:"value"`
	Logic    string      `json:"logic,omitempty"` // AND, OR
}

// GroupConfig represents grouping configuration
type GroupConfig struct {
	Field     string `json:"field"`
	Order     int    `json:"order"`
	TimeGrain string `json:"time_grain,omitempty"` // day, week, month, quarter, year
}

// SortConfig represents sorting configuration
type SortConfig struct {
	Field     string `json:"field"`
	Direction string `json:"direction"` // asc, desc
	Order     int    `json:"order"`
}

// CalculationConfig represents a calculated field
type CalculationConfig struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
	DataType   string `json:"data_type"`
}

// ReportSchedule represents a scheduled report configuration
type ReportSchedule struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ReportDefinitionID uuid.UUID      `gorm:"type:uuid;not null" json:"report_definition_id"`
	Name               string         `gorm:"type:varchar(255);not null" json:"name"`
	CronExpression     string         `gorm:"type:varchar(100);not null" json:"cron_expression"`
	Timezone           string         `gorm:"type:varchar(50);default:'UTC'" json:"timezone"`
	StartDate          *time.Time     `gorm:"type:date" json:"start_date,omitempty"`
	EndDate            *time.Time     `gorm:"type:date" json:"end_date,omitempty"`
	IsActive           bool           `gorm:"default:true" json:"is_active"`
	Format             ExportFormat   `gorm:"type:varchar(20);not null" json:"format"`
	DeliveryMethod     DeliveryMethod `gorm:"type:varchar(50);not null" json:"delivery_method"`
	DeliveryConfig     datatypes.JSON `gorm:"type:jsonb;not null" json:"delivery_config"`
	RecipientEmails    []string       `gorm:"type:text[]" json:"recipient_emails,omitempty"`
	RecipientUserIDs   []uuid.UUID    `gorm:"type:uuid[]" json:"recipient_user_ids,omitempty"`
	WebhookURL         string         `gorm:"type:text" json:"webhook_url,omitempty"`
	CreatedAt          time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// Associations
	ReportDefinition *ReportDefinition `gorm:"foreignKey:ReportDefinitionID" json:"report_definition,omitempty"`
}

// TableName specifies the table name for GORM
func (ReportSchedule) TableName() string {
	return "report_schedules"
}

// DeliveryConfig represents method-specific delivery settings
type DeliveryConfigEmail struct {
	Subject  string `json:"subject"`
	Body     string `json:"body"`
	FromName string `json:"from_name,omitempty"`
}

type DeliveryConfigS3 struct {
	Bucket    string `json:"bucket"`
	Prefix    string `json:"prefix"`
	Region    string `json:"region,omitempty"`
	ACL       string `json:"acl,omitempty"`
	Encrypted bool   `json:"encrypted,omitempty"`
}

type DeliveryConfigWebhook struct {
	Method  string            `json:"method"` // POST, PUT
	Headers map[string]string `json:"headers,omitempty"`
	AuthKey string            `json:"auth_key,omitempty"`
}

// ReportExecution represents a single report execution
type ReportExecution struct {
	ID                 uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ReportDefinitionID *uuid.UUID      `gorm:"type:uuid" json:"report_definition_id,omitempty"`
	ScheduleID         *uuid.UUID      `gorm:"type:uuid" json:"schedule_id,omitempty"`
	TriggeredBy        *uuid.UUID      `gorm:"type:uuid" json:"triggered_by,omitempty"`
	TriggeredAt        time.Time       `gorm:"not null" json:"triggered_at"`
	CompletedAt        *time.Time      `json:"completed_at,omitempty"`
	Status             ExecutionStatus `gorm:"type:varchar(50);default:'pending'" json:"status"`
	ErrorMessage       string          `gorm:"type:text" json:"error_message,omitempty"`
	RecordCount        int             `json:"record_count,omitempty"`
	FileSizeBytes      int64           `json:"file_size_bytes,omitempty"`
	FileKey            string          `gorm:"type:varchar(1000)" json:"file_key,omitempty"`
	DownloadURL        string          `gorm:"type:text" json:"download_url,omitempty"`
	DeliveryStatus     datatypes.JSON  `gorm:"type:jsonb" json:"delivery_status,omitempty"`
	Parameters         datatypes.JSON  `gorm:"type:jsonb" json:"parameters,omitempty"`
	ExecutionLog       string          `gorm:"type:text" json:"execution_log,omitempty"`
	CreatedAt          time.Time       `gorm:"autoCreateTime" json:"created_at"`

	// Associations
	ReportDefinition *ReportDefinition `gorm:"foreignKey:ReportDefinitionID" json:"report_definition,omitempty"`
	Schedule         *ReportSchedule   `gorm:"foreignKey:ScheduleID" json:"schedule,omitempty"`
}

// TableName specifies the table name for GORM
func (ReportExecution) TableName() string {
	return "report_executions"
}

// BenchmarkDataset represents industry benchmark data
type BenchmarkDataset struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name            string         `gorm:"type:varchar(255);not null" json:"name"`
	Description     string         `gorm:"type:text" json:"description,omitempty"`
	Category        string         `gorm:"type:varchar(100);not null" json:"category"`
	Methodology     string         `gorm:"type:varchar(100)" json:"methodology,omitempty"`
	Region          string         `gorm:"type:varchar(100)" json:"region,omitempty"`
	Data            datatypes.JSON `gorm:"type:jsonb;not null" json:"data"`
	Year            int            `gorm:"not null" json:"year"`
	Source          string         `gorm:"type:varchar(255)" json:"source,omitempty"`
	ConfidenceScore float64        `gorm:"type:decimal(3,2)" json:"confidence_score,omitempty"`
	IsActive        bool           `gorm:"default:true" json:"is_active"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName specifies the table name for GORM
func (BenchmarkDataset) TableName() string {
	return "benchmark_datasets"
}

// BenchmarkData represents the structure of benchmark data
type BenchmarkData struct {
	Metric      string  `json:"metric"`
	Value       float64 `json:"value"`
	Unit        string  `json:"unit"`
	Percentile  float64 `json:"percentile,omitempty"`
	SampleSize  int     `json:"sample_size,omitempty"`
	LowerBound  float64 `json:"lower_bound,omitempty"`
	UpperBound  float64 `json:"upper_bound,omitempty"`
	Description string  `json:"description,omitempty"`
}

// DashboardWidget represents a configured dashboard widget
type DashboardWidget struct {
	ID                     uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID                 *uuid.UUID     `gorm:"type:uuid" json:"user_id,omitempty"`
	DashboardSection       string         `gorm:"type:varchar(100)" json:"dashboard_section,omitempty"`
	WidgetType             WidgetType     `gorm:"type:varchar(50);not null" json:"widget_type"`
	Title                  string         `gorm:"type:varchar(255);not null" json:"title"`
	Config                 datatypes.JSON `gorm:"type:jsonb;not null" json:"config"`
	Size                   WidgetSize     `gorm:"type:varchar(20);default:'medium'" json:"size"`
	Position               int            `json:"position"`
	RefreshIntervalSeconds int            `gorm:"default:300" json:"refresh_interval_seconds"`
	LastRefreshedAt        *time.Time     `json:"last_refreshed_at,omitempty"`
	CreatedAt              time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt              time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName specifies the table name for GORM
func (DashboardWidget) TableName() string {
	return "dashboard_widgets"
}

// WidgetConfig represents widget-specific configuration
type WidgetConfig struct {
	// Common fields
	DataSource   string            `json:"data_source"`
	RefreshRate  int               `json:"refresh_rate,omitempty"`
	Filters      []FilterConfig    `json:"filters,omitempty"`
	ColorScheme  string            `json:"color_scheme,omitempty"`
	ShowLegend   bool              `json:"show_legend,omitempty"`
	CustomStyles map[string]string `json:"custom_styles,omitempty"`

	// Chart-specific
	ChartType      string   `json:"chart_type,omitempty"` // line, bar, pie, area, scatter
	XAxis          string   `json:"x_axis,omitempty"`
	YAxis          []string `json:"y_axis,omitempty"`
	Stacked        bool     `json:"stacked,omitempty"`
	ShowDataLabels bool     `json:"show_data_labels,omitempty"`

	// Metric-specific
	MetricField   string `json:"metric_field,omitempty"`
	CompareField  string `json:"compare_field,omitempty"`
	TrendPeriod   string `json:"trend_period,omitempty"` // 7d, 30d, 90d
	DisplayFormat string `json:"display_format,omitempty"`
	Prefix        string `json:"prefix,omitempty"`
	Suffix        string `json:"suffix,omitempty"`

	// Gauge-specific
	MinValue   float64 `json:"min_value,omitempty"`
	MaxValue   float64 `json:"max_value,omitempty"`
	Thresholds []struct {
		Value float64 `json:"value"`
		Color string  `json:"color"`
		Label string  `json:"label,omitempty"`
	} `json:"thresholds,omitempty"`

	// Table-specific
	Columns    []FieldConfig `json:"columns,omitempty"`
	PageSize   int           `json:"page_size,omitempty"`
	Sortable   bool          `json:"sortable,omitempty"`
	Searchable bool          `json:"searchable,omitempty"`
}

// ========== Request/Response Types ==========

// CreateReportRequest represents the request to create a report
type CreateReportRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description,omitempty"`
	Category    ReportCategory   `json:"category,omitempty"`
	Config      ReportConfig     `json:"config" binding:"required"`
	Visibility  ReportVisibility `json:"visibility,omitempty"`
	IsTemplate  bool             `json:"is_template,omitempty"`
}

// UpdateReportRequest represents the request to update a report
type UpdateReportRequest struct {
	Name        string           `json:"name,omitempty"`
	Description string           `json:"description,omitempty"`
	Category    ReportCategory   `json:"category,omitempty"`
	Config      *ReportConfig    `json:"config,omitempty"`
	Visibility  ReportVisibility `json:"visibility,omitempty"`
}

// ExecuteReportRequest represents the request to execute a report
type ExecuteReportRequest struct {
	Format     ExportFormat   `json:"format,omitempty"`
	Parameters map[string]any `json:"parameters,omitempty"`
}

// CreateScheduleRequest represents the request to create a schedule
type CreateScheduleRequest struct {
	ReportDefinitionID uuid.UUID      `json:"report_definition_id" binding:"required"`
	Name               string         `json:"name" binding:"required"`
	CronExpression     string         `json:"cron_expression" binding:"required"`
	Timezone           string         `json:"timezone,omitempty"`
	StartDate          *time.Time     `json:"start_date,omitempty"`
	EndDate            *time.Time     `json:"end_date,omitempty"`
	Format             ExportFormat   `json:"format" binding:"required"`
	DeliveryMethod     DeliveryMethod `json:"delivery_method" binding:"required"`
	DeliveryConfig     map[string]any `json:"delivery_config" binding:"required"`
	RecipientEmails    []string       `json:"recipient_emails,omitempty"`
	RecipientUserIDs   []uuid.UUID    `json:"recipient_user_ids,omitempty"`
	WebhookURL         string         `json:"webhook_url,omitempty"`
}

// BenchmarkComparisonRequest represents the request for benchmark comparison
type BenchmarkComparisonRequest struct {
	ProjectID   uuid.UUID `json:"project_id" binding:"required"`
	Category    string    `json:"category" binding:"required"`
	Methodology string    `json:"methodology,omitempty"`
	Region      string    `json:"region,omitempty"`
	Year        int       `json:"year,omitempty"`
}

// BenchmarkComparisonResponse represents the benchmark comparison result
type BenchmarkComparisonResponse struct {
	ProjectID      uuid.UUID           `json:"project_id"`
	ProjectMetrics map[string]float64  `json:"project_metrics"`
	Benchmarks     []BenchmarkResult   `json:"benchmarks"`
	PercentileRank map[string]float64  `json:"percentile_rank"`
	GapAnalysis    []GapAnalysisResult `json:"gap_analysis"`
}

// BenchmarkResult represents a single benchmark comparison
type BenchmarkResult struct {
	Metric            string  `json:"metric"`
	ProjectValue      float64 `json:"project_value"`
	BenchmarkValue    float64 `json:"benchmark_value"`
	Difference        float64 `json:"difference"`
	DifferencePercent float64 `json:"difference_percent"`
	PerformanceLevel  string  `json:"performance_level"` // above, at, below
}

// GapAnalysisResult represents a gap in performance
type GapAnalysisResult struct {
	Metric         string  `json:"metric"`
	Gap            float64 `json:"gap"`
	Priority       string  `json:"priority"` // high, medium, low
	Recommendation string  `json:"recommendation"`
}

// DashboardSummary represents aggregated dashboard data
type DashboardSummary struct {
	TotalProjects         int                          `json:"total_projects"`
	TotalCredits          float64                      `json:"total_credits"`
	TotalRevenue          float64                      `json:"total_revenue"`
	ActiveMonitoringAreas int                          `json:"active_monitoring_areas"`
	RecentActivity        []ActivityItem               `json:"recent_activity"`
	PerformanceMetrics    map[string]MetricSummary     `json:"performance_metrics"`
	TimeSeriesData        map[string][]TimeSeriesPoint `json:"time_series_data,omitempty"`
}

// MetricSummary represents a summary metric
type MetricSummary struct {
	Value         float64 `json:"value"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"change_percent"`
	Period        string  `json:"period"`
	Trend         string  `json:"trend"` // up, down, stable
}

// TimeSeriesPoint represents a data point in time series
type TimeSeriesPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
	Label string    `json:"label,omitempty"`
}

// ActivityItem represents a recent activity
type ActivityItem struct {
	ID          uuid.UUID `json:"id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	UserID      uuid.UUID `json:"user_id,omitempty"`
	EntityID    uuid.UUID `json:"entity_id,omitempty"`
	EntityType  string    `json:"entity_type,omitempty"`
}

// DatasetMetadata represents available dataset information
type DatasetMetadata struct {
	Name        string          `json:"name"`
	DisplayName string          `json:"display_name"`
	Description string          `json:"description"`
	Fields      []FieldMetadata `json:"fields"`
	JoinWith    []string        `json:"join_with,omitempty"`
}

// FieldMetadata represents metadata for a dataset field
type FieldMetadata struct {
	Name           string   `json:"name"`
	DisplayName    string   `json:"display_name"`
	DataType       string   `json:"data_type"` // string, number, date, boolean
	IsAggregatable bool     `json:"is_aggregatable"`
	IsFilterable   bool     `json:"is_filterable"`
	IsGroupable    bool     `json:"is_groupable"`
	AllowedValues  []string `json:"allowed_values,omitempty"`
}

// ListReportsResponse represents the response for listing reports
type ListReportsResponse struct {
	Reports    []ReportDefinition `json:"reports"`
	Total      int64              `json:"total"`
	Page       int                `json:"page"`
	PageSize   int                `json:"page_size"`
	TotalPages int                `json:"total_pages"`
}

// ListExecutionsResponse represents the response for listing executions
type ListExecutionsResponse struct {
	Executions []ReportExecution `json:"executions"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}
