package v1

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/alerts"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"

	"github.com/gin-gonic/gin"
)

// RegisterMonitoringRoutes registers all monitoring-related routes
func RegisterMonitoringRoutes(router *gin.RouterGroup, handler *monitoring.Handler) {
	// Public webhook endpoints (no auth required)
	webhooks := router.Group("/monitoring/webhooks")
	{
		webhooks.POST("/satellite", handler.HandleSatelliteWebhook)
		webhooks.POST("/satellite/batch", handler.HandleSatelliteBatchWebhook)
	}

	// Protected monitoring endpoints
	monitoringGroup := router.Group("/monitoring")
	// TODO: Add authentication middleware
	// monitoringGroup.Use(authMiddleware())

	{
		// Satellite data endpoints
		satellite := monitoringGroup.Group("/satellite")
		{
			satellite.GET("/data", handler.GetSatelliteData)
		}

		// IoT sensor endpoints
		iot := monitoringGroup.Group("/iot")
		{
			iot.POST("/telemetry", handler.IngestSensorTelemetry)
		}

		sensors := monitoringGroup.Group("/sensors")
		{
			sensors.POST("/register", handler.RegisterSensor)
			sensors.GET("", handler.GetSensors)
		}

		// Project metrics endpoints
		projects := monitoringGroup.Group("/projects")
		{
			projects.GET("/:id/metrics", handler.GetProjectMetrics)
			projects.GET("/:id/performance", handler.GetPerformanceDashboard)
			projects.GET("/:id/alerts", handler.GetAlerts)
		}

		// Alert management endpoints
		alerts := monitoringGroup.Group("/alerts")
		{
			alerts.POST("/rules", handler.CreateAlertRule)
			alerts.PUT("/:id/acknowledge", handler.AcknowledgeAlert)
		}

		// WebSocket endpoint for real-time data
		monitoringGroup.GET("/ws", handler.HandleWebSocket)
	}
}

// SetupDependencies wires up all monitoring dependencies
func SetupDependencies(db monitoring.Repository) (
	*monitoring.Handler,
	*ingestion.SatelliteIngestion,
	*ingestion.IoTIngestion,
	*alerts.Engine,
	error,
) {
	// Create ingestion components
	satelliteIngestion := ingestion.NewSatelliteIngestion(db)
	iotIngestion := ingestion.NewIoTIngestion(db)
	
	// Create webhook handler (configure secret keys in production)
	webhookHandler := ingestion.NewWebhookHandler(satelliteIngestion, map[string]string{
		"sentinel2": "your-secret-key-here",
		"planet":    "your-secret-key-here",
	})

	// Create alert engine
	alertEngine := alerts.NewEngine(db)

	// Create handler
	handler := monitoring.NewHandler(
		db,
		satelliteIngestion,
		iotIngestion,
		webhookHandler,
		alertEngine,
	)

	return handler, satelliteIngestion, iotIngestion, alertEngine, nil
}
