package geospatial

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/geospatial")
	{
		g.POST("/projects/:id/geometry", h.UploadProjectGeometry)
		g.GET("/projects/:id/geometry", h.GetProjectGeometry)
		g.GET("/projects/:id/boundary", h.GetProjectBoundary)
		g.GET("/projects/nearby", h.GetNearbyProjects)
		g.GET("/projects/within", h.GetProjectsWithin)
		g.POST("/analysis/intersect", h.AnalyzeIntersection)
		g.GET("/maps/static", h.GetStaticMap)
		g.GET("/maps/tile/:z/:x/:y", h.GetMapTile)
		g.POST("/geofences", h.CreateGeofence)
		g.GET("/geofences/project/:id", h.CheckProjectGeofences)
		g.GET("/boundaries/:level", h.GetBoundaries)
	}
}

func (h *Handler) UploadProjectGeometry(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	var req UploadGeometryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	geometry, err := h.service.UploadProjectGeometry(c.Request.Context(), projectID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, geometry)
}

func (h *Handler) GetProjectGeometry(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	geometry, err := h.service.GetProjectGeometry(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project geometry not found"})
		return
	}
	c.JSON(http.StatusOK, geometry)
}

func (h *Handler) GetProjectBoundary(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	format := c.DefaultQuery("format", BoundaryFormatGeoJSON)
	boundary, err := h.service.GetProjectBoundary(c.Request.Context(), projectID, format)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, boundary)
}

func (h *Handler) GetNearbyProjects(c *gin.Context) {
	var q NearbyQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := h.service.FindNearby(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"projects": data, "count": len(data)})
}

func (h *Handler) GetProjectsWithin(c *gin.Context) {
	var q WithinQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := h.service.FindWithin(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"projects": data, "count": len(data)})
}

func (h *Handler) AnalyzeIntersection(c *gin.Context) {
	var req IntersectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results, err := h.service.Intersect(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results, "count": len(results)})
}

func (h *Handler) GetStaticMap(c *gin.Context) {
	width, _ := strconv.Atoi(c.DefaultQuery("width", "800"))
	height, _ := strconv.Atoi(c.DefaultQuery("height", "600"))
	zoom, _ := strconv.ParseFloat(c.DefaultQuery("zoom", "10"), 64)
	lat, _ := strconv.ParseFloat(c.DefaultQuery("lat", "0"), 64)
	lon, _ := strconv.ParseFloat(c.DefaultQuery("lon", "0"), 64)

	req := StaticMapRequest{
		Provider: c.Query("provider"),
		Width:    width,
		Height:   height,
		Zoom:     zoom,
		Lat:      lat,
		Lon:      lon,
		Style:    c.Query("style"),
	}

	url, err := h.service.BuildStaticMapURL(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func (h *Handler) GetMapTile(c *gin.Context) {
	z, err := strconv.Atoi(c.Param("z"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid z"})
		return
	}
	x, err := strconv.Atoi(c.Param("x"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid x"})
		return
	}
	y, err := strconv.Atoi(c.Param("y"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid y"})
		return
	}

	data, contentType, cached, err := h.service.GetTile(c.Request.Context(), z, x, y, c.Query("style"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Header("Content-Type", contentType)
	if cached {
		c.Header("X-Cache", "HIT")
	} else {
		c.Header("X-Cache", "MISS")
	}
	c.Data(http.StatusOK, contentType, data)
}

func (h *Handler) CreateGeofence(c *gin.Context) {
	var req CreateGeofenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	geofence, err := h.service.CreateGeofence(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, geofence)
}

func (h *Handler) CheckProjectGeofences(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	results, err := h.service.CheckProjectGeofences(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": results, "count": len(results)})
}

func (h *Handler) GetBoundaries(c *gin.Context) {
	level, err := strconv.Atoi(c.Param("level"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid level"})
		return
	}

	countryCode := c.Query("country_code")
	items, err := h.service.GetAdministrativeBoundaries(c.Request.Context(), level, countryCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"boundaries": items, "count": len(items)})
}
