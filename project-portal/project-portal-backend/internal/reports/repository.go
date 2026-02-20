package reports

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Repository defines the interface for reports data access
type Repository interface {
	// Report Definitions
	CreateReportDefinition(ctx context.Context, report *ReportDefinition) error
	GetReportDefinition(ctx context.Context, id uuid.UUID) (*ReportDefinition, error)
	UpdateReportDefinition(ctx context.Context, report *ReportDefinition) error
	DeleteReportDefinition(ctx context.Context, id uuid.UUID) error
	ListReportDefinitions(ctx context.Context, filter ReportFilter) ([]ReportDefinition, int64, error)
	ListTemplates(ctx context.Context) ([]ReportDefinition, error)

	// Report Schedules
	CreateSchedule(ctx context.Context, schedule *ReportSchedule) error
	GetSchedule(ctx context.Context, id uuid.UUID) (*ReportSchedule, error)
	UpdateSchedule(ctx context.Context, schedule *ReportSchedule) error
	DeleteSchedule(ctx context.Context, id uuid.UUID) error
	ListSchedules(ctx context.Context, filter ScheduleFilter) ([]ReportSchedule, int64, error)
	GetActiveSchedules(ctx context.Context) ([]ReportSchedule, error)
	GetDueSchedules(ctx context.Context, now time.Time) ([]ReportSchedule, error)

	// Report Executions
	CreateExecution(ctx context.Context, execution *ReportExecution) error
	GetExecution(ctx context.Context, id uuid.UUID) (*ReportExecution, error)
	UpdateExecution(ctx context.Context, execution *ReportExecution) error
	ListExecutions(ctx context.Context, filter ExecutionFilter) ([]ReportExecution, int64, error)
	GetPendingExecutions(ctx context.Context) ([]ReportExecution, error)

	// Benchmark Datasets
	CreateBenchmarkDataset(ctx context.Context, dataset *BenchmarkDataset) error
	GetBenchmarkDataset(ctx context.Context, id uuid.UUID) (*BenchmarkDataset, error)
	UpdateBenchmarkDataset(ctx context.Context, dataset *BenchmarkDataset) error
	DeleteBenchmarkDataset(ctx context.Context, id uuid.UUID) error
	ListBenchmarkDatasets(ctx context.Context, filter BenchmarkFilter) ([]BenchmarkDataset, error)
	GetBenchmarkByCategory(ctx context.Context, category, methodology, region string, year int) (*BenchmarkDataset, error)

	// Dashboard Widgets
	CreateWidget(ctx context.Context, widget *DashboardWidget) error
	GetWidget(ctx context.Context, id uuid.UUID) (*DashboardWidget, error)
	UpdateWidget(ctx context.Context, widget *DashboardWidget) error
	DeleteWidget(ctx context.Context, id uuid.UUID) error
	ListWidgetsByUser(ctx context.Context, userID uuid.UUID) ([]DashboardWidget, error)
	ListWidgetsBySection(ctx context.Context, section string) ([]DashboardWidget, error)
	UpdateWidgetPositions(ctx context.Context, userID uuid.UUID, positions map[uuid.UUID]int) error

	// Dashboard Data
	GetDashboardSummary(ctx context.Context, userID *uuid.UUID) (*DashboardSummary, error)
	GetTimeSeriesData(ctx context.Context, metric string, startTime, endTime time.Time, interval string) ([]TimeSeriesPoint, error)

	// Dynamic Query Execution
	ExecuteDynamicQuery(ctx context.Context, config ReportConfig) ([]map[string]interface{}, int64, error)
}

// ReportFilter defines filtering options for reports
type ReportFilter struct {
	UserID     *uuid.UUID
	Category   ReportCategory
	Visibility ReportVisibility
	IsTemplate *bool
	Search     string
	Page       int
	PageSize   int
}

// ScheduleFilter defines filtering options for schedules
type ScheduleFilter struct {
	ReportDefinitionID *uuid.UUID
	IsActive           *bool
	Format             ExportFormat
	Page               int
	PageSize           int
}

