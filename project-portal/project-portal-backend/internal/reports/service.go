package reports

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Service defines the interface for reporting business logic
type Service interface {
	// Report Definitions
	CreateReport(ctx context.Context, userID uuid.UUID, req CreateReportRequest) (*ReportDefinition, error)
	GetReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID) (*ReportDefinition, error)
	UpdateReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, req UpdateReportRequest) (*ReportDefinition, error)
	DeleteReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID) error
	ListReports(ctx context.Context, userID uuid.UUID, filter ReportFilter) (*ListReportsResponse, error)
	GetTemplates(ctx context.Context) ([]ReportDefinition, error)
	CloneReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, name string) (*ReportDefinition, error)

	// Report Execution
	ExecuteReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, req ExecuteReportRequest) (*ReportExecution, error)
	GetExecution(ctx context.Context, executionID uuid.UUID) (*ReportExecution, error)
	ListExecutions(ctx context.Context, filter ExecutionFilter) (*ListExecutionsResponse, error)
	CancelExecution(ctx context.Context, executionID uuid.UUID) error

	// Scheduled Reports
	CreateSchedule(ctx context.Context, userID uuid.UUID, req CreateScheduleRequest) (*ReportSchedule, error)
	GetSchedule(ctx context.Context, scheduleID uuid.UUID) (*ReportSchedule, error)
	UpdateSchedule(ctx context.Context, scheduleID uuid.UUID, req CreateScheduleRequest) (*ReportSchedule, error)
	DeleteSchedule(ctx context.Context, scheduleID uuid.UUID) error
	ListSchedules(ctx context.Context, filter ScheduleFilter) ([]ReportSchedule, int64, error)
	ToggleSchedule(ctx context.Context, scheduleID uuid.UUID, active bool) error

	// Benchmarks
	CompareBenchmark(ctx context.Context, req BenchmarkComparisonRequest) (*BenchmarkComparisonResponse, error)
	ListBenchmarks(ctx context.Context, filter BenchmarkFilter) ([]BenchmarkDataset, error)
	CreateBenchmark(ctx context.Context, dataset *BenchmarkDataset) (*BenchmarkDataset, error)
	UpdateBenchmark(ctx context.Context, datasetID uuid.UUID, dataset *BenchmarkDataset) (*BenchmarkDataset, error)

	// Dashboard
	GetDashboardSummary(ctx context.Context, userID *uuid.UUID) (*DashboardSummary, error)
	GetTimeSeriesData(ctx context.Context, metric string, startTime, endTime time.Time, interval string) ([]TimeSeriesPoint, error)
	GetWidgets(ctx context.Context, userID uuid.UUID, section string) ([]DashboardWidget, error)
	SaveWidget(ctx context.Context, widget *DashboardWidget) (*DashboardWidget, error)
	DeleteWidget(ctx context.Context, widgetID uuid.UUID) error

	// Datasets
	GetAvailableDatasets(ctx context.Context) ([]DatasetMetadata, error)
}

// service implements the Service interface
type service struct {
	repo     Repository
	exporter Exporter
}

// Exporter defines the interface for report export functionality
type Exporter interface {
	ExportCSV(ctx context.Context, data []map[string]interface{}, config ExportConfig) ([]byte, error)
	ExportExcel(ctx context.Context, data []map[string]interface{}, config ExportConfig) ([]byte, error)
	ExportPDF(ctx context.Context, data []map[string]interface{}, config ExportConfig) ([]byte, error)
}

// ExportConfig holds export configuration
type ExportConfig struct {
	Title         string
	Description   string
	Fields        []FieldConfig
	DateFormat    string
	Locale        string
	IncludeHeader bool
	PageSize      string // A4, Letter, etc.
	Orientation   string // portrait, landscape
}

// NewService creates a new reports service
func NewService(repo Repository, exporter Exporter) Service {
	return &service{
		repo:     repo,
		exporter: exporter,
	}
}

