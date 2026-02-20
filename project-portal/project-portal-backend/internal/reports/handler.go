package reports

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for the reports module
type Handler struct {
	service Service
}

// NewHandler creates a new reports handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers all report routes with the Gin router
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	reports := router.Group("/reports")
	{
		// Report Definitions
		reports.POST("/builder", h.CreateReport)
		reports.GET("", h.ListReports)
		reports.GET("/:id", h.GetReport)
		reports.PUT("/:id", h.UpdateReport)
		reports.DELETE("/:id", h.DeleteReport)
		reports.POST("/:id/clone", h.CloneReport)

		// Report Execution
		reports.POST("/:id/execute", h.ExecuteReport)
		reports.GET("/:id/export", h.ExportReport)

		// Execution History
		reports.GET("/executions", h.ListExecutions)
		reports.GET("/executions/:executionId", h.GetExecution)
		reports.POST("/executions/:executionId/cancel", h.CancelExecution)

		// Templates
		reports.GET("/templates", h.ListTemplates)

		// Datasets
		reports.GET("/datasets", h.GetDatasets)

		// Dashboard
		reports.GET("/dashboard/summary", h.GetDashboardSummary)
		reports.GET("/dashboard/timeseries", h.GetTimeSeriesData)
		reports.GET("/dashboard/widgets", h.GetWidgets)
		reports.POST("/dashboard/widgets", h.CreateWidget)
		reports.PUT("/dashboard/widgets/:widgetId", h.UpdateWidget)
		reports.DELETE("/dashboard/widgets/:widgetId", h.DeleteWidget)

		// Schedules
		reports.POST("/schedules", h.CreateSchedule)
		reports.GET("/schedules", h.ListSchedules)
		reports.GET("/schedules/:scheduleId", h.GetSchedule)
		reports.PUT("/schedules/:scheduleId", h.UpdateSchedule)
		reports.DELETE("/schedules/:scheduleId", h.DeleteSchedule)
		reports.POST("/schedules/:scheduleId/toggle", h.ToggleSchedule)

		// Benchmarks
		reports.POST("/benchmark/comparison", h.CompareBenchmark)
		reports.GET("/benchmarks", h.ListBenchmarks)
		reports.POST("/benchmarks", h.CreateBenchmark)
		reports.PUT("/benchmarks/:benchmarkId", h.UpdateBenchmark)
	}
}

// getUserID extracts the user ID from the request context
// In production, this would come from JWT middleware
func getUserID(c *gin.Context) uuid.UUID {
	// Try to get from context (set by auth middleware)
	if userID, exists := c.Get("user_id"); exists {
		if uid, ok := userID.(uuid.UUID); ok {
			return uid
		}
	}

	// Fallback: try to get from header
	if userIDStr := c.GetHeader("X-User-ID"); userIDStr != "" {
		if uid, err := uuid.Parse(userIDStr); err == nil {
			return uid
		}
	}

	// Default to a nil UUID (should handle this as unauthorized in production)
	return uuid.Nil
}

// ========== Report Definitions ==========

// CreateReport creates a new report definition
// @Summary Create a new report
// @Description Create a new report definition with custom configuration
// @Tags reports
// @Accept json
// @Produce json
// @Param request body CreateReportRequest true "Report configuration"
// @Success 201 {object} ReportDefinition
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /api/v1/reports/builder [post]
func (h *Handler) CreateReport(c *gin.Context) {
	var req CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(c)
	report, err := h.service.CreateReport(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, report)
}

