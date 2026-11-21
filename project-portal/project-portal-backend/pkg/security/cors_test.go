package security

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func newCORSTestRouter(allowedOrigins []string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS(allowedOrigins))
	r.Any("/resource", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func TestCORS_AllowedOriginGetsEchoedWithCredentials(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/resource", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Equal(t, "Origin", w.Header().Get("Vary"))
}

func TestCORS_DisallowedOriginGetsNoHeadersButStillReachesHandler(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/resource", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// CORS is enforced by the browser, not the server: a non-preflight
	// request still reaches the handler, it just carries no CORS headers so
	// the browser withholds the response from the page's JS.
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORS_NoOriginHeaderGetsNoCORSHeaders(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/resource", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_AllowedPreflightGetsNoContentAndHeaders(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodOptions, "/resource", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Headers"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Methods"))
}

func TestCORS_DisallowedPreflightGetsForbiddenAndNoHeaders(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodOptions, "/resource", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Headers"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Methods"))
}

func TestCORS_WildcardEntryNeverMatchesARealOrigin(t *testing.T) {
	r := newCORSTestRouter([]string{"*"})

	req := httptest.NewRequest(http.MethodGet, "/resource", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORS_XUserIDIsNotInAllowedHeaders(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodOptions, "/resource", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.NotContains(t, w.Header().Get("Access-Control-Allow-Headers"), "X-User-ID")
}

func TestCORS_MultipleAllowedOriginsOnlyMatchExactly(t *testing.T) {
	r := newCORSTestRouter([]string{"https://app.example.com", "https://admin.example.com"})

	for _, tc := range []struct {
		origin  string
		matched bool
	}{
		{"https://app.example.com", true},
		{"https://admin.example.com", true},
		{"https://app.example.com.evil.com", false},
		{"http://app.example.com", false}, // scheme must match too
	} {
		req := httptest.NewRequest(http.MethodGet, "/resource", nil)
		req.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if tc.matched {
			assert.Equal(t, tc.origin, w.Header().Get("Access-Control-Allow-Origin"), "origin %q", tc.origin)
		} else {
			assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"), "origin %q", tc.origin)
		}
	}
}