// ========== Report Definitions ==========

func (s *service) CreateReport(ctx context.Context, userID uuid.UUID, req CreateReportRequest) (*ReportDefinition, error) {
	// Validate the report configuration
	if err := validateReportConfig(req.Config); err != nil {
		return nil, fmt.Errorf("invalid report configuration: %w", err)
	}

	// Convert config to JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize config: %w", err)
	}

	report := &ReportDefinition{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Config:      datatypes.JSON(configJSON),
		CreatedBy:   &userID,
		Visibility:  req.Visibility,
		IsTemplate:  req.IsTemplate,
		Version:     1,
	}

	if report.Visibility == "" {
		report.Visibility = VisibilityPrivate
	}

	if err := s.repo.CreateReportDefinition(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	return report, nil
}

func (s *service) GetReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID) (*ReportDefinition, error) {
	report, err := s.repo.GetReportDefinition(ctx, reportID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	// Check access permission
	if !s.canAccessReport(report, userID) {
		return nil, fmt.Errorf("access denied to report")
	}

	return report, nil
}

func (s *service) UpdateReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, req UpdateReportRequest) (*ReportDefinition, error) {
	report, err := s.repo.GetReportDefinition(ctx, reportID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	// Check write permission
	if !s.canModifyReport(report, userID) {
		return nil, fmt.Errorf("access denied to modify report")
	}

	// Update fields
	if req.Name != "" {
		report.Name = req.Name
	}
	if req.Description != "" {
		report.Description = req.Description
	}
	if req.Category != "" {
		report.Category = req.Category
	}
	if req.Visibility != "" {
		report.Visibility = req.Visibility
	}
	if req.Config != nil {
		if err := validateReportConfig(*req.Config); err != nil {
			return nil, fmt.Errorf("invalid report configuration: %w", err)
		}
		configJSON, err := json.Marshal(req.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize config: %w", err)
		}
		report.Config = datatypes.JSON(configJSON)
	}

	if err := s.repo.UpdateReportDefinition(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to update report: %w", err)
	}

	return report, nil
}

func (s *service) DeleteReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID) error {
	report, err := s.repo.GetReportDefinition(ctx, reportID)
	if err != nil {
		return fmt.Errorf("report not found: %w", err)
	}

	if !s.canModifyReport(report, userID) {
		return fmt.Errorf("access denied to delete report")
	}

	return s.repo.DeleteReportDefinition(ctx, reportID)
}