// ExecutionFilter defines filtering options for executions
type ExecutionFilter struct {
	ReportDefinitionID *uuid.UUID
	ScheduleID         *uuid.UUID
	TriggeredBy        *uuid.UUID
	Status             ExecutionStatus
	StartDate          *time.Time
	EndDate            *time.Time
	Page               int
	PageSize           int
}

// BenchmarkFilter defines filtering options for benchmarks
type BenchmarkFilter struct {
	Category    string
	Methodology string
	Region      string
	Year        int
	IsActive    *bool
}

// repository implements the Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new reports repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// ========== Report Definitions ==========

func (r *repository) CreateReportDefinition(ctx context.Context, report *ReportDefinition) error {
	return r.db.WithContext(ctx).Create(report).Error
}

func (r *repository) GetReportDefinition(ctx context.Context, id uuid.UUID) (*ReportDefinition, error) {
	var report ReportDefinition
	if err := r.db.WithContext(ctx).First(&report, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *repository) UpdateReportDefinition(ctx context.Context, report *ReportDefinition) error {
	report.Version++
	return r.db.WithContext(ctx).Save(report).Error
}

func (r *repository) DeleteReportDefinition(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&ReportDefinition{}, "id = ?", id).Error
}

func (r *repository) ListReportDefinitions(ctx context.Context, filter ReportFilter) ([]ReportDefinition, int64, error) {
	var reports []ReportDefinition
	var total int64

	query := r.db.WithContext(ctx).Model(&ReportDefinition{})

	// Apply filters
	if filter.UserID != nil {
		query = query.Where("created_by = ? OR visibility = 'public' OR ? = ANY(shared_with_users)",
			filter.UserID, filter.UserID)
	}
	if filter.Category != "" {
		query = query.Where("category = ?", filter.Category)
	}
	if filter.Visibility != "" {
		query = query.Where("visibility = ?", filter.Visibility)
	}
	if filter.IsTemplate != nil {
		query = query.Where("is_template = ?", *filter.IsTemplate)
	}
	if filter.Search != "" {
		searchPattern := "%" + filter.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchPattern, searchPattern)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination
	if filter.PageSize > 0 {
		query = query.Limit(filter.PageSize)
		if filter.Page > 0 {
			query = query.Offset((filter.Page - 1) * filter.PageSize)
		}
	}

	if err := query.Order("updated_at DESC").Find(&reports).Error; err != nil {
		return nil, 0, err
	}

	return reports, total, nil
}

