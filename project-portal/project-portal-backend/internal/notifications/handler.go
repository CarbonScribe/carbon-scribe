package notifications

import (
	"net/http"
	"strconv"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func RegisterRoutes(v1 *gin.RouterGroup, h *Handler, tokenManager *auth.TokenManager) {
	notif := v1.Group("/notifications")
	notif.Use(auth.AuthMiddleware(tokenManager))
	{
		notif.GET("", auth.RequirePermission("notifications:read"), h.ListNotifications)
		notif.POST("/send", auth.RequirePermission("notifications:send"), h.SendNotification)

		notif.POST("/rules", auth.RequirePermission("notifications:manage_rules"), h.CreateRule)
		notif.PUT("/rules/:id", auth.RequirePermission("notifications:manage_rules"), h.UpdateRule)
		notif.GET("/rules", auth.RequirePermission("notifications:manage_rules"), h.ListRules)
		notif.POST("/rules/:id/test", auth.RequirePermission("notifications:manage_rules"), h.TestRule)

		notif.GET("/preferences", auth.RequirePermission("notifications:read"), h.GetPreferences)
		notif.PUT("/preferences", auth.RequirePermission("notifications:write"), h.UpdatePreferences)

		notif.GET("/templates", auth.RequirePermission("notifications:read"), h.ListTemplates)
		notif.POST("/templates", auth.RequirePermission("notifications:manage_templates"), h.CreateTemplate)
		notif.GET("/templates/:id/preview", auth.RequirePermission("notifications:read"), h.PreviewTemplate)

		notif.GET("/:id/status", auth.RequirePermission("notifications:read"), h.GetStatus)
		notif.GET("/metrics", auth.RequirePermission("notifications:analytics"), h.GetMetrics)

		notif.POST("/ws/broadcast", auth.RequirePermission("notifications:send"), h.Broadcast)
		notif.POST("/ws/connect", auth.RequirePermission("notifications:write"), h.Connect)
		notif.POST("/ws/disconnect/:connectionId", auth.RequirePermission("notifications:write"), h.Disconnect)
	}

	// AWS webhook callbacks are intentionally outside JWT auth; AWS request verification is done upstream.
	v1.POST("/notifications/webhooks/sns", h.SNSWebhook)
	v1.POST("/notifications/webhooks/ses", h.SESWebhook)
}

func (h *Handler) ListNotifications(c *gin.Context) {
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	limit := int64(50)
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	items, err := h.service.ListUserNotifications(c.Request.Context(), userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"notifications": items})
}

func (h *Handler) SendNotification(c *gin.Context) {
	var req SendNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.SendNotification(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) GetStatus(c *gin.Context) {
	id := c.Param("id")
	status, err := h.service.GetNotificationStatus(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "notification not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *Handler) GetPreferences(c *gin.Context) {
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	prefs, err := h.service.GetPreferences(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"preferences": prefs})
}

func (h *Handler) UpdatePreferences(c *gin.Context) {
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var req UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	prefs, err := h.service.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"preferences": prefs})
}

func (h *Handler) ListTemplates(c *gin.Context) {
	templates, err := h.service.ListTemplates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var req NotificationTemplate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tpl, err := h.service.CreateTemplate(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tpl)
}

func (h *Handler) PreviewTemplate(c *gin.Context) {
	var req TemplatePreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Variables = map[string]interface{}{}
	}
	preview, err := h.service.PreviewTemplate(c.Request.Context(), c.Param("id"), req.Variables)
	if err != nil {
		if err.Error() == "template not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, preview)
}

func (h *Handler) CreateRule(c *gin.Context) {
	var req NotificationRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.service.CreateRule(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	var req NotificationRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.service.UpdateRule(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if err.Error() == "rule not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func (h *Handler) ListRules(c *gin.Context) {
	rules, err := h.service.ListRules(c.Request.Context(), c.Query("project_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *Handler) TestRule(c *gin.Context) {
	var req RuleTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.service.TestRule(c.Request.Context(), c.Param("id"), req.SampleData)
	if err != nil {
		if err.Error() == "rule not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetMetrics(c *gin.Context) {
	metrics, err := h.service.Metrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

func (h *Handler) Broadcast(c *gin.Context) {
	var req BroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.service.Broadcast(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) Connect(c *gin.Context) {
	var req WebSocketConnection
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.RegisterConnection(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true})
}

func (h *Handler) Disconnect(c *gin.Context) {
	if err := h.service.Disconnect(c.Request.Context(), c.Param("connectionId")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) SNSWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.ProcessWebhook(c.Request.Context(), ChannelSMS, payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) SESWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.ProcessWebhook(c.Request.Context(), ChannelEmail, payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