func (s *service) ListReports(ctx context.Context, userID uuid.UUID, filter ReportFilter) (*ListReportsResponse, error) {
	filter.UserID = &userID

	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.Page == 0 {
		filter.Page = 1
	}

	reports, total, err := s.repo.ListReportDefinitions(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list reports: %w", err)
	}

	totalPages := int((total + int64(filter.PageSize) - 1) / int64(filter.PageSize))

	return &ListReportsResponse{
		Reports:    reports,
		Total:      total,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *service) GetTemplates(ctx context.Context) ([]ReportDefinition, error) {
	return s.repo.ListTemplates(ctx)
}

func (s *service) CloneReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, name string) (*ReportDefinition, error) {
	original, err := s.repo.GetReportDefinition(ctx, reportID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	if !s.canAccessReport(original, userID) {
		return nil, fmt.Errorf("access denied")
	}

	clone := &ReportDefinition{
		ID:                uuid.New(),
		Name:              name,
		Description:       original.Description,
		Category:          original.Category,
		Config:            original.Config,
		CreatedBy:         &userID,
		Visibility:        VisibilityPrivate,
		Version:           1,
		IsTemplate:        false,
		BasedOnTemplateID: &reportID,
	}

	if err := s.repo.CreateReportDefinition(ctx, clone); err != nil {
		return nil, fmt.Errorf("failed to clone report: %w", err)
	}

	return clone, nil
}

// ========== Report Execution ==========

func (s *service) ExecuteReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, req ExecuteReportRequest) (*ReportExecution, error) {
	report, err := s.repo.GetReportDefinition(ctx, reportID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	if !s.canAccessReport(report, userID) {
		return nil, fmt.Errorf("access denied")
	}

	// Parse report config
	var config ReportConfig
	if err := json.Unmarshal(report.Config, &config); err != nil {
		return nil, fmt.Errorf("failed to parse report config: %w", err)
	}

	// Create execution record
	now := time.Now()
	execution := &ReportExecution{
		ID:                 uuid.New(),
		ReportDefinitionID: &reportID,
		TriggeredBy:        &userID,
		TriggeredAt:        now,
		Status:             StatusProcessing,
	}

	if req.Parameters != nil {
		paramsJSON, _ := json.Marshal(req.Parameters)
		execution.Parameters = datatypes.JSON(paramsJSON)
	}

	if err := s.repo.CreateExecution(ctx, execution); err != nil {
		return nil, fmt.Errorf("failed to create execution: %w", err)
	}

	// Execute the report
	go s.processReportExecution(context.Background(), execution, config, req.Format)

	return execution, nil
}

func (s *service) processReportExecution(ctx context.Context, execution *ReportExecution, config ReportConfig, format ExportFormat) {
	// Execute the dynamic query
	data, recordCount, err := s.repo.ExecuteDynamicQuery(ctx, config)
	if err != nil {
		execution.Status = StatusFailed
		execution.ErrorMessage = err.Error()
		s.repo.UpdateExecution(ctx, execution)
		return
	}

	execution.RecordCount = int(recordCount)

	// Export to requested format
	if format == "" {
		format = FormatJSON // Default
	}

	var exportData []byte
	exportConfig := ExportConfig{
		Title:         "",
		Fields:        config.Fields,
		IncludeHeader: true,
	}

	switch format {
	case FormatCSV:
		if s.exporter != nil {
			exportData, err = s.exporter.ExportCSV(ctx, data, exportConfig)
		}
	case FormatExcel:
		if s.exporter != nil {
			exportData, err = s.exporter.ExportExcel(ctx, data, exportConfig)
		}
	case FormatPDF:
		if s.exporter != nil {
			exportData, err = s.exporter.ExportPDF(ctx, data, exportConfig)
		}
	case FormatJSON:
		exportData, err = json.Marshal(data)
	}

	if err != nil {
		execution.Status = StatusFailed
		execution.ErrorMessage = fmt.Sprintf("export failed: %v", err)
		s.repo.UpdateExecution(ctx, execution)
		return
	}

	// Update execution with results
	now := time.Now()
	execution.CompletedAt = &now
	execution.Status = StatusCompleted
	execution.FileSizeBytes = int64(len(exportData))

	// In production, you'd store the file in S3 and set FileKey/DownloadURL
	// For now, we'll just mark it complete

	s.repo.UpdateExecution(ctx, execution)
}

func (s *service) GetExecution(ctx context.Context, executionID uuid.UUID) (*ReportExecution, error) {
	return s.repo.GetExecution(ctx, executionID)
}

func (s *service) ListExecutions(ctx context.Context, filter ExecutionFilter) (*ListExecutionsResponse, error) {
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.Page == 0 {
		filter.Page = 1
	}

	executions, total, err := s.repo.ListExecutions(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list executions: %w", err)
	}

	totalPages := int((total + int64(filter.PageSize) - 1) / int64(filter.PageSize))

	return &ListExecutionsResponse{
		Executions: executions,
		Total:      total,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *service) CancelExecution(ctx context.Context, executionID uuid.UUID) error {
	execution, err := s.repo.GetExecution(ctx, executionID)
	if err != nil {
		return fmt.Errorf("execution not found: %w", err)
	}

	if execution.Status != StatusPending && execution.Status != StatusProcessing {
		return fmt.Errorf("cannot cancel execution with status: %s", execution.Status)
	}

	execution.Status = StatusFailed
	execution.ErrorMessage = "Cancelled by user"
	now := time.Now()
	execution.CompletedAt = &now

	return s.repo.UpdateExecution(ctx, execution)
}

// ========== Scheduled Reports ==========

func (s *service) CreateSchedule(ctx context.Context, userID uuid.UUID, req CreateScheduleRequest) (*ReportSchedule, error) {
	// Verify report exists
	_, err := s.repo.GetReportDefinition(ctx, req.ReportDefinitionID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	// Validate cron expression
	if err := validateCronExpression(req.CronExpression); err != nil {
		return nil, fmt.Errorf("invalid cron expression: %w", err)
	}

	deliveryConfigJSON, err := json.Marshal(req.DeliveryConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize delivery config: %w", err)
	}

	schedule := &ReportSchedule{
		ID:                 uuid.New(),
		ReportDefinitionID: req.ReportDefinitionID,
		Name:               req.Name,
		CronExpression:     req.CronExpression,
		Timezone:           req.Timezone,
		StartDate:          req.StartDate,
		EndDate:            req.EndDate,
		IsActive:           true,
		Format:             req.Format,
		DeliveryMethod:     req.DeliveryMethod,
		DeliveryConfig:     datatypes.JSON(deliveryConfigJSON),
		RecipientEmails:    req.RecipientEmails,
		RecipientUserIDs:   req.RecipientUserIDs,
		WebhookURL:         req.WebhookURL,
	}

	if schedule.Timezone == "" {
		schedule.Timezone = "UTC"
	}

	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}

	return schedule, nil
}

func (s *service) GetSchedule(ctx context.Context, scheduleID uuid.UUID) (*ReportSchedule, error) {
	return s.repo.GetSchedule(ctx, scheduleID)
}

func (s *service) UpdateSchedule(ctx context.Context, scheduleID uuid.UUID, req CreateScheduleRequest) (*ReportSchedule, error) {
	schedule, err := s.repo.GetSchedule(ctx, scheduleID)
	if err != nil {
		return nil, fmt.Errorf("schedule not found: %w", err)
	}

	if err := validateCronExpression(req.CronExpression); err != nil {
		return nil, fmt.Errorf("invalid cron expression: %w", err)
	}

	deliveryConfigJSON, err := json.Marshal(req.DeliveryConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize delivery config: %w", err)
	}

	schedule.Name = req.Name
	schedule.CronExpression = req.CronExpression
	schedule.Timezone = req.Timezone
	schedule.StartDate = req.StartDate
	schedule.EndDate = req.EndDate
	schedule.Format = req.Format
	schedule.DeliveryMethod = req.DeliveryMethod
	schedule.DeliveryConfig = datatypes.JSON(deliveryConfigJSON)
	schedule.RecipientEmails = req.RecipientEmails
	schedule.RecipientUserIDs = req.RecipientUserIDs
	schedule.WebhookURL = req.WebhookURL

	if err := s.repo.UpdateSchedule(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to update schedule: %w", err)
	}

	return schedule, nil
}

func (s *service) DeleteSchedule(ctx context.Context, scheduleID uuid.UUID) error {
	return s.repo.DeleteSchedule(ctx, scheduleID)
}

func (s *service) ListSchedules(ctx context.Context, filter ScheduleFilter) ([]ReportSchedule, int64, error) {
	return s.repo.ListSchedules(ctx, filter)
}

func (s *service) ToggleSchedule(ctx context.Context, scheduleID uuid.UUID, active bool) error {
	schedule, err := s.repo.GetSchedule(ctx, scheduleID)
	if err != nil {
		return fmt.Errorf("schedule not found: %w", err)
	}

	schedule.IsActive = active
	return s.repo.UpdateSchedule(ctx, schedule)
}

// ========== Benchmarks ==========

func (s *service) CompareBenchmark(ctx context.Context, req BenchmarkComparisonRequest) (*BenchmarkComparisonResponse, error) {
	// Get benchmark dataset
	benchmark, err := s.repo.GetBenchmarkByCategory(ctx, req.Category, req.Methodology, req.Region, req.Year)
	if err != nil {
		return nil, fmt.Errorf("benchmark not found: %w", err)
	}

	// Parse benchmark data
	var benchmarkData []BenchmarkData
	if err := json.Unmarshal(benchmark.Data, &benchmarkData); err != nil {
		return nil, fmt.Errorf("failed to parse benchmark data: %w", err)
	}

	// Get project metrics (this would query actual project data)
	projectMetrics := s.getProjectMetrics(ctx, req.ProjectID)

	// Calculate comparison results
	results := make([]BenchmarkResult, 0, len(benchmarkData))
	percentileRanks := make(map[string]float64)
	gaps := make([]GapAnalysisResult, 0)

	for _, bm := range benchmarkData {
		projectValue, exists := projectMetrics[bm.Metric]
		if !exists {
			continue
		}

		diff := projectValue - bm.Value
		diffPercent := 0.0
		if bm.Value != 0 {
			diffPercent = (diff / bm.Value) * 100
		}

		performanceLevel := "at"
		if diffPercent > 10 {
			performanceLevel = "above"
		} else if diffPercent < -10 {
			performanceLevel = "below"
		}

		results = append(results, BenchmarkResult{
			Metric:            bm.Metric,
			ProjectValue:      projectValue,
			BenchmarkValue:    bm.Value,
			Difference:        diff,
			DifferencePercent: diffPercent,
			PerformanceLevel:  performanceLevel,
		})

		// Calculate percentile rank
		if bm.Percentile > 0 {
			percentileRanks[bm.Metric] = calculatePercentileRank(projectValue, bm.Value, bm.LowerBound, bm.UpperBound)
		}

		// Generate gap analysis for underperforming metrics
		if performanceLevel == "below" {
			priority := "medium"
			if diffPercent < -25 {
				priority = "high"
			} else if diffPercent > -10 {
				priority = "low"
			}

			gaps = append(gaps, GapAnalysisResult{
				Metric:         bm.Metric,
				Gap:            diff,
				Priority:       priority,
				Recommendation: generateRecommendation(bm.Metric, diff),
			})
		}
	}

	return &BenchmarkComparisonResponse{
		ProjectID:      req.ProjectID,
		ProjectMetrics: projectMetrics,
		Benchmarks:     results,
		PercentileRank: percentileRanks,
		GapAnalysis:    gaps,
	}, nil
}

func (s *service) ListBenchmarks(ctx context.Context, filter BenchmarkFilter) ([]BenchmarkDataset, error) {
	return s.repo.ListBenchmarkDatasets(ctx, filter)
}

func (s *service) CreateBenchmark(ctx context.Context, dataset *BenchmarkDataset) (*BenchmarkDataset, error) {
	dataset.ID = uuid.New()
	if err := s.repo.CreateBenchmarkDataset(ctx, dataset); err != nil {
		return nil, fmt.Errorf("failed to create benchmark: %w", err)
	}
	return dataset, nil
}

func (s *service) UpdateBenchmark(ctx context.Context, datasetID uuid.UUID, dataset *BenchmarkDataset) (*BenchmarkDataset, error) {
	existing, err := s.repo.GetBenchmarkDataset(ctx, datasetID)
	if err != nil {
		return nil, fmt.Errorf("benchmark not found: %w", err)
	}

	existing.Name = dataset.Name
	existing.Description = dataset.Description
	existing.Category = dataset.Category
	existing.Methodology = dataset.Methodology
	existing.Region = dataset.Region
	existing.Data = dataset.Data
	existing.Year = dataset.Year
	existing.Source = dataset.Source
	existing.ConfidenceScore = dataset.ConfidenceScore
	existing.IsActive = dataset.IsActive

	if err := s.repo.UpdateBenchmarkDataset(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update benchmark: %w", err)
	}

	return existing, nil
}

// ========== Dashboard ==========

func (s *service) GetDashboardSummary(ctx context.Context, userID *uuid.UUID) (*DashboardSummary, error) {
	return s.repo.GetDashboardSummary(ctx, userID)
}

func (s *service) GetTimeSeriesData(ctx context.Context, metric string, startTime, endTime time.Time, interval string) ([]TimeSeriesPoint, error) {
	return s.repo.GetTimeSeriesData(ctx, metric, startTime, endTime, interval)
}

func (s *service) GetWidgets(ctx context.Context, userID uuid.UUID, section string) ([]DashboardWidget, error) {
	if section != "" {
		return s.repo.ListWidgetsBySection(ctx, section)
	}
	return s.repo.ListWidgetsByUser(ctx, userID)
}

func (s *service) SaveWidget(ctx context.Context, widget *DashboardWidget) (*DashboardWidget, error) {
	if widget.ID == uuid.Nil {
		widget.ID = uuid.New()
		if err := s.repo.CreateWidget(ctx, widget); err != nil {
			return nil, fmt.Errorf("failed to create widget: %w", err)
		}
	} else {
		if err := s.repo.UpdateWidget(ctx, widget); err != nil {
			return nil, fmt.Errorf("failed to update widget: %w", err)
		}
	}
	return widget, nil
}

func (s *service) DeleteWidget(ctx context.Context, widgetID uuid.UUID) error {
	return s.repo.DeleteWidget(ctx, widgetID)
}

// ========== Datasets ==========

func (s *service) GetAvailableDatasets(ctx context.Context) ([]DatasetMetadata, error) {
	// Return predefined dataset metadata
	return []DatasetMetadata{
		{
			Name:        "projects",
			DisplayName: "Projects",
			Description: "Carbon credit projects including details, status, and metrics",
			Fields: []FieldMetadata{
				{Name: "id", DisplayName: "Project ID", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "name", DisplayName: "Project Name", DataType: "string", IsFilterable: true},
				{Name: "status", DisplayName: "Status", DataType: "string", IsFilterable: true, IsGroupable: true, AllowedValues: []string{"active", "pending", "completed", "cancelled"}},
				{Name: "methodology", DisplayName: "Methodology", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "region", DisplayName: "Region", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "total_area_hectares", DisplayName: "Total Area (ha)", DataType: "number", IsAggregatable: true},
				{Name: "estimated_credits", DisplayName: "Estimated Credits", DataType: "number", IsAggregatable: true},
				{Name: "created_at", DisplayName: "Created Date", DataType: "date", IsFilterable: true, IsGroupable: true},
			},
			JoinWith: []string{"carbon_credits", "monitoring_data"},
		},
		{
			Name:        "carbon_credits",
			DisplayName: "Carbon Credits",
			Description: "Issued and traded carbon credits",
			Fields: []FieldMetadata{
				{Name: "id", DisplayName: "Credit ID", DataType: "string", IsFilterable: true},
				{Name: "project_id", DisplayName: "Project ID", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "quantity", DisplayName: "Quantity", DataType: "number", IsAggregatable: true},
				{Name: "vintage_year", DisplayName: "Vintage Year", DataType: "number", IsFilterable: true, IsGroupable: true},
				{Name: "status", DisplayName: "Status", DataType: "string", IsFilterable: true, IsGroupable: true, AllowedValues: []string{"issued", "retired", "transferred", "pending"}},
				{Name: "price_per_credit", DisplayName: "Price per Credit", DataType: "number", IsAggregatable: true},
				{Name: "issued_at", DisplayName: "Issued Date", DataType: "date", IsFilterable: true, IsGroupable: true},
			},
			JoinWith: []string{"projects", "transactions"},
		},
		{
			Name:        "transactions",
			DisplayName: "Transactions",
			Description: "Financial transactions and revenue",
			Fields: []FieldMetadata{
				{Name: "id", DisplayName: "Transaction ID", DataType: "string", IsFilterable: true},
				{Name: "type", DisplayName: "Type", DataType: "string", IsFilterable: true, IsGroupable: true, AllowedValues: []string{"sale", "purchase", "retirement", "transfer"}},
				{Name: "amount", DisplayName: "Amount", DataType: "number", IsAggregatable: true},
				{Name: "currency", DisplayName: "Currency", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "status", DisplayName: "Status", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "created_at", DisplayName: "Date", DataType: "date", IsFilterable: true, IsGroupable: true},
			},
			JoinWith: []string{"carbon_credits"},
		},
		{
			Name:        "monitoring_data",
			DisplayName: "Monitoring Data",
			Description: "Environmental monitoring measurements",
			Fields: []FieldMetadata{
				{Name: "id", DisplayName: "Reading ID", DataType: "string", IsFilterable: true},
				{Name: "project_id", DisplayName: "Project ID", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "metric_type", DisplayName: "Metric Type", DataType: "string", IsFilterable: true, IsGroupable: true},
				{Name: "value", DisplayName: "Value", DataType: "number", IsAggregatable: true},
				{Name: "unit", DisplayName: "Unit", DataType: "string", IsFilterable: true},
				{Name: "recorded_at", DisplayName: "Recorded Date", DataType: "date", IsFilterable: true, IsGroupable: true},
			},
			JoinWith: []string{"projects"},
		},
	}, nil
}

// ========== Helper Functions ==========

func (s *service) canAccessReport(report *ReportDefinition, userID uuid.UUID) bool {
	// Public reports are accessible to everyone
	if report.Visibility == VisibilityPublic {
		return true
	}

	// Owner can always access
	if report.CreatedBy != nil && *report.CreatedBy == userID {
		return true
	}

	// Check if user is in shared list
	for _, sharedUserID := range report.SharedWithUsers {
		if sharedUserID == userID {
			return true
		}
	}

	return false
}

func (s *service) canModifyReport(report *ReportDefinition, userID uuid.UUID) bool {
	// Only owner can modify
	return report.CreatedBy != nil && *report.CreatedBy == userID
}

func (s *service) getProjectMetrics(ctx context.Context, projectID uuid.UUID) map[string]float64 {
	// In a real implementation, this would query actual project data
	// For now, return sample data
	return map[string]float64{
		"carbon_sequestration_rate": 15.5,
		"total_credits_issued":      1250.0,
		"revenue_per_hectare":       850.0,
		"monitoring_coverage":       95.0,
		"verification_success_rate": 98.0,
	}
}

func validateReportConfig(config ReportConfig) error {
	if config.Dataset == "" {
		return fmt.Errorf("dataset is required")
	}
	if len(config.Fields) == 0 {
		return fmt.Errorf("at least one field is required")
	}
	return nil
}

func validateCronExpression(expr string) error {
	// Basic validation - in production, use a proper cron parser
	if expr == "" {
		return fmt.Errorf("cron expression is required")
	}
	return nil
}

func calculatePercentileRank(value, median, lowerBound, upperBound float64) float64 {
	if upperBound == lowerBound {
		return 50.0
	}

	percentile := ((value - lowerBound) / (upperBound - lowerBound)) * 100
	if percentile < 0 {
		percentile = 0
	}
	if percentile > 100 {
		percentile = 100
	}
	return percentile
}

func generateRecommendation(metric string, gap float64) string {
	recommendations := map[string]string{
		"carbon_sequestration_rate": "Consider implementing enhanced forest management practices or adding nitrogen-fixing species",
		"revenue_per_hectare":       "Explore premium credit certification options or direct buyer relationships",
		"monitoring_coverage":       "Deploy additional IoT sensors or increase satellite imagery frequency",
		"verification_success_rate": "Review documentation processes and ensure compliance with methodology requirements",
	}

	if rec, exists := recommendations[metric]; exists {
		return rec
	}
	return "Review current practices and consult with technical advisors for improvement strategies"
}
