package integration

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, h *Handler) {
	v1 := r.Group("/api/v1/integrations")
	{
		// Connection Management
		v1.POST("/connections", h.RegisterConnection)

		// Webhooks
		v1.POST("/webhooks", h.ConfigureWebhook)
		v1.POST("/webhooks/incoming", h.IncomingWebhook)

		// Subscriptions
		v1.POST("/subscriptions", h.SubscribeToEvent)

		// Health
		v1.GET("/health", h.GetHealth)

		// OAuth2
		v1.GET("/oauth2/authorize/:provider", h.OAuth2Authorize)
		v1.POST("/oauth2/callback/:provider", h.OAuth2Callback)
	}
}
