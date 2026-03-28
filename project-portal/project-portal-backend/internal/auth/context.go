package auth

import (
	"errors"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var ErrUserIDMissingFromContext = errors.New("user id missing from auth context")

// GetUserIDFromContext extracts the authenticated user ID set by JWT middleware.
func GetUserIDFromContext(c *gin.Context) (string, error) {
	v, exists := c.Get("user_id")
	if !exists {
		return "", ErrUserIDMissingFromContext
	}

	switch userID := v.(type) {
	case string:
		if userID == "" {
			return "", ErrUserIDMissingFromContext
		}
		return userID, nil
	case uuid.UUID:
		if userID == uuid.Nil {
			return "", ErrUserIDMissingFromContext
		}
		return userID.String(), nil
	default:
		return "", fmt.Errorf("invalid user_id type in context: %T", v)
	}
}
