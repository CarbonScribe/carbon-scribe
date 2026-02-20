package audit

import (
	"net"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/compliance"

	"github.com/gin-gonic/gin"
)

// Middleware returns a Gin middleware that creates audit log entries for requests.
func Middleware(service *compliance.Service, serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		entry := compliance.AuditEntry{
			EventType:   "data_access",
			EventAction: methodToAction(c.Request.Method),
			ActorType:   compliance.ActorTypeUser,
			ActorIP:     net.ParseIP(c.ClientIP()),
			ServiceName: serviceName,
			Endpoint:    c.FullPath(),
			HTTPMethod:  c.Request.Method,
		}

		if userID := c.GetHeader("X-User-ID"); userID != "" {
			entry.ActorID = userID
		}

		entry.SensitivityLevel = classifyEndpoint(c.FullPath())

		_ = service.LogAuditEvent(c.Request.Context(), entry)

		_ = start // can be used for latency tracking
	}
}

func methodToAction(method string) string {
	switch method {
	case "GET":
		return "read"
	case "POST":
		return "create"
	case "PUT", "PATCH":
		return "update"
	case "DELETE":
		return "delete"
	default:
		return "unknown"
	}
}

func classifyEndpoint(path string) string {
	sensitivePatterns := []string{
		"/compliance/", "/auth/", "/users/",
	}
	for _, p := range sensitivePatterns {
		if len(path) >= len(p) && containsSubstring(path, p) {
			return compliance.SensitivitySensitive
		}
	}
	return compliance.SensitivityNormal
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
