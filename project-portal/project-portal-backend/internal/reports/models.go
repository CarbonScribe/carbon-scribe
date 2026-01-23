package reports

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// =====================================================
// Enums and Constants
// =====================================================

// ReportCategory represents the category of a report
type ReportCategory string

const (
	ReportCategoryFinancial   ReportCategory = "financial"
	ReportCategoryOperational ReportCategory = "operational"
	ReportCategoryCompliance  ReportCategory = "compliance"
	ReportCategoryCustom      ReportCategory = "custom"
)

// ReportVisibility represents the visibility of a report
type ReportVisibility string

const (
	ReportVisibilityPrivate ReportVisibility = "private"
	ReportVisibilityShared  ReportVisibility = "shared"
	ReportVisibilityPublic  ReportVisibility = "public"
)

// ExportFormat represents supported export formats
type ExportFormat string

const (
	ExportFormatCSV   ExportFormat = "csv"
	ExportFormatExcel ExportFormat = "excel"
	ExportFormatPDF   ExportFormat = "pdf"
	ExportFormatJSON  ExportFormat = "json"
)

// DeliveryMethod represents report delivery methods
type DeliveryMethod string

const (
	DeliveryMethodEmail        DeliveryMethod = "email"
	DeliveryMethodS3           DeliveryMethod = "s3"
	DeliveryMethodWebhook      DeliveryMethod = "webhook"
	DeliveryMethodNotification DeliveryMethod = "notification"
)

// ExecutionStatus represents the status of a report execution
type ExecutionStatus string

const (
	ExecutionStatusPending    ExecutionStatus = "pending"
	ExecutionStatusProcessing ExecutionStatus = "processing"
	ExecutionStatusCompleted  ExecutionStatus = "completed"
	ExecutionStatusFailed     ExecutionStatus = "failed"
	ExecutionStatusCancelled  ExecutionStatus = "cancelled"
)

// WidgetType represents dashboard widget types
type WidgetType string

const (
	WidgetTypeChart    WidgetType = "chart"
	WidgetTypeMetric   WidgetType = "metric"
	WidgetTypeTable    WidgetType = "table"
	WidgetTypeGauge    WidgetType = "gauge"
	WidgetTypeMap      WidgetType = "map"
	WidgetTypeTimeline WidgetType = "timeline"
)

// WidgetSize represents dashboard widget sizes
type WidgetSize string

const (
	WidgetSizeSmall  WidgetSize = "small"
	WidgetSizeMedium WidgetSize = "medium"
	WidgetSizeLarge  WidgetSize = "large"
	WidgetSizeFull   WidgetSize = "full"
)

// AggregateFunction represents SQL aggregate functions
type AggregateFunction string

const (
	AggregateFunctionSum   AggregateFunction = "SUM"
	AggregateFunctionAvg   AggregateFunction = "AVG"
	AggregateFunctionCount AggregateFunction = "COUNT"
	AggregateFunctionMin   AggregateFunction = "MIN"
	AggregateFunctionMax   AggregateFunction = "MAX"
)

// PeriodType represents time period types for aggregation
type PeriodType string

const (
	PeriodTypeDaily     PeriodType = "daily"
	PeriodTypeWeekly    PeriodType = "weekly"
	PeriodTypeMonthly   PeriodType = "monthly"
	PeriodTypeQuarterly PeriodType = "quarterly"
	PeriodTypeYearly    PeriodType = "yearly"
	PeriodTypeAllTime   PeriodType = "all_time"
)

// BenchmarkCategory represents benchmark categories
type BenchmarkCategory string

const (
	BenchmarkCategoryCarbonSequestration BenchmarkCategory = "carbon_sequestration"
	BenchmarkCategoryRevenue             BenchmarkCategory = "revenue"
	BenchmarkCategoryCostEfficiency      BenchmarkCategory = "cost_efficiency"
	BenchmarkCategoryVerificationTime    BenchmarkCategory = "verification_time"
)

// =====================================================
// JSON Types for JSONB columns
// =====================================================

// JSONB is a wrapper for JSONB columns
type JSONB map[string]interface{}

// Value implements driver.Valuer
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements sql.Scanner
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

// =====================================================
// Report Configuration Types
// =====================================================

