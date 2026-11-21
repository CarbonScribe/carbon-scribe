package security

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// allowedCORSHeaders is the fixed set of request headers browsers are
// allowed to send cross-origin. X-User-ID is deliberately absent (#798): it
// identifies the caller, and allowing a client to set it directly would
// invite spoofing a header the server should only ever trust from its own
// authentication layer.
const allowedCORSHeaders = "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With"

const allowedCORSMethods = "POST, OPTIONS, GET, PUT, DELETE, PATCH"

// CORS returns Gin middleware enforcing an explicit cross-origin allowlist
// (#798), replacing a previous implementation that defaulted to "*" with
// credentials enabled and echoed back the first configured origin to any
// caller that didn't match.
//
// Matching is exact string equality between the request's Origin header and
// an entry in allowedOrigins — including a literal "*" entry, which a real
// browser's Origin header can never equal, so a wildcard configured this way
// is a permanent non-match rather than a true wildcard.
// (internal/config.Validate refuses to start in production when
// allowedOrigins is empty or contains "*".)
//
// A matched origin gets Access-Control-Allow-Origin echoed back plus
// Access-Control-Allow-Credentials: true. A non-matching origin gets no CORS
// headers at all — the request still reaches the handler (CORS is enforced
// by the browser, not the server), except a non-matching preflight
// (OPTIONS) request, which is answered with 403 and no allow headers so the
// browser never proceeds with the real request. Vary: Origin is always set,
// since the response varies by Origin and this prevents a shared cache from
// serving one origin's CORS headers to another.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = true
	}

	return func(c *gin.Context) {
		c.Writer.Header().Add("Vary", "Origin")

		origin := c.Request.Header.Get("Origin")
		matched := origin != "" && allowed[origin]

		if matched {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", allowedCORSHeaders)
			c.Writer.Header().Set("Access-Control-Allow-Methods", allowedCORSMethods)
		}

		if c.Request.Method == http.MethodOptions {
			if !matched {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
