package reports

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Handler handles HTTP requests for reporting operations
type Handler struct {
	service *Service
	logger  *zap.Logger
}

// NewHandler creates a new reports handler
func NewHandler(service *Service, logger *zap.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

// RegisterRoutes registers reporting routes
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	reports := router.Group("/reports")
	{
		// Report Builder endpoints
		reports.POST("/builder", h.createReport)
		reports.GET("", h.listReports)
		reports.GET("/templates", h.getTemplates)
		reports.GET("/:id", h.getReport)
		reports.PUT("/:id", h.updateReport)
		reports.DELETE("/:id", h.deleteReport)

		// Report Execution endpoints
		reports.POST("/:id/execute", h.executeReport)
		reports.GET("/:id/export", h.exportReport)
		reports.GET("/executions", h.listExecutions)
		reports.GET("/executions/:executionId", h.getExecution)

		// Dashboard endpoints
		reports.GET("/dashboard/summary", h.getDashboardSummary)
		reports.GET("/dashboard/widgets", h.getUserWidgets)
		reports.POST("/dashboard/widgets", h.createWidget)
		reports.PUT("/dashboard/widgets/:widgetId", h.updateWidget)
		reports.DELETE("/dashboard/widgets/:widgetId", h.deleteWidget)

		// Schedule endpoints
		reports.POST("/schedules", h.createSchedule)
		reports.GET("/schedules", h.listSchedules)
		reports.GET("/schedules/:scheduleId", h.getSchedule)
		reports.PUT("/schedules/:scheduleId", h.updateSchedule)
		reports.DELETE("/schedules/:scheduleId", h.deleteSchedule)

		// Benchmark endpoints
		reports.POST("/benchmark/comparison", h.compareBenchmark)
		reports.GET("/benchmarks", h.listBenchmarks)

		// Data source endpoints
		reports.GET("/datasets", h.getDataSources)
		reports.GET("/datasets/:name", h.getDataSource)
	}
}

// =====================================================
// Report Builder Endpoints
// =====================================================

