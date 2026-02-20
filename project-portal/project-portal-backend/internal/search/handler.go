package search

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for search
type Handler struct {
	service Service
}

// NewHandler creates a new search handler
func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes registers search routes
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	search := rg.Group("/search")
	{
		search.GET("", h.Search)
		search.GET("/nearby", h.SearchNearby)
		search.POST("/index/sync", h.SyncIndex)
	}
}

// SearchNearby handles geospatial search requests
func (h *Handler) SearchNearby(c *gin.Context) {
	latStr := c.Query("lat")
	lonStr := c.Query("lon")
	dist := c.DefaultQuery("dist", "50km")

	if latStr == "" || lonStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lon parameters are required"})
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lat parameter"})
		return
	}

	lon, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lon parameter"})
		return
	}

	var req SearchRequest
	req.Query = c.Query("q")
	req.Filters = make(map[string]interface{})
	// (Add common filters parsing if needed, sharing logic with Search would be good)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	req.Page = page
	req.PageSize = pageSize

	resp, err := h.service.SearchNearby(c.Request.Context(), req, lat, lon, dist)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Search handles search requests
func (h *Handler) Search(c *gin.Context) {
	var req SearchRequest

	// Bind query parameters
	req.Query = c.Query("q")
	req.SortBy = c.Query("sort_by")
	req.SortOrder = c.Query("sort_order")

	// Parse filters (simplified: q param "filter:key=value")
	// Or query params directly (e.g. region=US)
	// For simplicity, we just look for common filters in query params
	filters := make(map[string]interface{})
	if region := c.Query("region"); region != "" {
		filters["region"] = region
	}
	if projectType := c.Query("project_type"); projectType != "" {
		filters["project_type"] = projectType
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	req.Filters = filters

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	req.Page = page
	req.PageSize = pageSize

	// Execute search
	resp, err := h.service.SearchProjects(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// SyncIndex handles index sync requests
func (h *Handler) SyncIndex(c *gin.Context) {
	if err := h.service.SyncIndex(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "index sync triggered"})
}