// ReportConfig represents the JSON configuration for a report
type ReportConfig struct {
	Dataset          string              `json:"dataset"`
	Fields           []ReportField       `json:"fields"`
	Filters          []ReportFilter      `json:"filters"`
	Groupings        []ReportGrouping    `json:"groupings"`
	Sorts            []ReportSort        `json:"sorts"`
	CalculatedFields []CalculatedField   `json:"calculated_fields,omitempty"`
	Limit            *int                `json:"limit,omitempty"`
	DistinctOn       []string            `json:"distinct_on,omitempty"`
	Options          ReportConfigOptions `json:"options,omitempty"`
}

// ReportField represents a field to include in the report
type ReportField struct {
	Name       string             `json:"name"`
	Alias      string             `json:"alias,omitempty"`
	Aggregate  *AggregateFunction `json:"aggregate,omitempty"`
	Format     string             `json:"format,omitempty"`
	IsVisible  bool               `json:"is_visible"`
	SortOrder  *int               `json:"sort_order,omitempty"`
	Width      *int               `json:"width,omitempty"`
}

// ReportFilter represents a filter condition
type ReportFilter struct {
	Field    string        `json:"field"`
	Operator FilterOperator `json:"operator"`
	Value    interface{}   `json:"value"`
	Logic    FilterLogic   `json:"logic,omitempty"` // AND, OR
}

// FilterOperator represents filter comparison operators
type FilterOperator string

const (
	FilterOperatorEquals           FilterOperator = "eq"
	FilterOperatorNotEquals        FilterOperator = "neq"
	FilterOperatorGreaterThan      FilterOperator = "gt"
	FilterOperatorGreaterThanEqual FilterOperator = "gte"
	FilterOperatorLessThan         FilterOperator = "lt"
	FilterOperatorLessThanEqual    FilterOperator = "lte"
	FilterOperatorContains         FilterOperator = "contains"
	FilterOperatorStartsWith       FilterOperator = "starts_with"
	FilterOperatorEndsWith         FilterOperator = "ends_with"
	FilterOperatorIn               FilterOperator = "in"
	FilterOperatorNotIn            FilterOperator = "not_in"
	FilterOperatorBetween          FilterOperator = "between"
	FilterOperatorIsNull           FilterOperator = "is_null"
	FilterOperatorIsNotNull        FilterOperator = "is_not_null"
)

// FilterLogic represents logical operators for combining filters
type FilterLogic string

const (
	FilterLogicAnd FilterLogic = "AND"
	FilterLogicOr  FilterLogic = "OR"
)

// ReportGrouping represents a grouping configuration
type ReportGrouping struct {
	Field     string `json:"field"`
	SortOrder int    `json:"sort_order"`
}

// ReportSort represents a sort configuration
type ReportSort struct {
	Field     string `json:"field"`
	Direction string `json:"direction"` // "asc" or "desc"
}

// CalculatedField represents a derived/calculated field
type CalculatedField struct {
	Name       string `json:"name"`
	Expression string `json:"expression"` // e.g., "field1 / field2 * 100"
	Format     string `json:"format,omitempty"`
	Label      string `json:"label"`
}

// ReportConfigOptions represents additional report options
type ReportConfigOptions struct {
	DateFormat      string `json:"date_format,omitempty"`
	NumberFormat    string `json:"number_format,omitempty"`
	CurrencyFormat  string `json:"currency_format,omitempty"`
	Locale          string `json:"locale,omitempty"`
	IncludeHeaders  bool   `json:"include_headers"`
	IncludeSummary  bool   `json:"include_summary"`
	IncludeCharts   bool   `json:"include_charts"`
	PageSize        string `json:"page_size,omitempty"` // For PDF: "A4", "Letter", etc.
	PageOrientation string `json:"page_orientation,omitempty"` // "portrait" or "landscape"
}

// =====================================================
// Core Models
// =====================================================