// createReport handles POST /api/v1/reports/builder
func (h *Handler) createReport(c *gin.Context) {
	var req CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID := h.getUserID(c)

	report, err := h.service.CreateReport(c.Request.Context(), userID, &req)
	if err != nil {
		h.logger.Error("Failed to create report", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, report)
}

// listReports handles GET /api/v1/reports
func (h *Handler) listReports(c *gin.Context) {
	filters := &ReportFilters{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
	}

	// Parse optional filters
	if category := c.Query("category"); category != "" {
		cat := ReportCategory(category)
		filters.Category = &cat
	}
	if visibility := c.Query("visibility"); visibility != "" {
		vis := ReportVisibility(visibility)
		filters.Visibility = &vis
	}
	if isTemplate := c.Query("is_template"); isTemplate != "" {
		t := isTemplate == "true"
		filters.IsTemplate = &t
	}
	if search := c.Query("search"); search != "" {
		filters.SearchTerm = &search
	}

	response, err := h.service.ListReports(c.Request.Context(), filters)
	if err != nil {
		h.logger.Error("Failed to list reports", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// getReport handles GET /api/v1/reports/:id
func (h *Handler) getReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	report, err := h.service.GetReport(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to get report", zap.Error(err), zap.String("report_id", id.String()))
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

// updateReport handles PUT /api/v1/reports/:id
func (h *Handler) updateReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	var req UpdateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.service.UpdateReport(c.Request.Context(), id, &req)
	if err != nil {
		h.logger.Error("Failed to update report", zap.Error(err), zap.String("report_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

// deleteReport handles DELETE /api/v1/reports/:id
func (h *Handler) deleteReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	if err := h.service.DeleteReport(c.Request.Context(), id); err != nil {
		h.logger.Error("Failed to delete report", zap.Error(err), zap.String("report_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// getTemplates handles GET /api/v1/reports/templates
func (h *Handler) getTemplates(c *gin.Context) {
	templates, err := h.service.GetTemplates(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get templates", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

// =====================================================
// Report Execution Endpoints
// =====================================================

// executeReport handles POST /api/v1/reports/:id/execute
func (h *Handler) executeReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	var req ExecuteReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := h.getUserID(c)

	response, err := h.service.ExecuteReport(c.Request.Context(), id, userID, &req)
	if err != nil {
		h.logger.Error("Failed to execute report", zap.Error(err), zap.String("report_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// exportReport handles GET /api/v1/reports/:id/export
func (h *Handler) exportReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	// Get export format from query params
	format := ExportFormat(c.DefaultQuery("format", "csv"))
	if format != ExportFormatCSV && format != ExportFormatExcel && format != ExportFormatPDF && format != ExportFormatJSON {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid export format"})
		return
	}

	userID := h.getUserID(c)

	// Create execution request for export
	req := &ExecuteReportRequest{
		Format: format,
		Async:  false,
	}

	response, err := h.service.ExecuteReport(c.Request.Context(), id, userID, req)
	if err != nil {
		h.logger.Error("Failed to export report", zap.Error(err), zap.String("report_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// listExecutions handles GET /api/v1/reports/executions
func (h *Handler) listExecutions(c *gin.Context) {
	filters := &ExecutionFilters{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
	}

	// Parse optional filters
	if reportID := c.Query("report_id"); reportID != "" {
		if id, err := uuid.Parse(reportID); err == nil {
			filters.ReportDefinitionID = &id
		}
	}
	if scheduleID := c.Query("schedule_id"); scheduleID != "" {
		if id, err := uuid.Parse(scheduleID); err == nil {
			filters.ScheduleID = &id
		}
	}
	if status := c.Query("status"); status != "" {
		s := ExecutionStatus(status)
		filters.Status = &s
	}

	executions, total, err := h.service.ListExecutions(c.Request.Context(), filters)
	if err != nil {
		h.logger.Error("Failed to list executions", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"executions":  executions,
		"total_count": total,
		"page":        filters.Page,
		"page_size":   filters.PageSize,
	})
}

// getExecution handles GET /api/v1/reports/executions/:executionId
func (h *Handler) getExecution(c *gin.Context) {
	id, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid execution ID"})
		return
	}

	execution, err := h.service.GetExecution(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to get execution", zap.Error(err), zap.String("execution_id", id.String()))
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, execution)
}

// =====================================================
// Dashboard Endpoints
// =====================================================

// getDashboardSummary handles GET /api/v1/reports/dashboard/summary
func (h *Handler) getDashboardSummary(c *gin.Context) {
	req := &DashboardSummaryRequest{}

	// Parse optional filters
	if projectID := c.Query("project_id"); projectID != "" {
		if id, err := uuid.Parse(projectID); err == nil {
			req.ProjectID = &id
		}
	}
	if periodType := c.Query("period_type"); periodType != "" {
		req.PeriodType = PeriodType(periodType)
	}

	response, err := h.service.GetDashboardSummary(c.Request.Context(), req)
	if err != nil {
		h.logger.Error("Failed to get dashboard summary", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// getUserWidgets handles GET /api/v1/reports/dashboard/widgets
func (h *Handler) getUserWidgets(c *gin.Context) {
	userID := h.getUserID(c)

	var section *string
	if s := c.Query("section"); s != "" {
		section = &s
	}

	widgets, err := h.service.GetUserWidgets(c.Request.Context(), userID, section)
	if err != nil {
		h.logger.Error("Failed to get user widgets", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"widgets": widgets})
}

// createWidget handles POST /api/v1/reports/dashboard/widgets
func (h *Handler) createWidget(c *gin.Context) {
	var widget DashboardWidget
	if err := c.ShouldBindJSON(&widget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := h.getUserID(c)

	result, err := h.service.CreateWidget(c.Request.Context(), userID, &widget)
	if err != nil {
		h.logger.Error("Failed to create widget", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// updateWidget handles PUT /api/v1/reports/dashboard/widgets/:widgetId
func (h *Handler) updateWidget(c *gin.Context) {
	id, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	var widget DashboardWidget
	if err := c.ShouldBindJSON(&widget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	widget.ID = id

	result, err := h.service.UpdateWidget(c.Request.Context(), &widget)
	if err != nil {
		h.logger.Error("Failed to update widget", zap.Error(err), zap.String("widget_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// deleteWidget handles DELETE /api/v1/reports/dashboard/widgets/:widgetId
func (h *Handler) deleteWidget(c *gin.Context) {
	id, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	if err := h.service.DeleteWidget(c.Request.Context(), id); err != nil {
		h.logger.Error("Failed to delete widget", zap.Error(err), zap.String("widget_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// =====================================================
// Schedule Endpoints
// =====================================================

// createSchedule handles POST /api/v1/reports/schedules
func (h *Handler) createSchedule(c *gin.Context) {
	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := h.getUserID(c)

	schedule, err := h.service.CreateSchedule(c.Request.Context(), userID, &req)
	if err != nil {
		h.logger.Error("Failed to create schedule", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, schedule)
}

// listSchedules handles GET /api/v1/reports/schedules
func (h *Handler) listSchedules(c *gin.Context) {
	filters := &ScheduleFilters{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
	}

	// Parse optional filters
	if reportID := c.Query("report_id"); reportID != "" {
		if id, err := uuid.Parse(reportID); err == nil {
			filters.ReportDefinitionID = &id
		}
	}
	if isActive := c.Query("is_active"); isActive != "" {
		active := isActive == "true"
		filters.IsActive = &active
	}

	schedules, total, err := h.service.ListSchedules(c.Request.Context(), filters)
	if err != nil {
		h.logger.Error("Failed to list schedules", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"schedules":   schedules,
		"total_count": total,
		"page":        filters.Page,
		"page_size":   filters.PageSize,
	})
}

// getSchedule handles GET /api/v1/reports/schedules/:scheduleId
func (h *Handler) getSchedule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	schedule, err := h.service.GetSchedule(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to get schedule", zap.Error(err), zap.String("schedule_id", id.String()))
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schedule)
}

// updateSchedule handles PUT /api/v1/reports/schedules/:scheduleId
func (h *Handler) updateSchedule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	var req UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	schedule, err := h.service.UpdateSchedule(c.Request.Context(), id, &req)
	if err != nil {
		h.logger.Error("Failed to update schedule", zap.Error(err), zap.String("schedule_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schedule)
}

// deleteSchedule handles DELETE /api/v1/reports/schedules/:scheduleId
func (h *Handler) deleteSchedule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	if err := h.service.DeleteSchedule(c.Request.Context(), id); err != nil {
		h.logger.Error("Failed to delete schedule", zap.Error(err), zap.String("schedule_id", id.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// =====================================================
// Benchmark Endpoints
// =====================================================

// compareBenchmark handles POST /api/v1/reports/benchmark/comparison
func (h *Handler) compareBenchmark(c *gin.Context) {
	var req BenchmarkComparisonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.CompareBenchmark(c.Request.Context(), &req)
	if err != nil {
		h.logger.Error("Failed to compare benchmark", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// listBenchmarks handles GET /api/v1/reports/benchmarks
func (h *Handler) listBenchmarks(c *gin.Context) {
	filters := &BenchmarkFilters{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
	}

	// Parse optional filters
	if category := c.Query("category"); category != "" {
		cat := BenchmarkCategory(category)
		filters.Category = &cat
	}
	if methodology := c.Query("methodology"); methodology != "" {
		filters.Methodology = &methodology
	}
	if region := c.Query("region"); region != "" {
		filters.Region = &region
	}
	if year := c.Query("year"); year != "" {
		if y, err := strconv.Atoi(year); err == nil {
			filters.Year = &y
		}
	}

	benchmarks, total, err := h.service.ListBenchmarks(c.Request.Context(), filters)
	if err != nil {
		h.logger.Error("Failed to list benchmarks", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"benchmarks":  benchmarks,
		"total_count": total,
		"page":        filters.Page,
		"page_size":   filters.PageSize,
	})
}

// =====================================================
// Data Source Endpoints
// =====================================================

// getDataSources handles GET /api/v1/reports/datasets
func (h *Handler) getDataSources(c *gin.Context) {
	sources, err := h.service.GetDataSources(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get data sources", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"datasets": sources})
}

// getDataSource handles GET /api/v1/reports/datasets/:name
func (h *Handler) getDataSource(c *gin.Context) {
	name := c.Param("name")

	source, err := h.service.GetDataSource(c.Request.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get data source", zap.Error(err), zap.String("name", name))
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, source)
}

// =====================================================
// Helper Methods
// =====================================================

// getUserID extracts user ID from context (set by auth middleware)
func (h *Handler) getUserID(c *gin.Context) uuid.UUID {
	// In production, get from auth context
	// For now, use a mock user ID or header
	if userIDStr := c.GetHeader("X-User-ID"); userIDStr != "" {
		if id, err := uuid.Parse(userIDStr); err == nil {
			return id
		}
	}

	// Default mock user ID for development
	return uuid.MustParse("00000000-0000-0000-0000-000000000001")
}

// getIntParam gets an integer query parameter with a default value
func (h *Handler) getIntParam(c *gin.Context, key string, defaultVal int) int {
	if val := c.Query(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}
