package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/alerts"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/analytics"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Handler handles HTTP requests for monitoring endpoints
type Handler struct {
	repo                monitoring.Repository
	satelliteIngestion  *ingestion.SatelliteIngestion
	iotIngestion        *ingestion.IoTIngestion
	webhookHandler      *ingestion.WebhookHandler
	alertEngine         *alerts.Engine
	performanceCalc     *analytics.PerformanceCalculator
	trendAnalyzer       *analytics.TrendAnalyzer
	wsUpgrader          websocket.Upgrader
	wsConnections       map[string]*websocket.Conn
}

// NewHandler creates a new monitoring handler
func NewHandler(
	repo Repository,
	satelliteIngestion *ingestion.SatelliteIngestion,
	iotIngestion *ingestion.IoTIngestion,
	webhookHandler *ingestion.WebhookHandler,
	alertEngine *alerts.Engine,
) *Handler {
	return &Handler{
		repo:               repo,
		satelliteIngestion: satelliteIngestion,
		iotIngestion:       iotIngestion,
		webhookHandler:     webhookHandler,
		alertEngine:        alertEngine,
		performanceCalc:    analytics.NewPerformanceCalculator(repo),
		trendAnalyzer:      analytics.NewTrendAnalyzer(repo),
		wsUpgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Configure properly in production
			},
		},
		wsConnections: make(map[string]*websocket.Conn),
	}
}

// =============================================
// SATELLITE DATA ENDPOINTS
// =============================================

// HandleSatelliteWebhook handles incoming satellite data webhooks
func (h *Handler) HandleSatelliteWebhook(c *gin.Context) {
	h.webhookHandler.HandleSatelliteWebhook(c.Writer, c.Request)
}

// HandleSatelliteBatchWebhook handles batch satellite data webhooks
func (h *Handler) HandleSatelliteBatchWebhook(c *gin.Context) {
	h.webhookHandler.HandleBatchWebhook(c.Writer, c.Request)
}

// GetSatelliteData retrieves satellite observations
// GET /api/v1/monitoring/satellite/data
func (h *Handler) GetSatelliteData(c *gin.Context) {
	var query SatelliteObservationQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	observations, total, err := h.repo.GetSatelliteObservations(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve satellite data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  observations,
		"total": total,
		"limit": query.Limit,
		"offset": query.Offset,
	})
}

// =============================================
// IOT SENSOR ENDPOINTS
// =============================================

// IngestSensorTelemetry handles batch IoT sensor data upload
// POST /api/v1/monitoring/iot/telemetry
func (h *Handler) IngestSensorTelemetry(c *gin.Context) {
	var batch SensorReadingBatch
	if err := c.ShouldBindJSON(&batch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.iotIngestion.IngestBatch(c.Request.Context(), batch.Readings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest sensor data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"count":  len(batch.Readings),
	})
}

// RegisterSensor registers a new IoT sensor
// POST /api/v1/monitoring/sensors/register
func (h *Handler) RegisterSensor(c *gin.Context) {
	var req SensorRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sensor := &Sensor{
		ID:                       uuid.New(),
		SensorID:                 req.SensorID,
		ProjectID:                req.ProjectID,
		Name:                     req.Name,
		SensorType:               req.SensorType,
		Manufacturer:             req.Manufacturer,
		Model:                    req.Model,
		FirmwareVersion:          req.FirmwareVersion,
		InstallationDate:         req.InstallationDate,
		Latitude:                 req.Latitude,
		Longitude:                req.Longitude,
		AltitudeM:                req.AltitudeM,
		DepthCm:                  req.DepthCm,
		CalibrationData:          JSONB(req.CalibrationData),
		CommunicationProtocol:    req.CommunicationProtocol,
		ReportingIntervalSeconds: req.ReportingIntervalSeconds,
		Status:                   "active",
		Metadata:                 JSONB(req.Metadata),
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}

	if err := h.repo.CreateSensor(c.Request.Context(), sensor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register sensor"})
		return
	}

	c.JSON(http.StatusCreated, sensor)
}

// GetSensors retrieves all sensors for a project
// GET /api/v1/monitoring/sensors
func (h *Handler) GetSensors(c *gin.Context) {
	projectIDStr := c.Query("project_id")
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_id"})
		return
	}

	sensors, err := h.repo.GetProjectSensors(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve sensors"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sensors})
}

// =============================================
// METRICS ENDPOINTS
// =============================================

