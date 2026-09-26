package v1

import (
	"net/http"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"

	"github.com/gin-gonic/gin"
)

// MonitoringHandler handles monitoring-related API endpoints.
type MonitoringHandler struct {
	service *monitoring.Service
}

// NewMonitoringHandler creates a new monitoring handler.
func NewMonitoringHandler(service *monitoring.Service) *MonitoringHandler {
	return &MonitoringHandler{service: service}
}

// IngestSatellite handles POST /api/v1/monitoring/satellite.
func (h *MonitoringHandler) IngestSatellite(c *gin.Context) {
	var req monitoring.IngestSatelliteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reading, err := h.service.IngestSatellite(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      reading.ID,
		"message": "satellite reading ingested successfully",
	})
}

// IngestWebhook handles POST /api/v1/monitoring/webhook.
func (h *MonitoringHandler) IngestWebhook(c *gin.Context) {
	var req monitoring.IngestWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Authenticate webhook request
	auth := ingestion.NewWebhookAuthenticator(ingestion.WebhookAuthConfig{
		APIKey:     c.GetHeader("X-API-Key"),
		HMACSecret: "",         // Will be configured from env
		AllowedIPs: []string{}, // Will be configured from env
	})
	if err := auth.Authenticate(c.Request); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reading, err := h.service.IngestWebhook(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      reading.ID,
		"message": "webhook reading ingested successfully",
	})
}

// ListSatelliteReadings handles GET /api/v1/monitoring/satellite.
func (h *MonitoringHandler) ListSatelliteReadings(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		// Parse limit
	}

	readings, err := h.service.ListReadings(c.Request.Context(), projectID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"readings": readings,
		"count":    len(readings),
	})
}

// ListWebhookReadings handles GET /api/v1/monitoring/webhook.
func (h *MonitoringHandler) ListWebhookReadings(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		// Parse limit
	}

	metricName := c.Query("metric_name")
	source := c.Query("source")

	var readings []monitoring.WebhookReading
	var err error

	if metricName != "" {
		readings, err = h.service.ListWebhookReadingsByMetric(c.Request.Context(), projectID, metricName, limit)
	} else if source != "" {
		readings, err = h.service.ListWebhookReadingsBySource(c.Request.Context(), projectID, source, limit)
	} else {
		readings, err = h.service.ListWebhookReadings(c.Request.Context(), projectID, limit)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"readings": readings,
		"count":    len(readings),
	})
}

// IngestIoT handles POST /api/v1/monitoring/iot.
func (h *MonitoringHandler) IngestIoT(c *gin.Context) {
	var req monitoring.IngestIoTRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reading, err := h.service.IngestIoT(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      reading.ID,
		"message": "IoT reading ingested successfully",
	})
}

// ListIoTReadings handles GET /api/v1/monitoring/iot.
func (h *MonitoringHandler) ListIoTReadings(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		// Parse limit
	}

	sensorID := c.Query("sensor_id")
	sensorType := c.Query("sensor_type")

	var readings []monitoring.IoTReading
	var err error

	if sensorID != "" {
		readings, err = h.service.ListIoTReadingsBySensor(c.Request.Context(), projectID, sensorID, limit)
	} else if sensorType != "" {
		readings, err = h.service.ListIoTReadingsByType(c.Request.Context(), projectID, sensorType, limit)
	} else {
		readings, err = h.service.ListIoTReadings(c.Request.Context(), projectID, limit)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"readings": readings,
		"count":    len(readings),
	})
}

// GetNDVITile handles GET /api/v1/monitoring/ndvi/tile/:z/:x/:y.
func (h *MonitoringHandler) GetNDVITile(c *gin.Context) {
	z := c.Param("z")
	x := c.Param("x")
	y := c.Param("y")
	projectID := c.Query("project_id")
	useMVT := c.Query("mvt") == "true"
	
	startStr := c.Query("date_start")
	endStr := c.Query("date_end")
	
	start := time.Time{}
	end := time.Now()
	if startStr != "" {
		if parsed, err := time.Parse(time.RFC3339, startStr); err == nil {
			start = parsed
		}
	}
	if endStr != "" {
		if parsed, err := time.Parse(time.RFC3339, endStr); err == nil {
			end = parsed
		}
	}

	tileData, err := h.service.GetNDVITile(c.Request.Context(), projectID, z, x, y, start, end, useMVT)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if tileData == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tile not found"})
		return
	}

	c.Header("Cache-Control", "public, max-age=86400")
	if useMVT {
		c.Data(http.StatusOK, "application/json", tileData)
	} else {
		c.Data(http.StatusOK, "image/png", tileData)
	}
}

// GetNDVITimeSeriesAnimation handles GET /api/v1/monitoring/ndvi/timeseries/animation/:z/:x/:y.
func (h *MonitoringHandler) GetNDVITimeSeriesAnimation(c *gin.Context) {
	z := c.Param("z")
	x := c.Param("x")
	y := c.Param("y")
	projectID := c.Query("project_id")
	
	startStr := c.Query("date_start")
	endStr := c.Query("date_end")
	
	start := time.Time{}
	end := time.Now()
	if startStr != "" {
		if parsed, err := time.Parse(time.RFC3339, startStr); err == nil {
			start = parsed
		}
	}
	if endStr != "" {
		if parsed, err := time.Parse(time.RFC3339, endStr); err == nil {
			end = parsed
		}
	}

	animData, err := h.service.GetNDVITimeSeriesAnimation(c.Request.Context(), projectID, z, x, y, start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, animData)
}

// RegisterMonitoringRoutes registers all monitoring routes.
func RegisterMonitoringRoutes(r *gin.RouterGroup, handler *MonitoringHandler) {
	monitoring := r.Group("/monitoring")
	{
		monitoring.POST("/satellite", handler.IngestSatellite)
		monitoring.POST("/webhook", handler.IngestWebhook)
		monitoring.POST("/iot", handler.IngestIoT)
		monitoring.GET("/satellite", handler.ListSatelliteReadings)
		monitoring.GET("/webhook", handler.ListWebhookReadings)
		monitoring.GET("/iot", handler.ListIoTReadings)
		monitoring.GET("/ndvi/tile/:z/:x/:y", handler.GetNDVITile)
		monitoring.GET("/ndvi/timeseries/animation/:z/:x/:y", handler.GetNDVITimeSeriesAnimation)
	}
}
