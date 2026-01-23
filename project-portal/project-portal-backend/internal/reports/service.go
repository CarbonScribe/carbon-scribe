package reports

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service provides business logic for reporting operations
type Service struct {
	repo   Repository
	logger *zap.Logger
}

// NewService creates a new reports service
func NewService(repo Repository, logger *zap.Logger) *Service {
	return &Service{
		repo:   repo,
		logger: logger,
	}
}

// =====================================================
// Report Definition Operations
// =====================================================

// CreateReport creates a new report definition
func (s *Service) CreateReport(ctx context.Context, userID uuid.UUID, req *CreateReportRequest) (*ReportDefinition, error) {
	// Validate the report configuration
	if err := s.validateReportConfig(&req.Config); err != nil {
		return nil, fmt.Errorf("invalid report configuration: %w", err)
	}

	// If based on a template, copy configuration
	if req.BasedOnTemplateID != nil {
		template, err := s.repo.GetReportDefinition(ctx, *req.BasedOnTemplateID)
		if err != nil {
			return nil, fmt.Errorf("template not found: %w", err)
		}
		if !template.IsTemplate {
			return nil, fmt.Errorf("specified report is not a template")
		}
	}

	// Set default visibility if not provided
	visibility := req.Visibility
	if visibility == "" {
		visibility = ReportVisibilityPrivate
	}

	report := &ReportDefinition{
		ID:                uuid.New(),
		Name:              req.Name,
		Description:       req.Description,
		Category:          req.Category,
		Config:            req.Config,
		CreatedBy:         &userID,
		Visibility:        visibility,
		Version:           1,
		IsTemplate:        req.IsTemplate,
		BasedOnTemplateID: req.BasedOnTemplateID,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	// Convert shared user IDs to string array for storage
	if len(req.SharedWithUsers) > 0 {
		userStrs := make([]string, len(req.SharedWithUsers))
		for i, id := range req.SharedWithUsers {
			userStrs[i] = id.String()
		}
		report.SharedWithUsers = userStrs
	}

	if len(req.SharedWithRoles) > 0 {
		report.SharedWithRoles = req.SharedWithRoles
	}

	if err := s.repo.CreateReportDefinition(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	s.logger.Info("Report definition created",
		zap.String("report_id", report.ID.String()),
		zap.String("name", report.Name),
		zap.String("created_by", userID.String()))

	return report, nil
}

// GetReport retrieves a report definition by ID
func (s *Service) GetReport(ctx context.Context, id uuid.UUID) (*ReportDefinition, error) {
	report, err := s.repo.GetReportDefinition(ctx, id)
	if err != nil {
		return nil, err
	}
	return report, nil
}

// UpdateReport updates an existing report definition
func (s *Service) UpdateReport(ctx context.Context, id uuid.UUID, req *UpdateReportRequest) (*ReportDefinition, error) {
	report, err := s.repo.GetReportDefinition(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		report.Name = *req.Name
	}
	if req.Description != nil {
		report.Description = req.Description
	}
	if req.Category != nil {
		report.Category = *req.Category
	}
	if req.Config != nil {
		if err := s.validateReportConfig(req.Config); err != nil {
			return nil, fmt.Errorf("invalid report configuration: %w", err)
		}
		report.Config = *req.Config
	}
	if req.Visibility != nil {
		report.Visibility = *req.Visibility
	}

	// Convert shared user IDs to string array
	if len(req.SharedWithUsers) > 0 {
		userStrs := make([]string, len(req.SharedWithUsers))
		for i, uid := range req.SharedWithUsers {
			userStrs[i] = uid.String()
		}
		report.SharedWithUsers = userStrs
	}

	if len(req.SharedWithRoles) > 0 {
		report.SharedWithRoles = req.SharedWithRoles
	}

	report.Version++
	report.UpdatedAt = time.Now()

	if err := s.repo.UpdateReportDefinition(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to update report: %w", err)
	}

	s.logger.Info("Report definition updated",
		zap.String("report_id", id.String()),
		zap.Int("new_version", report.Version))

	return report, nil
}

// DeleteReport deletes a report definition
func (s *Service) DeleteReport(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.DeleteReportDefinition(ctx, id); err != nil {
		return err
	}

	s.logger.Info("Report definition deleted", zap.String("report_id", id.String()))
	return nil
}

// ListReports lists report definitions with filters
func (s *Service) ListReports(ctx context.Context, filters *ReportFilters) (*ReportListResponse, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PageSize < 1 || filters.PageSize > 100 {
		filters.PageSize = 20
	}

	reports, total, err := s.repo.ListReportDefinitions(ctx, filters)
	if err != nil {
		return nil, err
	}

	return &ReportListResponse{
		Reports:    reports,
		TotalCount: total,
		Page:       filters.Page,
		PageSize:   filters.PageSize,
		HasMore:    filters.Page*filters.PageSize < total,
	}, nil
}

// GetTemplates retrieves available report templates
func (s *Service) GetTemplates(ctx context.Context) ([]*ReportDefinition, error) {
	return s.repo.GetReportTemplates(ctx)
}

// validateReportConfig validates the report configuration
func (s *Service) validateReportConfig(config *ReportConfig) error {
	if config.Dataset == "" {
		return fmt.Errorf("dataset is required")
	}

	if len(config.Fields) == 0 {
		return fmt.Errorf("at least one field is required")
	}

	// Validate filters
	for _, filter := range config.Filters {
		if filter.Field == "" {
			return fmt.Errorf("filter field is required")
		}
		if filter.Operator == "" {
			return fmt.Errorf("filter operator is required")
		}
	}

	return nil
}

// =====================================================
// Report Execution Operations
// =====================================================

// ExecuteReport executes a report and returns results or creates an async job
func (s *Service) ExecuteReport(ctx context.Context, reportID uuid.UUID, userID uuid.UUID, req *ExecuteReportRequest) (*ExecutionResponse, error) {
	// Get the report definition
	report, err := s.repo.GetReportDefinition(ctx, reportID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	// Merge runtime filters with report filters
	config := report.Config
	if len(req.Filters) > 0 {
		config.Filters = append(config.Filters, req.Filters...)
	}

	// Create execution record
	execution := &ReportExecution{
		ID:                 uuid.New(),
		ReportDefinitionID: reportID,
		TriggeredBy:        &userID,
		TriggeredAt:        time.Now(),
		Status:             ExecutionStatusPending,
		Parameters:         req.Parameters,
		CreatedAt:          time.Now(),
	}

	if err := s.repo.CreateExecution(ctx, execution); err != nil {
		return nil, fmt.Errorf("failed to create execution record: %w", err)
	}

	// For async execution, return immediately
	if req.Async {
		s.logger.Info("Report execution queued (async)",
			zap.String("execution_id", execution.ID.String()),
			zap.String("report_id", reportID.String()))

		return &ExecutionResponse{
			ExecutionID: execution.ID,
			Status:      ExecutionStatusPending,
			Message:     "Report execution queued. Check status for updates.",
		}, nil
	}

	// For synchronous execution, run immediately
	result, err := s.processExecution(ctx, execution, &config, req.Format)
	if err != nil {
		// Update execution with error
		execution.Status = ExecutionStatusFailed
		errMsg := err.Error()
		execution.ErrorMessage = &errMsg
		execution.CompletedAt = &[]time.Time{time.Now()}[0]
		s.repo.UpdateExecution(ctx, execution)

		return nil, fmt.Errorf("report execution failed: %w", err)
	}

	return result, nil
}

// processExecution processes a report execution
func (s *Service) processExecution(ctx context.Context, execution *ReportExecution, config *ReportConfig, format ExportFormat) (*ExecutionResponse, error) {
	startTime := time.Now()

	// Update status to processing
	execution.Status = ExecutionStatusProcessing
	execution.StartedAt = &startTime
	s.repo.UpdateExecution(ctx, execution)

	// Execute the query
	results, totalCount, err := s.repo.ExecuteReportQuery(ctx, config, nil)
	if err != nil {
		return nil, err
	}

	// Calculate duration
	duration := int(time.Since(startTime).Milliseconds())
	execution.DurationMs = &duration
	execution.RecordCount = &totalCount

	// For now, we'll store results in memory
	// In production, export to file and upload to S3
	execution.Status = ExecutionStatusCompleted
	completedAt := time.Now()
	execution.CompletedAt = &completedAt

	// Update execution record
	if err := s.repo.UpdateExecution(ctx, execution); err != nil {
		s.logger.Error("Failed to update execution record", zap.Error(err))
	}

	s.logger.Info("Report execution completed",
		zap.String("execution_id", execution.ID.String()),
		zap.Int("record_count", totalCount),
		zap.Int("duration_ms", duration))

	return &ExecutionResponse{
		ExecutionID:   execution.ID,
		Status:        ExecutionStatusCompleted,
		Message:       "Report execution completed successfully",
		RecordCount:   &totalCount,
	}, nil
}

// GetExecution retrieves execution details
func (s *Service) GetExecution(ctx context.Context, id uuid.UUID) (*ReportExecution, error) {
	return s.repo.GetExecution(ctx, id)
}

// ListExecutions lists report executions with filters
func (s *Service) ListExecutions(ctx context.Context, filters *ExecutionFilters) ([]*ReportExecution, int, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PageSize < 1 || filters.PageSize > 100 {
		filters.PageSize = 20
	}

	return s.repo.ListExecutions(ctx, filters)
}

// =====================================================
// Schedule Operations
// =====================================================

// CreateSchedule creates a new report schedule
func (s *Service) CreateSchedule(ctx context.Context, userID uuid.UUID, req *CreateScheduleRequest) (*ReportSchedule, error) {
	// Verify the report exists
	_, err := s.repo.GetReportDefinition(ctx, req.ReportDefinitionID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	// Calculate next execution time
	nextExecution := s.calculateNextExecution(req.CronExpression, req.Timezone)

	timezone := req.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	schedule := &ReportSchedule{
		ID:                 uuid.New(),
		ReportDefinitionID: req.ReportDefinitionID,
		Name:               req.Name,
		CronExpression:     req.CronExpression,
		Timezone:           timezone,
		StartDate:          req.StartDate,
		EndDate:            req.EndDate,
		IsActive:           true,
		Format:             req.Format,
		DeliveryMethod:     req.DeliveryMethod,
		DeliveryConfig:     req.DeliveryConfig,
		NextExecutionAt:    &nextExecution,
		CreatedBy:          &userID,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	if len(req.RecipientEmails) > 0 {
		schedule.RecipientEmails = req.RecipientEmails
	}

	if len(req.RecipientUserIDs) > 0 {
		userStrs := make([]string, len(req.RecipientUserIDs))
		for i, id := range req.RecipientUserIDs {
			userStrs[i] = id.String()
		}
		schedule.RecipientUserIDs = userStrs
	}

	schedule.WebhookURL = req.WebhookURL

	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}

	s.logger.Info("Report schedule created",
		zap.String("schedule_id", schedule.ID.String()),
		zap.String("report_id", req.ReportDefinitionID.String()),
		zap.String("cron", req.CronExpression))

	return schedule, nil
}

// GetSchedule retrieves a schedule by ID
func (s *Service) GetSchedule(ctx context.Context, id uuid.UUID) (*ReportSchedule, error) {
	return s.repo.GetSchedule(ctx, id)
}

// UpdateSchedule updates an existing schedule
func (s *Service) UpdateSchedule(ctx context.Context, id uuid.UUID, req *UpdateScheduleRequest) (*ReportSchedule, error) {
	schedule, err := s.repo.GetSchedule(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		schedule.Name = *req.Name
	}
	if req.CronExpression != nil {
		schedule.CronExpression = *req.CronExpression
		// Recalculate next execution
		nextExecution := s.calculateNextExecution(*req.CronExpression, schedule.Timezone)
		schedule.NextExecutionAt = &nextExecution
	}
	if req.Timezone != nil {
		schedule.Timezone = *req.Timezone
	}
	if req.StartDate != nil {
		schedule.StartDate = req.StartDate
	}
	if req.EndDate != nil {
		schedule.EndDate = req.EndDate
	}
	if req.IsActive != nil {
		schedule.IsActive = *req.IsActive
	}
	if req.Format != nil {
		schedule.Format = *req.Format
	}
	if req.DeliveryMethod != nil {
		schedule.DeliveryMethod = *req.DeliveryMethod
	}
	if req.DeliveryConfig != nil {
		schedule.DeliveryConfig = req.DeliveryConfig
	}
	if len(req.RecipientEmails) > 0 {
		schedule.RecipientEmails = req.RecipientEmails
	}
	if len(req.RecipientUserIDs) > 0 {
		userStrs := make([]string, len(req.RecipientUserIDs))
		for i, uid := range req.RecipientUserIDs {
			userStrs[i] = uid.String()
		}
		schedule.RecipientUserIDs = userStrs
	}
	if req.WebhookURL != nil {
		schedule.WebhookURL = req.WebhookURL
	}

	schedule.UpdatedAt = time.Now()

	if err := s.repo.UpdateSchedule(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to update schedule: %w", err)
	}

	s.logger.Info("Report schedule updated", zap.String("schedule_id", id.String()))

	return schedule, nil
}

// DeleteSchedule deletes a schedule
func (s *Service) DeleteSchedule(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.DeleteSchedule(ctx, id); err != nil {
		return err
	}

	s.logger.Info("Report schedule deleted", zap.String("schedule_id", id.String()))
	return nil
}

// ListSchedules lists schedules with filters
func (s *Service) ListSchedules(ctx context.Context, filters *ScheduleFilters) ([]*ReportSchedule, int, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PageSize < 1 || filters.PageSize > 100 {
		filters.PageSize = 20
	}

	return s.repo.ListSchedules(ctx, filters)
}

// calculateNextExecution calculates the next execution time based on cron expression
func (s *Service) calculateNextExecution(cronExpr, timezone string) time.Time {
	// Simplified implementation - in production, use a proper cron parser
	// For now, default to 1 hour from now
	return time.Now().Add(1 * time.Hour)
}

// =====================================================
// Dashboard Operations
// =====================================================

// GetDashboardSummary retrieves aggregated dashboard data
func (s *Service) GetDashboardSummary(ctx context.Context, req *DashboardSummaryRequest) (*DashboardSummaryResponse, error) {
	// Build aggregate key based on request
	aggregateKey := "dashboard_summary"
	if req.ProjectID != nil {
		aggregateKey = fmt.Sprintf("project_summary_%s", req.ProjectID.String())
	}
	if req.PeriodType != "" {
		aggregateKey += "_" + string(req.PeriodType)
	}

	// Try to get cached aggregate
	aggregate, err := s.repo.GetAggregate(ctx, aggregateKey)
	if err != nil {
		s.logger.Error("Failed to get cached aggregate", zap.Error(err))
	}

	// If cached and not stale, return cached data
	if aggregate != nil && !aggregate.IsStale {
		summary := s.convertAggregateToSummary(aggregate)
		return &DashboardSummaryResponse{
			Summary:     summary,
			ComputedAt:  aggregate.ComputedAt,
			NextRefresh: aggregate.ComputedAt.Add(5 * time.Minute),
		}, nil
	}

	// Otherwise, compute fresh data
	summary, err := s.computeDashboardSummary(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to compute dashboard summary: %w", err)
	}

	// Cache the result
	now := time.Now()
	newAggregate := &DashboardAggregate{
		ID:            uuid.New(),
		AggregateKey:  aggregateKey,
		AggregateType: "dashboard_summary",
		ProjectID:     req.ProjectID,
		PeriodType:    req.PeriodType,
		PeriodStart:   req.StartDate,
		PeriodEnd:     req.EndDate,
		Data:          s.summaryToJSONB(summary),
		ComputedAt:    now,
		IsStale:       false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.UpsertAggregate(ctx, newAggregate); err != nil {
		s.logger.Error("Failed to cache aggregate", zap.Error(err))
	}

	return &DashboardSummaryResponse{
		Summary:     *summary,
		ComputedAt:  now,
		NextRefresh: now.Add(5 * time.Minute),
	}, nil
}

// computeDashboardSummary computes fresh dashboard summary data
func (s *Service) computeDashboardSummary(ctx context.Context, req *DashboardSummaryRequest) (*DashboardSummary, error) {
	// In production, this would query multiple tables and compute aggregates
	// For now, return mock data
	summary := &DashboardSummary{
		TotalProjects:        15,
		ActiveProjects:       12,
		TotalCreditsIssued:   45230.5,
		TotalCreditsRetired:  12450.0,
		TotalRevenue:         678500.00,
		AverageNDVI:          0.72,
		ActiveAlerts:         3,
		PendingVerifications: 5,
		ProjectsByStatus: map[string]int{
			"active":     12,
			"pending":    2,
			"completed":  1,
		},
		RevenueByMonth: map[string]float64{
			"2025-10": 85000.00,
			"2025-11": 92500.00,
			"2025-12": 78000.00,
			"2026-01": 67500.00,
		},
	}

	return summary, nil
}

// convertAggregateToSummary converts cached aggregate to DashboardSummary
func (s *Service) convertAggregateToSummary(aggregate *DashboardAggregate) DashboardSummary {
	summary := DashboardSummary{}

	if aggregate.Data == nil {
		return summary
	}

	// Extract values from JSONB
	if v, ok := aggregate.Data["total_projects"].(float64); ok {
		summary.TotalProjects = int(v)
	}
	if v, ok := aggregate.Data["active_projects"].(float64); ok {
		summary.ActiveProjects = int(v)
	}
	if v, ok := aggregate.Data["total_credits_issued"].(float64); ok {
		summary.TotalCreditsIssued = v
	}
	if v, ok := aggregate.Data["total_credits_retired"].(float64); ok {
		summary.TotalCreditsRetired = v
	}
	if v, ok := aggregate.Data["total_revenue"].(float64); ok {
		summary.TotalRevenue = v
	}
	if v, ok := aggregate.Data["average_ndvi"].(float64); ok {
		summary.AverageNDVI = v
	}
	if v, ok := aggregate.Data["active_alerts"].(float64); ok {
		summary.ActiveAlerts = int(v)
	}
	if v, ok := aggregate.Data["pending_verifications"].(float64); ok {
		summary.PendingVerifications = int(v)
	}

	return summary
}

// summaryToJSONB converts DashboardSummary to JSONB
func (s *Service) summaryToJSONB(summary *DashboardSummary) JSONB {
	return JSONB{
		"total_projects":        summary.TotalProjects,
		"active_projects":       summary.ActiveProjects,
		"total_credits_issued":  summary.TotalCreditsIssued,
		"total_credits_retired": summary.TotalCreditsRetired,
		"total_revenue":         summary.TotalRevenue,
		"average_ndvi":          summary.AverageNDVI,
		"active_alerts":         summary.ActiveAlerts,
		"pending_verifications": summary.PendingVerifications,
		"projects_by_status":    summary.ProjectsByStatus,
		"revenue_by_month":      summary.RevenueByMonth,
	}
}

// =====================================================
// Benchmark Operations
// =====================================================

// CompareBenchmark compares project metrics against benchmarks
func (s *Service) CompareBenchmark(ctx context.Context, req *BenchmarkComparisonRequest) (*BenchmarkComparisonResponse, error) {
	// Get relevant benchmarks
	benchmarks, err := s.repo.GetBenchmarksByCategory(ctx, req.Category, req.Methodology, req.Region, req.Year)
	if err != nil {
		return nil, fmt.Errorf("failed to get benchmarks: %w", err)
	}

	if len(benchmarks) == 0 {
		return nil, fmt.Errorf("no benchmarks found for the specified criteria")
	}

	// Get project metrics (in production, query actual project data)
	projectMetrics := s.getProjectMetrics(ctx, req.ProjectID, req.Category)

	// Extract benchmark values
	benchmark := benchmarks[0] // Use the most relevant benchmark
	benchmarkMetrics := s.extractBenchmarkMetrics(benchmark)

	// Calculate percentile rankings
	percentileRanking := s.calculatePercentileRanking(projectMetrics, benchmark)

	// Perform gap analysis
	gapAnalysis := s.performGapAnalysis(projectMetrics, benchmarkMetrics)

	// Generate recommendations
	recommendations := s.generateRecommendations(gapAnalysis)

	return &BenchmarkComparisonResponse{
		ProjectMetrics:    projectMetrics,
		BenchmarkMetrics:  benchmarkMetrics,
		PercentileRanking: percentileRanking,
		GapAnalysis:       gapAnalysis,
		Recommendations:   recommendations,
		ComputedAt:        time.Now(),
	}, nil
}

// getProjectMetrics retrieves project metrics for comparison
func (s *Service) getProjectMetrics(ctx context.Context, projectID uuid.UUID, category BenchmarkCategory) map[string]float64 {
	// In production, query actual project data
	// For now, return mock data based on category
	switch category {
	case BenchmarkCategoryCarbonSequestration:
		return map[string]float64{
			"carbon_per_hectare": 4.2,
			"annual_growth_rate": 0.15,
			"verification_score": 0.92,
		}
	case BenchmarkCategoryRevenue:
		return map[string]float64{
			"price_per_ton":     17.50,
			"sales_volume":      1250.0,
			"revenue_per_hectare": 525.0,
		}
	default:
		return map[string]float64{}
	}
}

// extractBenchmarkMetrics extracts metrics from benchmark dataset
func (s *Service) extractBenchmarkMetrics(benchmark *BenchmarkDataset) map[string]BenchmarkValue {
	metrics := make(map[string]BenchmarkValue)

	if benchmark.Statistics == nil {
		return metrics
	}

	// Extract statistics from benchmark
	stats := benchmark.Statistics

	// Get unit from data
	unit := ""
	if benchmark.Data != nil {
		if u, ok := benchmark.Data["unit"].(string); ok {
			unit = u
		}
	}

	// Create primary benchmark value
	primaryMetric := BenchmarkValue{
		Unit: unit,
	}

	if v, ok := stats["mean"].(float64); ok {
		primaryMetric.Mean = v
	}
	if v, ok := stats["median"].(float64); ok {
		primaryMetric.Median = v
	}
	if v, ok := stats["min"].(float64); ok {
		primaryMetric.Min = v
	}
	if v, ok := stats["max"].(float64); ok {
		primaryMetric.Max = v
	}
	if v, ok := stats["p25"].(float64); ok {
		primaryMetric.P25 = v
	}
	if v, ok := stats["p75"].(float64); ok {
		primaryMetric.P75 = v
	}
	if v, ok := stats["p90"].(float64); ok {
		primaryMetric.P90 = v
	}
	if v, ok := stats["std_dev"].(float64); ok {
		primaryMetric.StdDev = v
	}
	if benchmark.SampleSize != nil {
		primaryMetric.SampleSize = *benchmark.SampleSize
	}

	// Use category-specific metric name
	metricName := string(benchmark.Category)
	metrics[metricName] = primaryMetric

	return metrics
}

// calculatePercentileRanking calculates where project metrics fall in benchmark distribution
func (s *Service) calculatePercentileRanking(projectMetrics map[string]float64, benchmark *BenchmarkDataset) map[string]float64 {
	rankings := make(map[string]float64)

	if benchmark.Statistics == nil || benchmark.Data == nil {
		return rankings
	}

	// Get benchmark values array
	values, ok := benchmark.Data["values"].([]interface{})
	if !ok {
		return rankings
	}

	// Convert to float64 array and sort
	floatValues := make([]float64, 0, len(values))
	for _, v := range values {
		if f, ok := v.(float64); ok {
			floatValues = append(floatValues, f)
		}
	}
	sort.Float64s(floatValues)

	// Calculate percentile for each project metric
	for metricName, projectValue := range projectMetrics {
		// Find position in sorted array
		position := 0
		for i, v := range floatValues {
			if projectValue <= v {
				position = i
				break
			}
			position = i + 1
		}

		// Calculate percentile
		percentile := float64(position) / float64(len(floatValues)) * 100
		rankings[metricName] = math.Round(percentile*100) / 100
	}

	return rankings
}

// performGapAnalysis analyzes gaps between project metrics and benchmarks
func (s *Service) performGapAnalysis(projectMetrics map[string]float64, benchmarkMetrics map[string]BenchmarkValue) []GapItem {
	var gaps []GapItem

	for metricName, projectValue := range projectMetrics {
		// Find corresponding benchmark
		if benchmark, ok := benchmarkMetrics[metricName]; ok {
			gap := projectValue - benchmark.Median
			gapPercentage := 0.0
			if benchmark.Median != 0 {
				gapPercentage = (gap / benchmark.Median) * 100
			}

			priority := "low"
			if math.Abs(gapPercentage) > 20 {
				priority = "high"
			} else if math.Abs(gapPercentage) > 10 {
				priority = "medium"
			}

			gaps = append(gaps, GapItem{
				Metric:        metricName,
				CurrentValue:  projectValue,
				TargetValue:   benchmark.Median,
				Gap:           gap,
				GapPercentage: math.Round(gapPercentage*100) / 100,
				Priority:      priority,
			})
		}
	}

	// Sort by priority (high first)
	sort.Slice(gaps, func(i, j int) bool {
		priorityOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
		return priorityOrder[gaps[i].Priority] < priorityOrder[gaps[j].Priority]
	})

	return gaps
}

// generateRecommendations generates recommendations based on gap analysis
func (s *Service) generateRecommendations(gaps []GapItem) []string {
	var recommendations []string

	for _, gap := range gaps {
		if gap.Priority == "high" && gap.Gap < 0 {
			recommendations = append(recommendations,
				fmt.Sprintf("Priority improvement needed for %s: Currently %.2f, target %.2f (%.1f%% below benchmark)",
					gap.Metric, gap.CurrentValue, gap.TargetValue, math.Abs(gap.GapPercentage)))
		} else if gap.Gap > 0 {
			recommendations = append(recommendations,
				fmt.Sprintf("Excellent performance on %s: Currently %.2f, exceeds benchmark by %.1f%%",
					gap.Metric, gap.CurrentValue, gap.GapPercentage))
		}
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "Performance is within expected benchmark ranges.")
	}

	return recommendations
}

// ListBenchmarks lists available benchmarks
func (s *Service) ListBenchmarks(ctx context.Context, filters *BenchmarkFilters) ([]*BenchmarkDataset, int, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PageSize < 1 || filters.PageSize > 100 {
		filters.PageSize = 20
	}

	return s.repo.ListBenchmarks(ctx, filters)
}

// =====================================================
// Data Source Operations
// =====================================================

// GetDataSources retrieves available data sources for report building
func (s *Service) GetDataSources(ctx context.Context) ([]*DataSourceResponse, error) {
	sources, err := s.repo.GetDataSources(ctx)
	if err != nil {
		return nil, err
	}

	var responses []*DataSourceResponse
	for _, source := range sources {
		response := &DataSourceResponse{
			Name:              source.Name,
			DisplayName:       source.DisplayName,
			SupportsStreaming: source.SupportsStreaming,
		}

		if source.Description != nil {
			response.Description = *source.Description
		}

		if source.EstimatedRowCount != nil {
			response.EstimatedRows = *source.EstimatedRowCount
		}

		// Extract field information from schema
		if source.SchemaDefinition != nil {
			if fields, ok := source.SchemaDefinition["fields"].([]interface{}); ok {
				for _, f := range fields {
					if fieldMap, ok := f.(map[string]interface{}); ok {
						fieldInfo := DataSourceFieldInfo{
							Filterable:   true,
							Sortable:     true,
							Groupable:    true,
							Aggregatable: true,
						}

						if name, ok := fieldMap["name"].(string); ok {
							fieldInfo.Name = name
						}
						if typ, ok := fieldMap["type"].(string); ok {
							fieldInfo.Type = typ
						}
						if label, ok := fieldMap["label"].(string); ok {
							fieldInfo.Label = label
						}

						response.Fields = append(response.Fields, fieldInfo)
					}
				}
			}
		}

		responses = append(responses, response)
	}

	return responses, nil
}

// GetDataSource retrieves a specific data source by name
func (s *Service) GetDataSource(ctx context.Context, name string) (*DataSourceResponse, error) {
	source, err := s.repo.GetDataSource(ctx, name)
	if err != nil {
		return nil, err
	}

	response := &DataSourceResponse{
		Name:              source.Name,
		DisplayName:       source.DisplayName,
		SupportsStreaming: source.SupportsStreaming,
	}

	if source.Description != nil {
		response.Description = *source.Description
	}

	if source.EstimatedRowCount != nil {
		response.EstimatedRows = *source.EstimatedRowCount
	}

	// Extract field information from schema
	if source.SchemaDefinition != nil {
		if fields, ok := source.SchemaDefinition["fields"].([]interface{}); ok {
			for _, f := range fields {
				if fieldMap, ok := f.(map[string]interface{}); ok {
					fieldInfo := DataSourceFieldInfo{
						Filterable:   true,
						Sortable:     true,
						Groupable:    true,
						Aggregatable: true,
					}

					if name, ok := fieldMap["name"].(string); ok {
						fieldInfo.Name = name
					}
					if typ, ok := fieldMap["type"].(string); ok {
						fieldInfo.Type = typ
					}
					if label, ok := fieldMap["label"].(string); ok {
						fieldInfo.Label = label
					}

					response.Fields = append(response.Fields, fieldInfo)
				}
			}
		}
	}

	return response, nil
}

// =====================================================
// Widget Operations
// =====================================================

// GetUserWidgets retrieves widgets for a user's dashboard
func (s *Service) GetUserWidgets(ctx context.Context, userID uuid.UUID, section *string) ([]*DashboardWidget, error) {
	return s.repo.GetUserWidgets(ctx, userID, section)
}

// CreateWidget creates a new dashboard widget
func (s *Service) CreateWidget(ctx context.Context, userID uuid.UUID, widget *DashboardWidget) (*DashboardWidget, error) {
	widget.ID = uuid.New()
	widget.UserID = userID
	widget.CreatedAt = time.Now()
	widget.UpdatedAt = time.Now()

	if widget.RefreshIntervalSeconds == 0 {
		widget.RefreshIntervalSeconds = 300 // 5 minutes default
	}
	if widget.Size == "" {
		widget.Size = WidgetSizeMedium
	}
	if widget.RowSpan == 0 {
		widget.RowSpan = 1
	}
	if widget.ColSpan == 0 {
		widget.ColSpan = 1
	}
	widget.IsVisible = true

	if err := s.repo.CreateWidget(ctx, widget); err != nil {
		return nil, fmt.Errorf("failed to create widget: %w", err)
	}

	s.logger.Info("Dashboard widget created",
		zap.String("widget_id", widget.ID.String()),
		zap.String("user_id", userID.String()))

	return widget, nil
}

// UpdateWidget updates an existing dashboard widget
func (s *Service) UpdateWidget(ctx context.Context, widget *DashboardWidget) (*DashboardWidget, error) {
	widget.UpdatedAt = time.Now()

	if err := s.repo.UpdateWidget(ctx, widget); err != nil {
		return nil, fmt.Errorf("failed to update widget: %w", err)
	}

	s.logger.Info("Dashboard widget updated", zap.String("widget_id", widget.ID.String()))

	return widget, nil
}

// DeleteWidget deletes a dashboard widget
func (s *Service) DeleteWidget(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.DeleteWidget(ctx, id); err != nil {
		return err
	}

	s.logger.Info("Dashboard widget deleted", zap.String("widget_id", id.String()))
	return nil
}
