package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

// Ping endpoint
func (h *Handler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "auth service alive!"})
}

// Dummy register endpoint
func (h *Handler) Register(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "register endpoint works"})
}

// Dummy login endpoint
func (h *Handler) Login(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "login endpoint works"})
}
