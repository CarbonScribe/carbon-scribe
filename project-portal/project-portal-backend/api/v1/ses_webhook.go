package v1

import (
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

// SESWebhookHandler handles the SNS-backed SES bounce/complaint/delivery
// webhook.
type SESWebhookHandler struct {
	handlers aws.SESWebhookHandlers
}

// NewSESWebhookHandler creates a new SESWebhookHandler. handlers may be the
// zero value if the caller only wants events verified and logged.
func NewSESWebhookHandler(handlers aws.SESWebhookHandlers) *SESWebhookHandler {
	return &SESWebhookHandler{handlers: handlers}
}

// HandleNotification handles POST /api/v1/webhooks/ses — the HTTPS endpoint
// an SNS topic subscription delivers SES bounce/complaint/delivery events
// (and its own subscription confirmation handshake) to.
//
// It always reads the full body itself rather than using gin's JSON
// binding, since SNS's Content-Type is "text/plain; charset=UTF-8" even
// though the body is JSON.
func (h *SESWebhookHandler) HandleNotification(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	if _, _, err := aws.ProcessSESWebhook(body, h.handlers); err != nil {
		// A non-2xx response tells SNS to retry delivery; log for
		// visibility since a persistent failure here (e.g. a signature
		// verification bug) would otherwise go unnoticed.
		log.Printf("ses webhook: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}

// RegisterSESWebhookRoutes registers the SES/SNS webhook route.
func RegisterSESWebhookRoutes(r *gin.RouterGroup, handler *SESWebhookHandler) {
	webhooks := r.Group("/webhooks")
	{
		webhooks.POST("/ses", handler.HandleNotification)
	}
}