// ListReports lists all available reports for the user
// @Summary List reports
// @Description List all reports accessible by the current user
// @Tags reports
// @Produce json
// @Param category query string false "Filter by category"
// @Param visibility query string false "Filter by visibility"
// @Param is_template query bool false "Filter templates only"
// @Param search query string false "Search in name and description"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(20)
// @Success 200 {object} ListReportsResponse
// @Router /api/v1/reports [get]
func (h *Handler) ListReports(c *gin.Context) {
	userID := getUserID(c)

	filter := ReportFilter{
		Category:   ReportCategory(c.Query("category")),
		Visibility: ReportVisibility(c.Query("visibility")),
		Search:     c.Query("search"),
	}

	if isTemplateStr := c.Query("is_template"); isTemplateStr != "" {
		isTemplate := isTemplateStr == "true"
		filter.IsTemplate = &isTemplate
	}

	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
		filter.PageSize = pageSize
	}

	response, err := h.service.ListReports(c.Request.Context(), userID, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetReport retrieves a specific report by ID
// @Summary Get a report
// @Description Get a specific report definition by ID
// @Tags reports
// @Produce json
// @Param id path string true "Report ID"
// @Success 200 {object} ReportDefinition
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/reports/{id} [get]
func (h *Handler) GetReport(c *gin.Context) {
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	userID := getUserID(c)
	report, err := h.service.GetReport(c.Request.Context(), userID, reportID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

// UpdateReport updates a report definition
// @Summary Update a report
// @Description Update an existing report definition
// @Tags reports
// @Accept json
// @Produce json
// @Param id path string true "Report ID"
// @Param request body UpdateReportRequest true "Update data"
// @Success 200 {object} ReportDefinition
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/reports/{id} [put]
func (h *Handler) UpdateReport(c *gin.Context) {
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	var req UpdateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(c)
	report, err := h.service.UpdateReport(c.Request.Context(), userID, reportID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

// DeleteReport deletes a report definition
// @Summary Delete a report
// @Description Delete a report definition
// @Tags reports
// @Param id path string true "Report ID"
// @Success 204 "No Content"
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/reports/{id} [delete]
func (h *Handler) DeleteReport(c *gin.Context) {
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	userID := getUserID(c)
	if err := h.service.DeleteReport(c.Request.Context(), userID, reportID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// CloneReport creates a copy of an existing report
// @Summary Clone a report
// @Description Create a clone of an existing report
// @Tags reports
// @Accept json
// @Produce json
// @Param id path string true "Report ID to clone"
// @Param request body CloneReportRequest true "Clone data"
// @Success 201 {object} ReportDefinition
// @Router /api/v1/reports/{id}/clone [post]
func (h *Handler) CloneReport(c *gin.Context) {
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(c)
	report, err := h.service.CloneReport(c.Request.Context(), userID, reportID, req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, report)
}

// ListTemplates lists available report templates
// @Summary List templates
// @Description List all available report templates
// @Tags reports
// @Produce json
// @Success 200 {array} ReportDefinition
// @Router /api/v1/reports/templates [get]
func (h *Handler) ListTemplates(c *gin.Context) {
	templates, err := h.service.GetTemplates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

// ========== Report Execution ==========

// ExecuteReport executes a report and returns an execution record
// @Summary Execute a report
// @Description Execute a report and start generating the output
// @Tags reports
// @Accept json
// @Produce json
// @Param id path string true "Report ID"
// @Param request body ExecuteReportRequest true "Execution parameters"
// @Success 202 {object} ReportExecution
// @Router /api/v1/reports/{id}/execute [post]
func (h *Handler) ExecuteReport(c *gin.Context) {
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	var req ExecuteReportRequest
	c.ShouldBindJSON(&req) // Optional parameters

	userID := getUserID(c)
	execution, err := h.service.ExecuteReport(c.Request.Context(), userID, reportID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, execution)
}

// ExportReport exports a report in the specified format
// @Summary Export a report
// @Description Export a report in CSV, Excel, PDF, or JSON format
// @Tags reports
// @Produce application/octet-stream
// @Param id path string true "Report ID"
// @Param format query string false "Export format (csv, excel, pdf, json)" default(csv)
// @Success 200 {file} file
// @Router /api/v1/reports/{id}/export [get]
func (h *Handler) ExportReport(c *gin.Context) {
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	format := ExportFormat(c.DefaultQuery("format", "csv"))
	userID := getUserID(c)

	// Execute the report with the specified format
	execution, err := h.service.ExecuteReport(c.Request.Context(), userID, reportID, ExecuteReportRequest{
		Format: format,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return the execution ID for async download
	c.JSON(http.StatusAccepted, gin.H{
		"execution_id": execution.ID,
		"status":       execution.Status,
		"message":      "Report generation started. Use the execution ID to check status.",
	})
}

// ListExecutions lists report execution history
// @Summary List executions
// @Description List report execution history
// @Tags reports
// @Produce json
// @Param report_id query string false "Filter by report ID"
// @Param schedule_id query string false "Filter by schedule ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number"
// @Param page_size query int false "Items per page"
// @Success 200 {object} ListExecutionsResponse
// @Router /api/v1/reports/executions [get]
func (h *Handler) ListExecutions(c *gin.Context) {
	filter := ExecutionFilter{}

	if reportIDStr := c.Query("report_id"); reportIDStr != "" {
		if id, err := uuid.Parse(reportIDStr); err == nil {
			filter.ReportDefinitionID = &id
		}
	}
	if scheduleIDStr := c.Query("schedule_id"); scheduleIDStr != "" {
		if id, err := uuid.Parse(scheduleIDStr); err == nil {
			filter.ScheduleID = &id
		}
	}
	if status := c.Query("status"); status != "" {
		filter.Status = ExecutionStatus(status)
	}
	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
		filter.PageSize = pageSize
	}

	response, err := h.service.ListExecutions(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetExecution retrieves a specific execution
// @Summary Get execution
// @Description Get a specific report execution by ID
// @Tags reports
// @Produce json
// @Param executionId path string true "Execution ID"
// @Success 200 {object} ReportExecution
// @Router /api/v1/reports/executions/{executionId} [get]
func (h *Handler) GetExecution(c *gin.Context) {
	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid execution ID"})
		return
	}

	execution, err := h.service.GetExecution(c.Request.Context(), executionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, execution)
}

// CancelExecution cancels a pending execution
// @Summary Cancel execution
// @Description Cancel a pending or processing execution
// @Tags reports
// @Param executionId path string true "Execution ID"
// @Success 200 {object} gin.H
// @Router /api/v1/reports/executions/{executionId}/cancel [post]
func (h *Handler) CancelExecution(c *gin.Context) {
	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid execution ID"})
		return
	}

	if err := h.service.CancelExecution(c.Request.Context(), executionID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "execution cancelled"})
}

// GetDatasets returns available datasets and their fields
// @Summary Get datasets
// @Description Get available datasets and their field metadata
// @Tags reports
// @Produce json
// @Success 200 {array} DatasetMetadata
// @Router /api/v1/reports/datasets [get]
func (h *Handler) GetDatasets(c *gin.Context) {
	datasets, err := h.service.GetAvailableDatasets(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"datasets": datasets})
}

// ========== Dashboard ==========

// GetDashboardSummary returns aggregated dashboard data
// @Summary Get dashboard summary
// @Description Get pre-aggregated summary metrics for dashboard widgets
// @Tags reports
// @Produce json
// @Success 200 {object} DashboardSummary
// @Router /api/v1/reports/dashboard/summary [get]
func (h *Handler) GetDashboardSummary(c *gin.Context) {
	userID := getUserID(c)
	var userIDPtr *uuid.UUID
	if userID != uuid.Nil {
		userIDPtr = &userID
	}

	summary, err := h.service.GetDashboardSummary(c.Request.Context(), userIDPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// GetTimeSeriesData returns time series data for charts
// @Summary Get time series data
// @Description Get time series data for dashboard charts
// @Tags reports
// @Produce json
// @Param metric query string true "Metric name"
// @Param start_time query string true "Start time (RFC3339)"
// @Param end_time query string true "End time (RFC3339)"
// @Param interval query string false "Aggregation interval (hour, day, week, month)"
// @Success 200 {array} TimeSeriesPoint
// @Router /api/v1/reports/dashboard/timeseries [get]
func (h *Handler) GetTimeSeriesData(c *gin.Context) {
	metric := c.Query("metric")
	if metric == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric is required"})
		return
	}

	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, endTimeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time"})
		return
	}

	interval := c.DefaultQuery("interval", "day")

	data, err := h.service.GetTimeSeriesData(c.Request.Context(), metric, startTime, endTime, interval)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetWidgets returns dashboard widgets for the user
// @Summary Get widgets
// @Description Get dashboard widgets for the current user
// @Tags reports
// @Produce json
// @Param section query string false "Filter by dashboard section"
// @Success 200 {array} DashboardWidget
// @Router /api/v1/reports/dashboard/widgets [get]
func (h *Handler) GetWidgets(c *gin.Context) {
	userID := getUserID(c)
	section := c.Query("section")

	widgets, err := h.service.GetWidgets(c.Request.Context(), userID, section)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"widgets": widgets})
}

// CreateWidget creates a new dashboard widget
// @Summary Create widget
// @Description Create a new dashboard widget
// @Tags reports
// @Accept json
// @Produce json
// @Param request body DashboardWidget true "Widget configuration"
// @Success 201 {object} DashboardWidget
// @Router /api/v1/reports/dashboard/widgets [post]
func (h *Handler) CreateWidget(c *gin.Context) {
	var widget DashboardWidget
	if err := c.ShouldBindJSON(&widget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(c)
	widget.UserID = &userID

	saved, err := h.service.SaveWidget(c.Request.Context(), &widget)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, saved)
}

// UpdateWidget updates an existing widget
// @Summary Update widget
// @Description Update an existing dashboard widget
// @Tags reports
// @Accept json
// @Produce json
// @Param widgetId path string true "Widget ID"
// @Param request body DashboardWidget true "Widget configuration"
// @Success 200 {object} DashboardWidget
// @Router /api/v1/reports/dashboard/widgets/{widgetId} [put]
func (h *Handler) UpdateWidget(c *gin.Context) {
	widgetID, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	var widget DashboardWidget
	if err := c.ShouldBindJSON(&widget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	widget.ID = widgetID

	saved, err := h.service.SaveWidget(c.Request.Context(), &widget)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, saved)
}

// DeleteWidget deletes a dashboard widget
// @Summary Delete widget
// @Description Delete a dashboard widget
// @Tags reports
// @Param widgetId path string true "Widget ID"
// @Success 204 "No Content"
// @Router /api/v1/reports/dashboard/widgets/{widgetId} [delete]
func (h *Handler) DeleteWidget(c *gin.Context) {
	widgetID, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	if err := h.service.DeleteWidget(c.Request.Context(), widgetID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ========== Schedules ==========

// CreateSchedule creates a new scheduled report
// @Summary Create schedule
// @Description Create a new scheduled report
// @Tags reports
// @Accept json
// @Produce json
// @Param request body CreateScheduleRequest true "Schedule configuration"
// @Success 201 {object} ReportSchedule
// @Router /api/v1/reports/schedules [post]
func (h *Handler) CreateSchedule(c *gin.Context) {
	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(c)
	schedule, err := h.service.CreateSchedule(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, schedule)
}

// ListSchedules lists scheduled reports
// @Summary List schedules
// @Description List all scheduled reports
// @Tags reports
// @Produce json
// @Param report_id query string false "Filter by report ID"
// @Param is_active query bool false "Filter by active status"
// @Param page query int false "Page number"
// @Param page_size query int false "Items per page"
// @Success 200 {array} ReportSchedule
// @Router /api/v1/reports/schedules [get]
func (h *Handler) ListSchedules(c *gin.Context) {
	filter := ScheduleFilter{}

	if reportIDStr := c.Query("report_id"); reportIDStr != "" {
		if id, err := uuid.Parse(reportIDStr); err == nil {
			filter.ReportDefinitionID = &id
		}
	}
	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		isActive := isActiveStr == "true"
		filter.IsActive = &isActive
	}
	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
		filter.PageSize = pageSize
	}

	schedules, total, err := h.service.ListSchedules(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"schedules": schedules, "total": total})
}

// GetSchedule retrieves a specific schedule
// @Summary Get schedule
// @Description Get a specific scheduled report by ID
// @Tags reports
// @Produce json
// @Param scheduleId path string true "Schedule ID"
// @Success 200 {object} ReportSchedule
// @Router /api/v1/reports/schedules/{scheduleId} [get]
func (h *Handler) GetSchedule(c *gin.Context) {
	scheduleID, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	schedule, err := h.service.GetSchedule(c.Request.Context(), scheduleID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schedule)
}

// UpdateSchedule updates a scheduled report
// @Summary Update schedule
// @Description Update an existing scheduled report
// @Tags reports
// @Accept json
// @Produce json
// @Param scheduleId path string true "Schedule ID"
// @Param request body CreateScheduleRequest true "Schedule configuration"
// @Success 200 {object} ReportSchedule
// @Router /api/v1/reports/schedules/{scheduleId} [put]
func (h *Handler) UpdateSchedule(c *gin.Context) {
	scheduleID, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	schedule, err := h.service.UpdateSchedule(c.Request.Context(), scheduleID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schedule)
}

// DeleteSchedule deletes a scheduled report
// @Summary Delete schedule
// @Description Delete a scheduled report
// @Tags reports
// @Param scheduleId path string true "Schedule ID"
// @Success 204 "No Content"
// @Router /api/v1/reports/schedules/{scheduleId} [delete]
func (h *Handler) DeleteSchedule(c *gin.Context) {
	scheduleID, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	if err := h.service.DeleteSchedule(c.Request.Context(), scheduleID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ToggleSchedule enables or disables a scheduled report
// @Summary Toggle schedule
// @Description Enable or disable a scheduled report
// @Tags reports
// @Accept json
// @Produce json
// @Param scheduleId path string true "Schedule ID"
// @Param request body ToggleScheduleRequest true "Toggle state"
// @Success 200 {object} gin.H
// @Router /api/v1/reports/schedules/{scheduleId}/toggle [post]
func (h *Handler) ToggleSchedule(c *gin.Context) {
	scheduleID, err := uuid.Parse(c.Param("scheduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule ID"})
		return
	}

	var req struct {
		Active bool `json:"active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ToggleSchedule(c.Request.Context(), scheduleID, req.Active); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "schedule updated", "active": req.Active})
}

// ========== Benchmarks ==========

// CompareBenchmark compares project against benchmarks
// @Summary Compare benchmark
// @Description Compare a project's performance against industry benchmarks
// @Tags reports
// @Accept json
// @Produce json
// @Param request body BenchmarkComparisonRequest true "Comparison parameters"
// @Success 200 {object} BenchmarkComparisonResponse
// @Router /api/v1/reports/benchmark/comparison [post]
func (h *Handler) CompareBenchmark(c *gin.Context) {
	var req BenchmarkComparisonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.CompareBenchmark(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ListBenchmarks lists available benchmark datasets
// @Summary List benchmarks
// @Description List available benchmark datasets
// @Tags reports
// @Produce json
// @Param category query string false "Filter by category"
// @Param methodology query string false "Filter by methodology"
// @Param region query string false "Filter by region"
// @Param year query int false "Filter by year"
// @Success 200 {array} BenchmarkDataset
// @Router /api/v1/reports/benchmarks [get]
func (h *Handler) ListBenchmarks(c *gin.Context) {
	filter := BenchmarkFilter{
		Category:    c.Query("category"),
		Methodology: c.Query("methodology"),
		Region:      c.Query("region"),
	}

	if yearStr := c.Query("year"); yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			filter.Year = year
		}
	}

	isActive := true
	filter.IsActive = &isActive

	benchmarks, err := h.service.ListBenchmarks(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"benchmarks": benchmarks})
}

// CreateBenchmark creates a new benchmark dataset
// @Summary Create benchmark
// @Description Create a new benchmark dataset (admin only)
// @Tags reports
// @Accept json
// @Produce json
// @Param request body BenchmarkDataset true "Benchmark data"
// @Success 201 {object} BenchmarkDataset
// @Router /api/v1/reports/benchmarks [post]
func (h *Handler) CreateBenchmark(c *gin.Context) {
	var dataset BenchmarkDataset
	if err := c.ShouldBindJSON(&dataset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	saved, err := h.service.CreateBenchmark(c.Request.Context(), &dataset)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, saved)
}

// UpdateBenchmark updates an existing benchmark dataset
// @Summary Update benchmark
// @Description Update an existing benchmark dataset (admin only)
// @Tags reports
// @Accept json
// @Produce json
// @Param benchmarkId path string true "Benchmark ID"
// @Param request body BenchmarkDataset true "Benchmark data"
// @Success 200 {object} BenchmarkDataset
// @Router /api/v1/reports/benchmarks/{benchmarkId} [put]
func (h *Handler) UpdateBenchmark(c *gin.Context) {
	benchmarkID, err := uuid.Parse(c.Param("benchmarkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid benchmark ID"})
		return
	}

	var dataset BenchmarkDataset
	if err := c.ShouldBindJSON(&dataset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	saved, err := h.service.UpdateBenchmark(c.Request.Context(), benchmarkID, &dataset)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, saved)
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// CloneReportRequest represents a clone request
type CloneReportRequest struct {
	Name string `json:"name" binding:"required"`
}

// ToggleScheduleRequest represents a toggle request
type ToggleScheduleRequest struct {
	Active bool `json:"active"`
}
