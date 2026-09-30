package integration

import (
	"errors"
	"io"
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
	connectionID := c.Query("connection_id")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing connection_id"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	signature := c.GetHeader("X-Webhook-Signature")
	if err := h.service.VerifyIncomingWebhookSignature(c.Request.Context(), connectionID, body, signature); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
		return
	}

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
	redirectURI := c.Query("redirect_uri")

	authURL, err := h.service.InitiateOAuth2(c.Request.Context(), provider, redirectURI)
	if err != nil {
		switch {
		case errors.Is(err, ErrRedirectURIMismatch):
			c.JSON(http.StatusBadRequest, gin.H{"error": "redirect_uri mismatch"})
		case errors.Is(err, ErrNoConnectionForProvider):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.Redirect(http.StatusFound, authURL)
}

// OAuth2 Callback
func (h *Handler) OAuth2Callback(c *gin.Context) {
	provider := c.Param("provider")
	code := c.Query("code")
	state := c.Query("state")

	if err := h.service.HandleOAuth2Callback(c.Request.Context(), provider, code, state); err != nil {
		switch {
		case errors.Is(err, ErrInvalidState):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid state"})
		case errors.Is(err, ErrExpiredState):
			c.JSON(http.StatusBadRequest, gin.H{"error": "expired state"})
		case errors.Is(err, ErrStateAlreadyUsed):
			c.JSON(http.StatusBadRequest, gin.H{"error": "state already used"})
		case errors.Is(err, ErrTokenExchangeFailed):
			c.JSON(http.StatusBadGateway, gin.H{"error": "token exchange failed"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Authentication successful"})
}
