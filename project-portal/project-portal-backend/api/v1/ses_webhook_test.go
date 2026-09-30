package v1

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

func TestHandleNotification_RejectsMalformedBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewSESWebhookHandler(aws.SESWebhookHandlers{})

	router := gin.New()
	router.POST("/webhooks/ses", handler.HandleNotification)

	req := httptest.NewRequest(http.MethodPost, "/webhooks/ses", strings.NewReader("not json"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHandleNotification_RejectsUnsignedMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewSESWebhookHandler(aws.SESWebhookHandlers{})

	router := gin.New()
	router.POST("/webhooks/ses", handler.HandleNotification)

	body := `{"Type":"Notification","Message":"{}","SignatureVersion":"1","SigningCertURL":"https://evil.example.com/cert.pem","Signature":"abc"}`
	req := httptest.NewRequest(http.MethodPost, "/webhooks/ses", strings.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegisterSESWebhookRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewSESWebhookHandler(aws.SESWebhookHandlers{})

	router := gin.New()
	v1 := router.Group("/api/v1")
	RegisterSESWebhookRoutes(v1, handler)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/ses", strings.NewReader("not json"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Reaching the handler (and getting our 400, not gin's 404) confirms
	// the route is wired at the expected path.
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