// ReportDefinition represents a saved report configuration
type ReportDefinition struct {
	ID                uuid.UUID        `json:"id" db:"id"`
	Name              string           `json:"name" db:"name"`
	Description       *string          `json:"description,omitempty" db:"description"`
	Category          ReportCategory   `json:"category" db:"category"`
	Config            ReportConfig     `json:"config" db:"config"`
	CreatedBy         *uuid.UUID       `json:"created_by,omitempty" db:"created_by"`
	Visibility        ReportVisibility `json:"visibility" db:"visibility"`
	SharedWithUsers   pq.StringArray   `json:"shared_with_users,omitempty" db:"shared_with_users"`
	SharedWithRoles   pq.StringArray   `json:"shared_with_roles,omitempty" db:"shared_with_roles"`
	Version           int              `json:"version" db:"version"`
	IsTemplate        bool             `json:"is_template" db:"is_template"`
	BasedOnTemplateID *uuid.UUID       `json:"based_on_template_id,omitempty" db:"based_on_template_id"`
	CreatedAt         time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at" db:"updated_at"`
}

// ReportSchedule represents a scheduled report configuration
type ReportSchedule struct {
	ID                   uuid.UUID      `json:"id" db:"id"`
	ReportDefinitionID   uuid.UUID      `json:"report_definition_id" db:"report_definition_id"`
	Name                 string         `json:"name" db:"name"`
	CronExpression       string         `json:"cron_expression" db:"cron_expression"`
	Timezone             string         `json:"timezone" db:"timezone"`
	StartDate            *time.Time     `json:"start_date,omitempty" db:"start_date"`
	EndDate              *time.Time     `json:"end_date,omitempty" db:"end_date"`
	IsActive             bool           `json:"is_active" db:"is_active"`
	Format               ExportFormat   `json:"format" db:"format"`
	DeliveryMethod       DeliveryMethod `json:"delivery_method" db:"delivery_method"`
	DeliveryConfig       JSONB          `json:"delivery_config" db:"delivery_config"`
	RecipientEmails      pq.StringArray `json:"recipient_emails,omitempty" db:"recipient_emails"`
	RecipientUserIDs     pq.StringArray `json:"recipient_user_ids,omitempty" db:"recipient_user_ids"`
	WebhookURL           *string        `json:"webhook_url,omitempty" db:"webhook_url"`
	LastExecutedAt       *time.Time     `json:"last_executed_at,omitempty" db:"last_executed_at"`
	NextExecutionAt      *time.Time     `json:"next_execution_at,omitempty" db:"next_execution_at"`
	ExecutionCount       int            `json:"execution_count" db:"execution_count"`
	CreatedBy            *uuid.UUID     `json:"created_by,omitempty" db:"created_by"`
	CreatedAt            time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at" db:"updated_at"`
}

// ReportExecution represents a single report execution
type ReportExecution struct {
	ID                 uuid.UUID       `json:"id" db:"id"`
	ReportDefinitionID uuid.UUID       `json:"report_definition_id" db:"report_definition_id"`
	ScheduleID         *uuid.UUID      `json:"schedule_id,omitempty" db:"schedule_id"`
	TriggeredBy        *uuid.UUID      `json:"triggered_by,omitempty" db:"triggered_by"`
	TriggeredAt        time.Time       `json:"triggered_at" db:"triggered_at"`
	StartedAt          *time.Time      `json:"started_at,omitempty" db:"started_at"`
	CompletedAt        *time.Time      `json:"completed_at,omitempty" db:"completed_at"`
	Status             ExecutionStatus `json:"status" db:"status"`
	ErrorMessage       *string         `json:"error_message,omitempty" db:"error_message"`
	RecordCount        *int            `json:"record_count,omitempty" db:"record_count"`
	FileSizeBytes      *int64          `json:"file_size_bytes,omitempty" db:"file_size_bytes"`
	FileKey            *string         `json:"file_key,omitempty" db:"file_key"`
	DownloadURL        *string         `json:"download_url,omitempty" db:"download_url"`
	DownloadURLExpiresAt *time.Time    `json:"download_url_expires_at,omitempty" db:"download_url_expires_at"`
	DeliveryStatus     JSONB           `json:"delivery_status,omitempty" db:"delivery_status"`
	Parameters         JSONB           `json:"parameters,omitempty" db:"parameters"`
	ExecutionLog       *string         `json:"execution_log,omitempty" db:"execution_log"`
	DurationMs         *int            `json:"duration_ms,omitempty" db:"duration_ms"`
	CreatedAt          time.Time       `json:"created_at" db:"created_at"`
}

