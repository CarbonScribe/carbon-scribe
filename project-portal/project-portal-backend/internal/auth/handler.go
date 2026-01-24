package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	Service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{Service: s}
}

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

func (h *Handler) Refresh(c *gin.Context) {
	c.JSON(200, gin.H{"message": "refresh called"})
}

func (h *Handler) Logout(c *gin.Context) {
	c.JSON(200, gin.H{"message": "logout called"})
}

func (h *Handler) VerifyEmail(c *gin.Context) {
	c.JSON(200, gin.H{"message": "verify email called"})
}

func (h *Handler) Me(c *gin.Context) {
	c.JSON(200, gin.H{"user": "me"})
}

func (h *Handler) ChangePassword(c *gin.Context) {
	c.JSON(200, gin.H{"message": "change password called"})
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	c.JSON(200, gin.H{"message": "update profile called"})
}

func (h *Handler) RequestPasswordReset(c *gin.Context) {
	c.JSON(200, gin.H{"message": "request password reset called"})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	c.JSON(200, gin.H{"message": "reset password called"})
}
