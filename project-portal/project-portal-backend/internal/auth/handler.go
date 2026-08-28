package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for auth endpoints
type Handler struct {
	service *Service
}

// NewHandler creates a new auth handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Register handles user registration
func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userResp, verificationToken, err := h.service.Register(req.Email, req.Password, req.FullName, req.Organization)
	if err != nil {
		if errors.Is(err, errors.New("user with this email already exists")) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user":               userResp,
		"verification_token": verificationToken,
		"message":            "User registered successfully. Please verify your email.",
	})
}

// Login handles email/password login
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	authResp, err := h.service.Login(req.Email, req.Password, ipAddress, userAgent)
	if err != nil {
		if errors.Is(err, ErrEmailNotVerified) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "verification_required": true})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, authResp)
}

// WalletLogin handles Stellar wallet login
func (h *Handler) WalletLogin(c *gin.Context) {
	var req WalletLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	authResp, err := h.service.WalletLogin(req.PublicKey, req.SignedChallenge, ipAddress, userAgent)
	if err != nil {
		if errors.Is(err, ErrEmailNotVerified) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "verification_required": true})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, authResp)
}

// RefreshToken handles token refresh
func (h *Handler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tokenResp, err := h.service.RefreshToken(req.RefreshToken)
	if err != nil {
		if errors.Is(err, ErrEmailNotVerified) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "verification_required": true})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, tokenResp)
}

// VerifyEmail handles email verification
func (h *Handler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.VerifyEmail(req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// ResendVerification handles requests for a new email verification token.
func (h *Handler) ResendVerification(c *gin.Context) {
	var req ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.service.ResendVerification(req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "If the email requires verification, a verification link has been sent"})
}

// Logout handles user logout
func (h *Handler) Logout(c *gin.Context) {
	accessToken, exists := c.Get("access_token")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Extract session ID from header or body (optional parameter)
	sessionID := c.GetString("session_id")

	// For now, we revoke the token directly
	if accessTokenStr, ok := accessToken.(string); ok {
		err := h.service.Logout(sessionID, accessTokenStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// GetProfile returns the current user's profile
func (h *Handler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	userResp, err := h.service.GetUserProfile(userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, userResp)
}

// UpdateProfile updates the current user's profile
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userResp, err := h.service.UpdateUserProfile(userIDStr, req.FullName, req.Organization)
	if err != nil {
		if errors.Is(err, errors.New("user not found")) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, userResp)
}

// ChangePassword handles password change
func (h *Handler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.ChangePassword(userIDStr, req.CurrentPassword, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

// RequestPasswordReset handles password reset requests
func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var req RequestPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resetToken, err := h.service.RequestPasswordReset(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// For security, always return success even if email doesn't exist
	c.JSON(http.StatusOK, gin.H{
		"message": "If the email exists, a password reset link has been sent",
		"token":   resetToken, // In production, send this via email, not in response
	})
}

// ResetPassword handles password reset with token
func (h *Handler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.ResetPassword(req.Token, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// GenerateWalletChallenge generates a challenge for wallet authentication
func (h *Handler) GenerateWalletChallenge(c *gin.Context) {
	var req struct {
		PublicKey string `json:"public_key" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate wallet address
	if err := ValidateWalletAddress(req.PublicKey); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Stellar wallet address"})
		return
	}

	challenge, err := GenerateChallengeToken(req.PublicKey, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"challenge":  challenge,
		"expires_in": 900, // 15 minutes
	})
}
