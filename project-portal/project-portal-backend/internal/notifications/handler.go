package notifications

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	n := router.Group("/notifications")
	{
		n.POST("/send", h.SendNotification)
		n.GET("/preferences", h.GetPreferences)
		n.PUT("/preferences", h.UpdatePreference)
		
		n.GET("/templates", h.ListTemplates)
		n.POST("/templates", h.CreateTemplate)
		n.GET("/templates/:id/preview", h.PreviewTemplate)
		
		n.POST("/rules", h.CreateRule)
		n.POST("/ws/broadcast", h.BroadcastAdmin) // admin only in real app
	}
}

func (h *Handler) SendNotification(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.SendNotification(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "queued"})
}

func (h *Handler) GetPreferences(c *gin.Context) {
	userId := c.Query("userId") // simplified
	if userId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId required"})
		return
	}

	prefs, err := h.service.GetUserPreferences(c.Request.Context(), userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

func (h *Handler) UpdatePreference(c *gin.Context) {
	var pref UserPreference
	if err := c.ShouldBindJSON(&pref); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateUserPreference(c.Request.Context(), pref); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *Handler) ListTemplates(c *gin.Context) {
	// Need to expose ListTemplates in Service if needed, or call repo
	// For now, let's assume we can get them
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var tmpl NotificationTemplate
	if err := c.ShouldBindJSON(&tmpl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateTemplate(c.Request.Context(), &tmpl); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tmpl)
}

func (h *Handler) PreviewTemplate(c *gin.Context) {
	id := c.Param("id")
	// Simplified: query params for data
	data := make(map[string]interface{})
	for k, v := range c.Request.URL.Query() {
		data[k] = v[0]
	}

	preview, err := h.service.PreviewTemplate(c.Request.Context(), id, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"preview": preview})
}

func (h *Handler) CreateRule(c *gin.Context) {
	var rule NotificationRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateRule(c.Request.Context(), rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *Handler) BroadcastAdmin(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.BroadcastAdminMessage(c.Request.Context(), req.Message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "broadcasted"})
}