// BenchmarkDataset represents benchmark data for comparison
type BenchmarkDataset struct {
	ID                   uuid.UUID         `json:"id" db:"id"`
	Name                 string            `json:"name" db:"name"`
	Description          *string           `json:"description,omitempty" db:"description"`
	Category             BenchmarkCategory `json:"category" db:"category"`
	Methodology          *string           `json:"methodology,omitempty" db:"methodology"`
	Region               *string           `json:"region,omitempty" db:"region"`
	Data                 JSONB             `json:"data" db:"data"`
	Statistics           JSONB             `json:"statistics,omitempty" db:"statistics"`
	Year                 int               `json:"year" db:"year"`
	Quarter              *int              `json:"quarter,omitempty" db:"quarter"`
	Source               *string           `json:"source,omitempty" db:"source"`
	SourceURL            *string           `json:"source_url,omitempty" db:"source_url"`
	ConfidenceScore      *float64          `json:"confidence_score,omitempty" db:"confidence_score"`
	SampleSize           *int              `json:"sample_size,omitempty" db:"sample_size"`
	DataCollectionMethod *string           `json:"data_collection_method,omitempty" db:"data_collection_method"`
	IsActive             bool              `json:"is_active" db:"is_active"`
	CreatedBy            *uuid.UUID        `json:"created_by,omitempty" db:"created_by"`
	CreatedAt            time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at" db:"updated_at"`
}

// DashboardWidget represents a user's dashboard widget configuration
type DashboardWidget struct {
	ID                     uuid.UUID  `json:"id" db:"id"`
	UserID                 uuid.UUID  `json:"user_id" db:"user_id"`
	DashboardSection       string     `json:"dashboard_section" db:"dashboard_section"`
	WidgetType             WidgetType `json:"widget_type" db:"widget_type"`
	Title                  string     `json:"title" db:"title"`
	Subtitle               *string    `json:"subtitle,omitempty" db:"subtitle"`
	Config                 JSONB      `json:"config" db:"config"`
	Size                   WidgetSize `json:"size" db:"size"`
	Position               int        `json:"position" db:"position"`
	RowSpan                int        `json:"row_span" db:"row_span"`
	ColSpan                int        `json:"col_span" db:"col_span"`
	RefreshIntervalSeconds int        `json:"refresh_interval_seconds" db:"refresh_interval_seconds"`
	LastRefreshedAt        *time.Time `json:"last_refreshed_at,omitempty" db:"last_refreshed_at"`
	CachedData             JSONB      `json:"cached_data,omitempty" db:"cached_data"`
	IsVisible              bool       `json:"is_visible" db:"is_visible"`
	CreatedAt              time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at" db:"updated_at"`
}

// DashboardAggregate represents pre-computed dashboard aggregates
type DashboardAggregate struct {
	ID                  uuid.UUID  `json:"id" db:"id"`
	AggregateKey        string     `json:"aggregate_key" db:"aggregate_key"`
	AggregateType       string     `json:"aggregate_type" db:"aggregate_type"`
	ProjectID           *uuid.UUID `json:"project_id,omitempty" db:"project_id"`
	UserID              *uuid.UUID `json:"user_id,omitempty" db:"user_id"`
	OrganizationID      *uuid.UUID `json:"organization_id,omitempty" db:"organization_id"`
	PeriodType          PeriodType `json:"period_type" db:"period_type"`
	PeriodStart         *time.Time `json:"period_start,omitempty" db:"period_start"`
	PeriodEnd           *time.Time `json:"period_end,omitempty" db:"period_end"`
	Data                JSONB      `json:"data" db:"data"`
	SourceRecordCount   *int       `json:"source_record_count,omitempty" db:"source_record_count"`
	LastSourceUpdateAt  *time.Time `json:"last_source_update_at,omitempty" db:"last_source_update_at"`
	ComputedAt          time.Time  `json:"computed_at" db:"computed_at"`
	IsStale             bool       `json:"is_stale" db:"is_stale"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

// ReportDataSource represents available data sources for reports
type ReportDataSource struct {
	ID                  uuid.UUID      `json:"id" db:"id"`
	Name                string         `json:"name" db:"name"`
	DisplayName         string         `json:"display_name" db:"display_name"`
	Description         *string        `json:"description,omitempty" db:"description"`
	SchemaDefinition    JSONB          `json:"schema_definition" db:"schema_definition"`
	SourceType          string         `json:"source_type" db:"source_type"`
	SourceConfig        JSONB          `json:"source_config" db:"source_config"`
	RequiredPermissions pq.StringArray `json:"required_permissions,omitempty" db:"required_permissions"`
	SupportsStreaming   bool           `json:"supports_streaming" db:"supports_streaming"`
	MaxRecords          *int           `json:"max_records,omitempty" db:"max_records"`
	EstimatedRowCount   *int64         `json:"estimated_row_count,omitempty" db:"estimated_row_count"`
	IsActive            bool           `json:"is_active" db:"is_active"`
	CreatedAt           time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at" db:"updated_at"`
}

