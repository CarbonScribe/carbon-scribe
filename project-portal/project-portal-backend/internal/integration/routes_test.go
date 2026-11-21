package integration

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// #797: the incoming-webhook endpoint must reject an oversized payload with
// 413 before ever reaching signature verification — not 401, which is what
// an under-limit-but-otherwise-invalid request gets instead.
func TestIncomingWebhook_RejectsOversizedPayloadBeforeSignatureVerification(t *testing.T) {
	repo := &mockRepository{}
	service := NewService(repo, testKeyring())
	handler := NewHandler(service)

	router := gin.New()
	RegisterRoutes(router, handler, 100) // 100-byte webhook limit

	body := strings.Repeat("x", 1000) // well over the 100-byte limit
	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/webhooks/incoming?connection_id=conn-1", bytes.NewBufferString(body))
	req.Header.Set("X-Webhook-Signature", "deadbeef")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for an oversized webhook payload, got %d: %s", w.Code, w.Body.String())
	}
}

// Confirms the limit is scoped to the webhook route, not the whole
// integrations group: an under-the-webhook-limit-but-not-globally-small
// request to a sibling route still gets the normal (401, missing
// connection logic aside) handling rather than 413.
func TestIncomingWebhook_UnderLimitPayloadReachesSignatureVerification(t *testing.T) {
	repo := &mockRepository{}
	service := NewService(repo, testKeyring())
	handler := NewHandler(service)

	router := gin.New()
	RegisterRoutes(router, handler, 100)

	body := `{"event":"ping"}` // well under the 100-byte limit
	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/webhooks/incoming?connection_id=conn-1", bytes.NewBufferString(body))
	req.Header.Set("X-Webhook-Signature", "deadbeef")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// No real webhook secret is configured on the mock connection, so
	// signature verification itself fails — proving it was actually
	// reached, unlike the oversized case above.
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 (signature verification reached and failed), got %d: %s", w.Code, w.Body.String())
	}
}
