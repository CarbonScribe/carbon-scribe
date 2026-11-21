package integration

import (
	"carbon-scribe/project-portal/project-portal-backend/pkg/security"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes wires integration connection/webhook/OAuth2 routes.
// webhookMaxBytes overrides the global default body-size limit (#797) for
// POST /webhooks/incoming specifically — an unauthenticated endpoint, read
// before signature verification, so it gets a much tighter limit than the
// rest of this group (which stays on the global default).
func RegisterRoutes(r *gin.Engine, h *Handler, webhookMaxBytes int64) {
	v1 := r.Group("/api/v1/integrations")
	{
		// Connection Management
		v1.POST("/connections", h.RegisterConnection)

		// Webhooks
		v1.POST("/webhooks", h.ConfigureWebhook)
		v1.POST("/webhooks/incoming", security.BodyLimit(webhookMaxBytes), h.IncomingWebhook)

		// Subscriptions
		v1.POST("/subscriptions", h.SubscribeToEvent)

		// Health
		v1.GET("/health", h.GetHealth)

		// OAuth2
		v1.GET("/oauth2/authorize/:provider", h.OAuth2Authorize)
		v1.POST("/oauth2/callback/:provider", h.OAuth2Callback)
	}
}