// GetProjectMetrics retrieves time-series metrics for a project
// GET /api/v1/monitoring/projects/:id/metrics
func (h *Handler) GetProjectMetrics(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_id"})
		return
	}

	var query MetricsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	query.ProjectID = projectID

	metrics, total, err := h.repo.GetProjectMetrics(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve metrics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  metrics,
		"total": total,
		"limit": query.Limit,
		"offset": query.Offset,
	})
}

// GetPerformanceDashboard retrieves comprehensive performance metrics
// GET /api/v1/monitoring/projects/:id/performance
func (h *Handler) GetPerformanceDashboard(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_id"})
		return
	}

	period := c.DefaultQuery("period", time.Now().Format("2006-01"))

	dashboard, err := h.performanceCalc.CalculateDashboard(c.Request.Context(), projectID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate dashboard"})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

// =============================================
// ALERT ENDPOINTS
// =============================================

// CreateAlertRule creates a new alert rule
// POST /api/v1/monitoring/alerts/rules
func (h *Handler) CreateAlertRule(c *gin.Context) {
	var req AlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (authentication middleware should set this)
	userID := uuid.New() // TODO: Get from auth context

	rule := &AlertRule{
		ID:                   uuid.New(),
		ProjectID:            req.ProjectID,
		Name:                 req.Name,
		Description:          req.Description,
		ConditionType:        req.ConditionType,
		MetricSource:         req.MetricSource,
		MetricName:           req.MetricName,
		SensorType:           req.SensorType,
		ConditionConfig:      JSONB(req.ConditionConfig),
		Severity:             req.Severity,
		NotificationChannels: convertStringsToJSONB(req.NotificationChannels),
		CooldownMinutes:      req.CooldownMinutes,
		IsActive:             true,
		CreatedBy:            &userID,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	if err := h.repo.CreateAlertRule(c.Request.Context(), rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create alert rule"})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// GetAlerts retrieves alerts with filters
// GET /api/v1/monitoring/projects/:id/alerts
func (h *Handler) GetAlerts(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_id"})
		return
	}

	var query AlertQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	query.ProjectID = &projectID

	alerts, total, err := h.repo.GetAlerts(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  alerts,
		"total": total,
		"limit": query.Limit,
		"offset": query.Offset,
	})
}

// AcknowledgeAlert acknowledges an alert
// PUT /api/v1/monitoring/alerts/:id/acknowledge
func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	alertIDStr := c.Param("id")
	alertID, err := uuid.Parse(alertIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert_id"})
		return
	}

	var req AlertAcknowledgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.AcknowledgeAlert(c.Request.Context(), alertID, req.AcknowledgedBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to acknowledge alert"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "acknowledged"})
}

// =============================================
// WEBSOCKET ENDPOINT
// =============================================

// HandleWebSocket handles WebSocket connections for real-time data
// WS /api/v1/monitoring/ws
func (h *Handler) HandleWebSocket(c *gin.Context) {
	conn, err := h.wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Printf("WebSocket upgrade failed: %v\n", err)
		return
	}

	clientID := uuid.New().String()
	h.wsConnections[clientID] = conn

	defer func() {
		delete(h.wsConnections, clientID)
		conn.Close()
	}()

	// Read subscription message
	var subscription WebSocketSubscription
	if err := conn.ReadJSON(&subscription); err != nil {
		fmt.Printf("Failed to read subscription: %v\n", err)
		return
	}

	subscription.ClientID = clientID

	// Start streaming data
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Send initial connection confirmation
	conn.WriteJSON(gin.H{
		"type":    "connection",
		"status":  "connected",
		"client_id": clientID,
	})

	// Keep connection alive and handle incoming messages
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
		// Handle ping/pong or other control messages
	}
}

// BroadcastToWebSockets broadcasts a message to all connected WebSocket clients
func (h *Handler) BroadcastToWebSockets(message WebSocketMessage) {
	for clientID, conn := range h.wsConnections {
		if err := conn.WriteJSON(message); err != nil {
			fmt.Printf("Failed to send to client %s: %v\n", clientID, err)
			delete(h.wsConnections, clientID)
			conn.Close()
		}
	}
}

// =============================================
// HELPER FUNCTIONS
// =============================================

func convertStringsToJSONB(strings []string) JSONB {
	jsonb := make(JSONB)
	for i, s := range strings {
		jsonb[fmt.Sprintf("%d", i)] = s
	}
	return jsonb
}
