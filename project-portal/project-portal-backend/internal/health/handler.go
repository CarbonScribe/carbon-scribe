package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for the health module
type Handler struct {
	service Service
}

// NewHandler creates a new health handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers health routes with the Gin router
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	health := router.Group("/health")
	{
		// Metrics
		health.POST("/metrics", h.CreateSystemMetric)
		health.GET("/metrics", h.GetSystemMetrics)

		// Status
		health.GET("/status", h.GetSystemStatus)
		health.GET("/status/detailed", h.GetDetailedStatus)

		// Services
		health.GET("/services", h.GetServicesHealth)

		// Checks
		health.POST("/checks", h.CreateServiceHealthCheck)

		// Alerts
		health.GET("/alerts", h.GetSystemAlerts)
		health.POST("/alerts/:id/acknowledge", h.AcknowledgeAlert)

		// Reports
		health.GET("/reports/daily", h.GetDailyReport)

		// Dependencies
		health.GET("/dependencies", h.GetDependencies)

		// Uptime
		health.GET("/uptime", h.GetUptimeStats)
	}
}

// ========== Health metrics ==========

// CreateSystemMetric creates a new health metric
// @Summary Create a new health metric
// @Description Create a new health metric with custom configuration
// @Tags health
// @Accept json
// @Produce json
// @Param request body CreateSystemMetricRequest true "System Metric configuration"
// @Success 201 {object} SystemMetric
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /api/v1/health/metrics [post]
func (h *Handler) CreateSystemMetric(c *gin.Context) {
	var req CreateSystemMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metric, err := h.service.CreateSystemMetric(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, metric)
}

// GetSystemMetrics queries system metrics
// @Summary Query system metrics
// @Description Query system metrics with filtering support
// @Tags health
// @Accept json
// @Produce json
// @Param metric_name query string false "Metric name"
// @Param metric_type query string false "Metric type"
// @Param service_name query string false "Service name"
// @Param start_time query string false "Start time (RFC3339)"
// @Param end_time query string false "End time (RFC3339)"
// @Param limit query int false "Limit"
// @Success 200 {array} SystemMetric
// @Failure 401 {object} ErrorResponse
// @Router /api/v1/health/metrics [get]
func (h *Handler) GetSystemMetrics(c *gin.Context) {
	var query MetricQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metrics, err := h.service.GetSystemMetrics(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// GetSystemStatus returns basic system status
// @Summary Get basic system status
// @Description Get basic system status (healthy/degraded/unhealthy)
// @Tags health
// @Produce json
// @Success 200 {object} SystemStatusResponse
// @Router /api/v1/health/status [get]
func (h *Handler) GetSystemStatus(c *gin.Context) {
	status, err := h.service.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetDetailedStatus returns detailed system status
// @Summary Get detailed system status
// @Description Get detailed system status with component details
// @Tags health
// @Produce json
// @Success 200 {object} DetailedStatusResponse
// @Router /api/v1/health/status/detailed [get]
func (h *Handler) GetDetailedStatus(c *gin.Context) {
	status, err := h.service.GetDetailedStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetServicesHealth returns the health status of all monitored services
// @Summary Get service health status
// @Description Get a list of all monitored services and their current health status
// @Tags health
// @Produce json
// @Success 200 {object} ServiceHealthResponse
// @Router /api/v1/health/services [get]
func (h *Handler) GetServicesHealth(c *gin.Context) {
	services, err := h.service.GetServicesHealth(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ServiceHealthResponse{
		Services:  services,
		Timestamp: time.Now(),
	})
}

// CreateServiceHealthCheck creates a new service health check
// @Summary Create a new service health check
// @Description Create and configure a new health check for a service
// @Tags health
// @Accept json
// @Produce json
// @Param request body CreateServiceHealthCheckRequest true "Service Health Check configuration"
// @Success 201 {object} ServiceHealthCheck
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/health/checks [post]
func (h *Handler) CreateServiceHealthCheck(c *gin.Context) {
	var req CreateServiceHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	check, err := h.service.CreateServiceHealthCheck(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, check)
}

// ========== System Alerts ==========

// GetSystemAlerts queries system alerts
// @Summary Query system alerts
// @Description Query system alerts with filtering support
// @Tags health
// @Accept json
// @Produce json
// @Param status query string false "Alert status"
// @Param severity query string false "Alert severity"
// @Param service_name query string false "Service name"
// @Param alert_source query string false "Alert source"
// @Param start_time query string false "Start time (RFC3339)"
// @Param end_time query string false "End time (RFC3339)"
// @Param limit query int false "Limit"
// @Success 200 {array} SystemAlert
// @Failure 401 {object} ErrorResponse
// @Router /api/v1/health/alerts [get]
func (h *Handler) GetSystemAlerts(c *gin.Context) {
	var query AlertQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alerts, err := h.service.GetSystemAlerts(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alerts)
}

// AcknowledgeAlert acknowledges a system alert
// @Summary Acknowledge a system alert
// @Description Set the status of an alert to 'acknowledged'
// @Tags health
// @Accept json
// @Produce json
// @Param id path string true "Alert ID"
// @Param request body AcknowledgeAlertRequest true "Acknowledgement details"
// @Success 200 {object} SystemAlert
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/health/alerts/{id}/acknowledge [post]
func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	id := c.Param("id")
	var req AcknowledgeAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert, err := h.service.AcknowledgeAlert(c.Request.Context(), id, req.AcknowledgedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// ========== Reports ==========

// GetDailyReport returns the latest daily health report
// @Summary Get latest daily health report
// @Description Get the most recent daily system health snapshot
// @Tags health
// @Produce json
// @Success 200 {object} SystemStatusSnapshot
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/health/reports/daily [get]
func (h *Handler) GetDailyReport(c *gin.Context) {
	report, err := h.service.GetDailyReport(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if report == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "daily report not found"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// ========== Dependencies ==========

// GetDependencies returns the list of service dependencies
// @Summary Get service dependencies
// @Description Get the list of all registered service dependencies and their health status
// @Tags health
// @Produce json
// @Success 200 {array} ServiceDependency
// @Router /api/v1/health/dependencies [get]
func (h *Handler) GetDependencies(c *gin.Context) {
	dependencies, err := h.service.GetDependencies(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dependencies)
}

// ========== Uptime ==========

// GetUptimeStats returns uptime statistics for monitored services
// @Summary Get uptime statistics
// @Description Get uptime percentages for all monitored services for the last 24h, 7d, and 30d
// @Tags health
// @Produce json
// @Success 200 {object} UptimeResponse
// @Router /api/v1/health/uptime [get]
func (h *Handler) GetUptimeStats(c *gin.Context) {
	stats, err := h.service.GetUptimeStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
