package security

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newEchoRouter(limit int64) *gin.Engine {
	r := gin.New()
	r.Use(BodyLimit(limit))
	r.POST("/bind", func(c *gin.Context) {
		var payload map[string]any
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, payload)
	})
	r.POST("/read-all", func(c *gin.Context) {
		body := make([]byte, 0)
		buf := make([]byte, 64)
		for {
			n, err := c.Request.Body.Read(buf)
			body = append(body, buf[:n]...)
			if err != nil {
				break
			}
		}
		c.JSON(http.StatusOK, gin.H{"bytes": len(body)})
	})
	return r
}

func TestBodyLimit_AllowsPayloadUnderLimit(t *testing.T) {
	r := newEchoRouter(1024)
	body := `{"a":"` + strings.Repeat("x", 100) + `"}`

	req := httptest.NewRequest(http.MethodPost, "/bind", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBodyLimit_RejectsPayloadOverLimitWith413JSON(t *testing.T) {
	r := newEchoRouter(100)
	body := `{"a":"` + strings.Repeat("x", 1000) + `"}`

	req := httptest.NewRequest(http.MethodPost, "/bind", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("expected a JSON error body, got %q: %v", w.Body.String(), err)
	}
	if resp["error"] == "" {
		t.Fatal("expected a non-empty error message")
	}
	// Must not also contain the handler's own generic 400 error message —
	// i.e. no double response write.
	if strings.Count(w.Body.String(), "{") > 1 {
		t.Fatalf("expected exactly one JSON object in the response body, got %q", w.Body.String())
	}
}

func TestBodyLimit_RejectsOversizedBodyReadViaIOReadAll(t *testing.T) {
	r := newEchoRouter(100)
	body := strings.Repeat("x", 1000)

	req := httptest.NewRequest(http.MethodPost, "/read-all", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBodyLimit_RouteSpecificOverrideAllowsLargerPayload(t *testing.T) {
	r := gin.New()
	r.Use(BodyLimit(100)) // global default
	uploads := r.Group("/uploads")
	uploads.Use(BodyLimit(10_000)) // looser, route-specific override
	uploads.POST("/file", func(c *gin.Context) {
		var payload map[string]any
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, payload)
	})

	body := `{"a":"` + strings.Repeat("x", 1000) + `"}` // over the global 100-byte default
	req := httptest.NewRequest(http.MethodPost, "/uploads/file", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected the route-specific override to allow this payload, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBodyLimit_RouteSpecificOverrideAllowsTighterLimit(t *testing.T) {
	r := gin.New()
	r.Use(BodyLimit(10_000)) // global default
	webhooks := r.Group("/webhooks")
	webhooks.Use(BodyLimit(50)) // tighter, route-specific override
	webhooks.POST("/incoming", func(c *gin.Context) {
		var payload map[string]any
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, payload)
	})

	body := `{"a":"` + strings.Repeat("x", 200) + `"}` // under the 10000 default, over the 50-byte override
	req := httptest.NewRequest(http.MethodPost, "/webhooks/incoming", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected the tighter route-specific override to reject this payload, got %d: %s", w.Code, w.Body.String())
	}
}