// =====================================================
// Request/Response Types
// =====================================================

// CreateReportRequest represents the request to create a report
type CreateReportRequest struct {
	Name              string           `json:"name" binding:"required,min=1,max=255"`
	Description       *string          `json:"description,omitempty"`
	Category          ReportCategory   `json:"category" binding:"required"`
	Config            ReportConfig     `json:"config" binding:"required"`
	Visibility        ReportVisibility `json:"visibility,omitempty"`
	SharedWithUsers   []uuid.UUID      `json:"shared_with_users,omitempty"`
	SharedWithRoles   []string         `json:"shared_with_roles,omitempty"`
	IsTemplate        bool             `json:"is_template,omitempty"`
	BasedOnTemplateID *uuid.UUID       `json:"based_on_template_id,omitempty"`
}

// UpdateReportRequest represents the request to update a report
type UpdateReportRequest struct {
	Name            *string          `json:"name,omitempty"`
	Description     *string          `json:"description,omitempty"`
	Category        *ReportCategory  `json:"category,omitempty"`
	Config          *ReportConfig    `json:"config,omitempty"`
	Visibility      *ReportVisibility `json:"visibility,omitempty"`
	SharedWithUsers []uuid.UUID      `json:"shared_with_users,omitempty"`
	SharedWithRoles []string         `json:"shared_with_roles,omitempty"`
}

// ExecuteReportRequest represents the request to execute a report
type ExecuteReportRequest struct {
	Format     ExportFormat   `json:"format" binding:"required"`
	Parameters JSONB          `json:"parameters,omitempty"`
	Filters    []ReportFilter `json:"filters,omitempty"` // Additional runtime filters
	Async      bool           `json:"async,omitempty"`
}

// ExportReportRequest represents the request to export a report
type ExportReportRequest struct {
	Format            ExportFormat `json:"format" binding:"required"`
	DateFormat        string       `json:"date_format,omitempty"`
	NumberFormat      string       `json:"number_format,omitempty"`
	Locale            string       `json:"locale,omitempty"`
	IncludeHeaders    bool         `json:"include_headers"`
	Compress          bool         `json:"compress,omitempty"`
	MaxRecords        *int         `json:"max_records,omitempty"`
}

// CreateScheduleRequest represents the request to create a scheduled report
type CreateScheduleRequest struct {
	ReportDefinitionID uuid.UUID      `json:"report_definition_id" binding:"required"`
	Name               string         `json:"name" binding:"required,min=1,max=255"`
	CronExpression     string         `json:"cron_expression" binding:"required"`
	Timezone           string         `json:"timezone,omitempty"`
	StartDate          *time.Time     `json:"start_date,omitempty"`
	EndDate            *time.Time     `json:"end_date,omitempty"`
	Format             ExportFormat   `json:"format" binding:"required"`
	DeliveryMethod     DeliveryMethod `json:"delivery_method" binding:"required"`
	DeliveryConfig     JSONB          `json:"delivery_config" binding:"required"`
	RecipientEmails    []string       `json:"recipient_emails,omitempty"`
	RecipientUserIDs   []uuid.UUID    `json:"recipient_user_ids,omitempty"`
	WebhookURL         *string        `json:"webhook_url,omitempty"`
}

// UpdateScheduleRequest represents the request to update a schedule
type UpdateScheduleRequest struct {
	Name            *string         `json:"name,omitempty"`
	CronExpression  *string         `json:"cron_expression,omitempty"`
	Timezone        *string         `json:"timezone,omitempty"`
	StartDate       *time.Time      `json:"start_date,omitempty"`
	EndDate         *time.Time      `json:"end_date,omitempty"`
	IsActive        *bool           `json:"is_active,omitempty"`
	Format          *ExportFormat   `json:"format,omitempty"`
	DeliveryMethod  *DeliveryMethod `json:"delivery_method,omitempty"`
	DeliveryConfig  JSONB           `json:"delivery_config,omitempty"`
	RecipientEmails []string        `json:"recipient_emails,omitempty"`
	RecipientUserIDs []uuid.UUID    `json:"recipient_user_ids,omitempty"`
	WebhookURL      *string         `json:"webhook_url,omitempty"`
}

