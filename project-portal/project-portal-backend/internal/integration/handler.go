package integration

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterConnection
func (h *Handler) RegisterConnection(c *gin.Context) {
	var conn IntegrationConnection
	if err := c.ShouldBindJSON(&conn); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.RegisterConnection(c.Request.Context(), &conn); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, conn)
}

// ConfigureWebhook
func (h *Handler) ConfigureWebhook(c *gin.Context) {
	var webhook WebhookConfig
	if err := c.ShouldBindJSON(&webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ConfigureWebhook(c.Request.Context(), &webhook); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, webhook)
}

// IncomingWebhook
func (h *Handler) IncomingWebhook(c *gin.Context) {
	// Verify signature logic would go here
	c.JSON(http.StatusOK, gin.H{"status": "received"})
}

// SubscribeToEvent
func (h *Handler) SubscribeToEvent(c *gin.Context) {
	var sub EventSubscription
	if err := c.ShouldBindJSON(&sub); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.SubscribeToEvent(c.Request.Context(), &sub); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, sub)
}

// GetHealth
func (h *Handler) GetHealth(c *gin.Context) {
	// For simplicity, return a dummy aggregate or list specific conn health if ID provided
	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "All systems operational"})
}

// OAuth2 Authorize
func (h *Handler) OAuth2Authorize(c *gin.Context) {
	provider := c.Param("provider")
	url, err := h.service.InitiateOAuth2(c.Request.Context(), provider)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Redirect(http.StatusFound, url)
}

// OAuth2 Callback
func (h *Handler) OAuth2Callback(c *gin.Context) {
	provider := c.Param("provider")
	code := c.Query("code")

	if err := h.service.HandleOAuth2Callback(c.Request.Context(), provider, code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Authentication successful"})
}
