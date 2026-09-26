package monitoring

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler exposes monitoring endpoints on a Gin router group.
type Handler struct {
	svc *Service
}

// NewHandler constructs a monitoring Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the monitoring routes under the provided router group.
//
//	POST /api/v1/monitoring/satellite  – ingest satellite data
//	GET  /api/v1/monitoring/:projectID – list readings for a project
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/satellite", h.ingestSatellite)
	rg.GET("/:projectID", h.listReadings)
	rg.GET("/ndvi/tile/:z/:x/:y", h.getNDVITile)
	rg.GET("/ndvi/timeseries/animation/:z/:x/:y", h.getNDVITimeSeriesAnimation)
}

// ingestSatellite handles POST /api/v1/monitoring/satellite
//
//	@Summary     Ingest satellite data
//	@Description Submit a satellite observation for a registered project
//	@Tags        monitoring
//	@Accept      json
//	@Produce     json
//	@Param       body body IngestSatelliteRequest true "Satellite reading payload"
//	@Success     201 {object} SatelliteReading
//	@Failure     400 {object} map[string]string
//	@Failure     500 {object} map[string]string
//	@Router      /api/v1/monitoring/satellite [post]
func (h *Handler) ingestSatellite(c *gin.Context) {
	var req IngestSatelliteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reading, err := h.svc.IngestSatellite(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, reading)
}

// listReadings handles GET /api/v1/monitoring/:projectID
func (h *Handler) listReadings(c *gin.Context) {
	projectID := c.Param("projectID")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	readings, err := h.svc.ListReadings(c.Request.Context(), projectID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": readings, "count": len(readings)})
}

// getNDVITile handles GET /api/v1/monitoring/ndvi/tile/:z/:x/:y
func (h *Handler) getNDVITile(c *gin.Context) {
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

	tileData, err := h.svc.GetNDVITile(c.Request.Context(), projectID, z, x, y, start, end, useMVT)
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

// getNDVITimeSeriesAnimation handles GET /api/v1/monitoring/ndvi/timeseries/animation/:z/:x/:y
func (h *Handler) getNDVITimeSeriesAnimation(c *gin.Context) {
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

	animData, err := h.svc.GetNDVITimeSeriesAnimation(c.Request.Context(), projectID, z, x, y, start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, animData)
}