// BenchmarkComparisonRequest represents the request to compare against benchmarks
type BenchmarkComparisonRequest struct {
	ProjectID   uuid.UUID         `json:"project_id" binding:"required"`
	Category    BenchmarkCategory `json:"category" binding:"required"`
	Methodology *string           `json:"methodology,omitempty"`
	Region      *string           `json:"region,omitempty"`
	Year        *int              `json:"year,omitempty"`
	Metrics     []string          `json:"metrics,omitempty"` // Specific metrics to compare
}

// DashboardSummaryRequest represents the request for dashboard summary data
type DashboardSummaryRequest struct {
	ProjectID  *uuid.UUID `json:"project_id,omitempty"`
	PeriodType PeriodType `json:"period_type,omitempty"`
	StartDate  *time.Time `json:"start_date,omitempty"`
	EndDate    *time.Time `json:"end_date,omitempty"`
	Metrics    []string   `json:"metrics,omitempty"` // Specific metrics to include
}

// WidgetDataRequest represents the request for widget data
type WidgetDataRequest struct {
	WidgetID   uuid.UUID  `json:"widget_id" binding:"required"`
	StartDate  *time.Time `json:"start_date,omitempty"`
	EndDate    *time.Time `json:"end_date,omitempty"`
	ForceRefresh bool     `json:"force_refresh,omitempty"`
}

// =====================================================
// Response Types
// =====================================================

// ReportListResponse represents the response for listing reports
type ReportListResponse struct {
	Reports    []*ReportDefinition `json:"reports"`
	TotalCount int                 `json:"total_count"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"page_size"`
	HasMore    bool                `json:"has_more"`
}

// ExecutionResponse represents the response for report execution
type ExecutionResponse struct {
	ExecutionID uuid.UUID       `json:"execution_id"`
	Status      ExecutionStatus `json:"status"`
	Message     string          `json:"message,omitempty"`
	DownloadURL *string         `json:"download_url,omitempty"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty"`
	RecordCount *int            `json:"record_count,omitempty"`
	FileSizeBytes *int64        `json:"file_size_bytes,omitempty"`
}

// DashboardSummaryResponse represents the response for dashboard summary
type DashboardSummaryResponse struct {
	Summary     DashboardSummary `json:"summary"`
	Trends      []TrendData      `json:"trends,omitempty"`
	ComputedAt  time.Time        `json:"computed_at"`
	NextRefresh time.Time        `json:"next_refresh"`
}

// DashboardSummary contains aggregated dashboard metrics
type DashboardSummary struct {
	TotalProjects        int     `json:"total_projects"`
	ActiveProjects       int     `json:"active_projects"`
	TotalCreditsIssued   float64 `json:"total_credits_issued"`
	TotalCreditsRetired  float64 `json:"total_credits_retired"`
	TotalRevenue         float64 `json:"total_revenue"`
	AverageNDVI          float64 `json:"average_ndvi"`
	ActiveAlerts         int     `json:"active_alerts"`
	PendingVerifications int     `json:"pending_verifications"`
	ProjectsByStatus     map[string]int `json:"projects_by_status"`
	RevenueByMonth       map[string]float64 `json:"revenue_by_month"`
}

// TrendData represents time-series trend data
type TrendData struct {
	MetricName string    `json:"metric_name"`
	Values     []float64 `json:"values"`
	Labels     []string  `json:"labels"`
	Unit       string    `json:"unit,omitempty"`
	Change     float64   `json:"change"`      // Percentage change
	Direction  string    `json:"direction"`   // "up", "down", "stable"
}

// BenchmarkComparisonResponse represents the benchmark comparison response
type BenchmarkComparisonResponse struct {
	ProjectMetrics    map[string]float64        `json:"project_metrics"`
	BenchmarkMetrics  map[string]BenchmarkValue `json:"benchmark_metrics"`
	PercentileRanking map[string]float64        `json:"percentile_ranking"`
	GapAnalysis       []GapItem                 `json:"gap_analysis"`
	Recommendations   []string                  `json:"recommendations,omitempty"`
	ComputedAt        time.Time                 `json:"computed_at"`
}