func (r *repository) ListTemplates(ctx context.Context) ([]ReportDefinition, error) {
	var templates []ReportDefinition
	if err := r.db.WithContext(ctx).
		Where("is_template = ? AND visibility = ?", true, VisibilityPublic).
		Order("name ASC").
		Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

// ========== Report Schedules ==========

func (r *repository) CreateSchedule(ctx context.Context, schedule *ReportSchedule) error {
	return r.db.WithContext(ctx).Create(schedule).Error
}

func (r *repository) GetSchedule(ctx context.Context, id uuid.UUID) (*ReportSchedule, error) {
	var schedule ReportSchedule
	if err := r.db.WithContext(ctx).
		Preload("ReportDefinition").
		First(&schedule, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &schedule, nil
}

func (r *repository) UpdateSchedule(ctx context.Context, schedule *ReportSchedule) error {
	return r.db.WithContext(ctx).Save(schedule).Error
}

func (r *repository) DeleteSchedule(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&ReportSchedule{}, "id = ?", id).Error
}

func (r *repository) ListSchedules(ctx context.Context, filter ScheduleFilter) ([]ReportSchedule, int64, error) {
	var schedules []ReportSchedule
	var total int64

	query := r.db.WithContext(ctx).Model(&ReportSchedule{}).Preload("ReportDefinition")

	if filter.ReportDefinitionID != nil {
		query = query.Where("report_definition_id = ?", filter.ReportDefinitionID)
	}
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}
	if filter.Format != "" {
		query = query.Where("format = ?", filter.Format)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if filter.PageSize > 0 {
		query = query.Limit(filter.PageSize)
		if filter.Page > 0 {
			query = query.Offset((filter.Page - 1) * filter.PageSize)
		}
	}

	if err := query.Order("created_at DESC").Find(&schedules).Error; err != nil {
		return nil, 0, err
	}

	return schedules, total, nil
}

func (r *repository) GetActiveSchedules(ctx context.Context) ([]ReportSchedule, error) {
	var schedules []ReportSchedule
	now := time.Now()

	if err := r.db.WithContext(ctx).
		Preload("ReportDefinition").
		Where("is_active = ?", true).
		Where("start_date IS NULL OR start_date <= ?", now).
		Where("end_date IS NULL OR end_date >= ?", now).
		Find(&schedules).Error; err != nil {
		return nil, err
	}

	return schedules, nil
}

func (r *repository) GetDueSchedules(ctx context.Context, now time.Time) ([]ReportSchedule, error) {
	// This is a simplified implementation. In production, you'd use a proper
	// cron parsing library to determine which schedules are due
	return r.GetActiveSchedules(ctx)
}

// ========== Report Executions ==========

func (r *repository) CreateExecution(ctx context.Context, execution *ReportExecution) error {
	return r.db.WithContext(ctx).Create(execution).Error
}

func (r *repository) GetExecution(ctx context.Context, id uuid.UUID) (*ReportExecution, error) {
	var execution ReportExecution
	if err := r.db.WithContext(ctx).
		Preload("ReportDefinition").
		Preload("Schedule").
		First(&execution, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &execution, nil
}

func (r *repository) UpdateExecution(ctx context.Context, execution *ReportExecution) error {
	return r.db.WithContext(ctx).Save(execution).Error
}

func (r *repository) ListExecutions(ctx context.Context, filter ExecutionFilter) ([]ReportExecution, int64, error) {
	var executions []ReportExecution
	var total int64

	query := r.db.WithContext(ctx).Model(&ReportExecution{}).
		Preload("ReportDefinition").
		Preload("Schedule")

	if filter.ReportDefinitionID != nil {
		query = query.Where("report_definition_id = ?", filter.ReportDefinitionID)
	}
	if filter.ScheduleID != nil {
		query = query.Where("schedule_id = ?", filter.ScheduleID)
	}
	if filter.TriggeredBy != nil {
		query = query.Where("triggered_by = ?", filter.TriggeredBy)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.StartDate != nil {
		query = query.Where("triggered_at >= ?", filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("triggered_at <= ?", filter.EndDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if filter.PageSize > 0 {
		query = query.Limit(filter.PageSize)
		if filter.Page > 0 {
			query = query.Offset((filter.Page - 1) * filter.PageSize)
		}
	}

	if err := query.Order("triggered_at DESC").Find(&executions).Error; err != nil {
		return nil, 0, err
	}

	return executions, total, nil
}

func (r *repository) GetPendingExecutions(ctx context.Context) ([]ReportExecution, error) {
	var executions []ReportExecution
	if err := r.db.WithContext(ctx).
		Preload("ReportDefinition").
		Preload("Schedule").
		Where("status = ?", StatusPending).
		Order("triggered_at ASC").
		Find(&executions).Error; err != nil {
		return nil, err
	}
	return executions, nil
}

// ========== Benchmark Datasets ==========

func (r *repository) CreateBenchmarkDataset(ctx context.Context, dataset *BenchmarkDataset) error {
	return r.db.WithContext(ctx).Create(dataset).Error
}

func (r *repository) GetBenchmarkDataset(ctx context.Context, id uuid.UUID) (*BenchmarkDataset, error) {
	var dataset BenchmarkDataset
	if err := r.db.WithContext(ctx).First(&dataset, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &dataset, nil
}

func (r *repository) UpdateBenchmarkDataset(ctx context.Context, dataset *BenchmarkDataset) error {
	return r.db.WithContext(ctx).Save(dataset).Error
}

func (r *repository) DeleteBenchmarkDataset(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&BenchmarkDataset{}, "id = ?", id).Error
}

func (r *repository) ListBenchmarkDatasets(ctx context.Context, filter BenchmarkFilter) ([]BenchmarkDataset, error) {
	var datasets []BenchmarkDataset

	query := r.db.WithContext(ctx).Model(&BenchmarkDataset{})

	if filter.Category != "" {
		query = query.Where("category = ?", filter.Category)
	}
	if filter.Methodology != "" {
		query = query.Where("methodology = ?", filter.Methodology)
	}
	if filter.Region != "" {
		query = query.Where("region = ?", filter.Region)
	}
	if filter.Year > 0 {
		query = query.Where("year = ?", filter.Year)
	}
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if err := query.Order("year DESC, category ASC").Find(&datasets).Error; err != nil {
		return nil, err
	}

	return datasets, nil
}

func (r *repository) GetBenchmarkByCategory(ctx context.Context, category, methodology, region string, year int) (*BenchmarkDataset, error) {
	var dataset BenchmarkDataset

	query := r.db.WithContext(ctx).Where("category = ? AND is_active = ?", category, true)

	if methodology != "" {
		query = query.Where("methodology = ?", methodology)
	}
	if region != "" {
		query = query.Where("region = ?", region)
	}
	if year > 0 {
		query = query.Where("year = ?", year)
	} else {
		query = query.Order("year DESC")
	}

	if err := query.First(&dataset).Error; err != nil {
		return nil, err
	}

	return &dataset, nil
}

// ========== Dashboard Widgets ==========

func (r *repository) CreateWidget(ctx context.Context, widget *DashboardWidget) error {
	return r.db.WithContext(ctx).Create(widget).Error
}

func (r *repository) GetWidget(ctx context.Context, id uuid.UUID) (*DashboardWidget, error) {
	var widget DashboardWidget
	if err := r.db.WithContext(ctx).First(&widget, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &widget, nil
}

func (r *repository) UpdateWidget(ctx context.Context, widget *DashboardWidget) error {
	return r.db.WithContext(ctx).Save(widget).Error
}

func (r *repository) DeleteWidget(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&DashboardWidget{}, "id = ?", id).Error
}

func (r *repository) ListWidgetsByUser(ctx context.Context, userID uuid.UUID) ([]DashboardWidget, error) {
	var widgets []DashboardWidget
	if err := r.db.WithContext(ctx).
		Where("user_id = ? OR user_id IS NULL", userID).
		Order("position ASC").
		Find(&widgets).Error; err != nil {
		return nil, err
	}
	return widgets, nil
}

func (r *repository) ListWidgetsBySection(ctx context.Context, section string) ([]DashboardWidget, error) {
	var widgets []DashboardWidget
	if err := r.db.WithContext(ctx).
		Where("dashboard_section = ?", section).
		Order("position ASC").
		Find(&widgets).Error; err != nil {
		return nil, err
	}
	return widgets, nil
}

func (r *repository) UpdateWidgetPositions(ctx context.Context, userID uuid.UUID, positions map[uuid.UUID]int) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for widgetID, position := range positions {
			if err := tx.Model(&DashboardWidget{}).
				Where("id = ? AND user_id = ?", widgetID, userID).
				Update("position", position).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ========== Dashboard Data ==========

func (r *repository) GetDashboardSummary(ctx context.Context, userID *uuid.UUID) (*DashboardSummary, error) {
	summary := &DashboardSummary{
		PerformanceMetrics: make(map[string]MetricSummary),
		TimeSeriesData:     make(map[string][]TimeSeriesPoint),
	}

	// Get total projects count
	var projectCount int64
	r.db.WithContext(ctx).Table("projects").Count(&projectCount)
	summary.TotalProjects = int(projectCount)

	// Get total credits (assuming a carbon_credits table exists)
	var totalCredits struct {
		Total float64
	}
	r.db.WithContext(ctx).Table("carbon_credits").
		Select("COALESCE(SUM(quantity), 0) as total").
		Scan(&totalCredits)
	summary.TotalCredits = totalCredits.Total

	// Get total revenue (assuming a transactions table exists)
	var totalRevenue struct {
		Total float64
	}
	r.db.WithContext(ctx).Table("transactions").
		Select("COALESCE(SUM(amount), 0) as total").
		Scan(&totalRevenue)
	summary.TotalRevenue = totalRevenue.Total

	// Get active monitoring areas
	var monitoringCount int64
	r.db.WithContext(ctx).Table("monitoring_areas").
		Where("is_active = ?", true).
		Count(&monitoringCount)
	summary.ActiveMonitoringAreas = int(monitoringCount)

	// Calculate performance metrics
	summary.PerformanceMetrics["credits_issued"] = MetricSummary{
		Value:         summary.TotalCredits,
		Change:        0, // Would calculate from previous period
		ChangePercent: 0,
		Period:        "30d",
		Trend:         "stable",
	}

	summary.PerformanceMetrics["revenue"] = MetricSummary{
		Value:         summary.TotalRevenue,
		Change:        0,
		ChangePercent: 0,
		Period:        "30d",
		Trend:         "stable",
	}

	return summary, nil
}

func (r *repository) GetTimeSeriesData(ctx context.Context, metric string, startTime, endTime time.Time, interval string) ([]TimeSeriesPoint, error) {
	var points []TimeSeriesPoint

	// Determine the table and field based on metric
	var table, field, timeField string
	switch metric {
	case "credits":
		table = "carbon_credits"
		field = "quantity"
		timeField = "created_at"
	case "revenue":
		table = "transactions"
		field = "amount"
		timeField = "created_at"
	case "projects":
		table = "projects"
		field = "1" // count
		timeField = "created_at"
	default:
		return nil, fmt.Errorf("unknown metric: %s", metric)
	}

	// Build interval expression
	var intervalExpr string
	switch interval {
	case "hour":
		intervalExpr = "date_trunc('hour', %s)"
	case "day":
		intervalExpr = "date_trunc('day', %s)"
	case "week":
		intervalExpr = "date_trunc('week', %s)"
	case "month":
		intervalExpr = "date_trunc('month', %s)"
	default:
		intervalExpr = "date_trunc('day', %s)"
	}

	query := fmt.Sprintf(`
		SELECT 
			%s AS time_bucket,
			COALESCE(SUM(%s), 0) AS value
		FROM %s
		WHERE %s BETWEEN ? AND ?
		GROUP BY time_bucket
		ORDER BY time_bucket ASC
	`, fmt.Sprintf(intervalExpr, timeField), field, table, timeField)

	rows, err := r.db.WithContext(ctx).Raw(query, startTime, endTime).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var point TimeSeriesPoint
		if err := rows.Scan(&point.Time, &point.Value); err != nil {
			return nil, err
		}
		points = append(points, point)
	}

	return points, nil
}

// ========== Dynamic Query Execution ==========

func (r *repository) ExecuteDynamicQuery(ctx context.Context, config ReportConfig) ([]map[string]interface{}, int64, error) {
	// Build dynamic query based on config
	query, args, err := buildDynamicQuery(config)
	if err != nil {
		return nil, 0, err
	}

	// Execute query
	rows, err := r.db.WithContext(ctx).Raw(query, args...).Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return nil, 0, err
	}

	var results []map[string]interface{}

	for rows.Next() {
		// Create a slice of interface{} to hold each column value
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, 0, err
		}

		// Create a map for this row
		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}

	// Get total count (without pagination)
	var total int64
	countQuery, countArgs, _ := buildCountQuery(config)
	r.db.WithContext(ctx).Raw(countQuery, countArgs...).Scan(&total)

	return results, total, nil
}

// buildDynamicQuery constructs a SQL query from ReportConfig
func buildDynamicQuery(config ReportConfig) (string, []interface{}, error) {
	var args []interface{}

	// Build SELECT clause
	selectFields := make([]string, 0, len(config.Fields))
	for _, field := range config.Fields {
		fieldExpr := field.Name
		if field.Aggregate != "" {
			fieldExpr = fmt.Sprintf("%s(%s)", field.Aggregate, field.Name)
		}
		if field.Alias != "" {
			fieldExpr = fmt.Sprintf("%s AS %s", fieldExpr, field.Alias)
		}
		selectFields = append(selectFields, fieldExpr)
	}

	// Add calculated fields
	for _, calc := range config.Calculations {
		selectFields = append(selectFields, fmt.Sprintf("(%s) AS %s", calc.Expression, calc.Name))
	}

	// Build FROM clause
	fromClause := config.Dataset

	// Build WHERE clause
	whereConditions := make([]string, 0, len(config.Filters))
	for _, filter := range config.Filters {
		condition, filterArgs := buildFilterCondition(filter)
		whereConditions = append(whereConditions, condition)
		args = append(args, filterArgs...)
	}

	// Build GROUP BY clause
	groupByFields := make([]string, 0, len(config.Groupings))
	for _, group := range config.Groupings {
		if group.TimeGrain != "" {
			groupByFields = append(groupByFields, fmt.Sprintf("date_trunc('%s', %s)", group.TimeGrain, group.Field))
		} else {
			groupByFields = append(groupByFields, group.Field)
		}
	}

	// Build ORDER BY clause
	orderByFields := make([]string, 0, len(config.Sorts))
	for _, sort := range config.Sorts {
		direction := "ASC"
		if sort.Direction == "desc" {
			direction = "DESC"
		}
		orderByFields = append(orderByFields, fmt.Sprintf("%s %s", sort.Field, direction))
	}

	// Construct query
	query := fmt.Sprintf("SELECT %s FROM %s",
		stringJoin(selectFields, ", "),
		fromClause)

	if len(whereConditions) > 0 {
		query += fmt.Sprintf(" WHERE %s", stringJoin(whereConditions, " AND "))
	}

	if len(groupByFields) > 0 {
		query += fmt.Sprintf(" GROUP BY %s", stringJoin(groupByFields, ", "))
	}

	if len(orderByFields) > 0 {
		query += fmt.Sprintf(" ORDER BY %s", stringJoin(orderByFields, ", "))
	}

	if config.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", config.Limit)
	}

	return query, args, nil
}

// buildCountQuery constructs a count query from ReportConfig
func buildCountQuery(config ReportConfig) (string, []interface{}, error) {
	var args []interface{}

	fromClause := config.Dataset

	whereConditions := make([]string, 0, len(config.Filters))
	for _, filter := range config.Filters {
		condition, filterArgs := buildFilterCondition(filter)
		whereConditions = append(whereConditions, condition)
		args = append(args, filterArgs...)
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", fromClause)

	if len(whereConditions) > 0 {
		query += fmt.Sprintf(" WHERE %s", stringJoin(whereConditions, " AND "))
	}

	return query, args, nil
}

// buildFilterCondition creates a SQL condition from a FilterConfig
func buildFilterCondition(filter FilterConfig) (string, []interface{}) {
	var condition string
	var args []interface{}

	switch filter.Operator {
	case "eq":
		condition = fmt.Sprintf("%s = ?", filter.Field)
		args = append(args, filter.Value)
	case "ne":
		condition = fmt.Sprintf("%s != ?", filter.Field)
		args = append(args, filter.Value)
	case "gt":
		condition = fmt.Sprintf("%s > ?", filter.Field)
		args = append(args, filter.Value)
	case "gte":
		condition = fmt.Sprintf("%s >= ?", filter.Field)
		args = append(args, filter.Value)
	case "lt":
		condition = fmt.Sprintf("%s < ?", filter.Field)
		args = append(args, filter.Value)
	case "lte":
		condition = fmt.Sprintf("%s <= ?", filter.Field)
		args = append(args, filter.Value)
	case "like":
		condition = fmt.Sprintf("%s ILIKE ?", filter.Field)
		args = append(args, fmt.Sprintf("%%%v%%", filter.Value))
	case "in":
		if values, ok := filter.Value.([]interface{}); ok {
			condition = fmt.Sprintf("%s = ANY(?)", filter.Field)
			args = append(args, pq.Array(values))
		}
	case "between":
		if values, ok := filter.Value.([]interface{}); ok && len(values) == 2 {
			condition = fmt.Sprintf("%s BETWEEN ? AND ?", filter.Field)
			args = append(args, values[0], values[1])
		}
	case "is_null":
		condition = fmt.Sprintf("%s IS NULL", filter.Field)
	case "is_not_null":
		condition = fmt.Sprintf("%s IS NOT NULL", filter.Field)
	default:
		condition = fmt.Sprintf("%s = ?", filter.Field)
		args = append(args, filter.Value)
	}

	return condition, args
}

// stringJoin is a helper to join strings
func stringJoin(elems []string, sep string) string {
	if len(elems) == 0 {
		return ""
	}
	result := elems[0]
	for _, elem := range elems[1:] {
		result += sep + elem
	}
	return result
}

// Helper to convert interface to JSON
func toJSON(v interface{}) datatypes.JSON {
	data, _ := json.Marshal(v)
	return datatypes.JSON(data)
}