// BenchmarkValue represents a single benchmark value with statistics
type BenchmarkValue struct {
	Mean       float64 `json:"mean"`
	Median     float64 `json:"median"`
	Min        float64 `json:"min"`
	Max        float64 `json:"max"`
	P25        float64 `json:"p25"`
	P75        float64 `json:"p75"`
	P90        float64 `json:"p90"`
	StdDev     float64 `json:"std_dev"`
	SampleSize int     `json:"sample_size"`
	Unit       string  `json:"unit"`
}

// GapItem represents a gap analysis item
type GapItem struct {
	Metric        string  `json:"metric"`
	CurrentValue  float64 `json:"current_value"`
	TargetValue   float64 `json:"target_value"` // Benchmark median or target percentile
	Gap           float64 `json:"gap"`
	GapPercentage float64 `json:"gap_percentage"`
	Priority      string  `json:"priority"` // "high", "medium", "low"
}

// DataSourceFieldInfo represents field information from a data source
type DataSourceFieldInfo struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
	Nullable    bool   `json:"nullable"`
	Filterable  bool   `json:"filterable"`
	Sortable    bool   `json:"sortable"`
	Groupable   bool   `json:"groupable"`
	Aggregatable bool  `json:"aggregatable"`
}

// DataSourceResponse represents information about a data source
type DataSourceResponse struct {
	Name          string                `json:"name"`
	DisplayName   string                `json:"display_name"`
	Description   string                `json:"description,omitempty"`
	Fields        []DataSourceFieldInfo `json:"fields"`
	SupportsStreaming bool              `json:"supports_streaming"`
	EstimatedRows int64                 `json:"estimated_rows,omitempty"`
}

// =====================================================
// Filter Types
// =====================================================

// ReportFilters represents filters for listing reports
type ReportFilters struct {
	Category    *ReportCategory   `json:"category,omitempty"`
	Visibility  *ReportVisibility `json:"visibility,omitempty"`
	CreatedBy   *uuid.UUID        `json:"created_by,omitempty"`
	IsTemplate  *bool             `json:"is_template,omitempty"`
	SearchTerm  *string           `json:"search_term,omitempty"`
	CreatedAfter  *time.Time      `json:"created_after,omitempty"`
	CreatedBefore *time.Time      `json:"created_before,omitempty"`
	Page        int               `json:"page"`
	PageSize    int               `json:"page_size"`
}

// ScheduleFilters represents filters for listing schedules
type ScheduleFilters struct {
	ReportDefinitionID *uuid.UUID      `json:"report_definition_id,omitempty"`
	IsActive           *bool           `json:"is_active,omitempty"`
	DeliveryMethod     *DeliveryMethod `json:"delivery_method,omitempty"`
	CreatedBy          *uuid.UUID      `json:"created_by,omitempty"`
	Page               int             `json:"page"`
	PageSize           int             `json:"page_size"`
}

// ExecutionFilters represents filters for listing executions
type ExecutionFilters struct {
	ReportDefinitionID *uuid.UUID       `json:"report_definition_id,omitempty"`
	ScheduleID         *uuid.UUID       `json:"schedule_id,omitempty"`
	Status             *ExecutionStatus `json:"status,omitempty"`
	TriggeredBy        *uuid.UUID       `json:"triggered_by,omitempty"`
	TriggeredAfter     *time.Time       `json:"triggered_after,omitempty"`
	TriggeredBefore    *time.Time       `json:"triggered_before,omitempty"`
	Page               int              `json:"page"`
	PageSize           int              `json:"page_size"`
}

// BenchmarkFilters represents filters for listing benchmarks
type BenchmarkFilters struct {
	Category    *BenchmarkCategory `json:"category,omitempty"`
	Methodology *string            `json:"methodology,omitempty"`
	Region      *string            `json:"region,omitempty"`
	Year        *int               `json:"year,omitempty"`
	IsActive    *bool              `json:"is_active,omitempty"`
	Page        int                `json:"page"`
	PageSize    int                `json:"page_size"`
}
