package auth

import (
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/config"
	"carbon-scribe/project-portal/project-portal-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func parseWindow(window string, defaultWindow time.Duration) time.Duration {
	if window == "" {
		return defaultWindow
	}
	d, err := time.ParseDuration(window)
	if err != nil {
		return defaultWindow
	}
	return d
}

// RegisterAuthRoutes registers all auth routes with a router group
func RegisterAuthRoutes(router *gin.RouterGroup, handler *Handler, tokenManager *TokenManager, rateLimiter *middleware.RateLimiter, rateLimitCfg config.RateLimitConfig) {
	// Public endpoints
	router.POST("/register", rateLimiter.LimitByIP("auth_register", rateLimitCfg.RegisterLimit, parseWindow(rateLimitCfg.RegisterWindow, 1*time.Hour)), handler.Register)
	router.POST("/login", rateLimiter.LimitByIP("auth_login", rateLimitCfg.LoginLimit, parseWindow(rateLimitCfg.LoginWindow, 15*time.Minute)), handler.Login)
	router.POST("/wallet-login", rateLimiter.LimitByIP("auth_wallet_login", rateLimitCfg.WalletChallengeLimit, parseWindow(rateLimitCfg.WalletChallengeWindow, 1*time.Minute)), handler.WalletLogin)
	router.POST("/refresh", rateLimiter.LimitByIP("auth_refresh", rateLimitCfg.RefreshLimit, parseWindow(rateLimitCfg.RefreshWindow, 1*time.Hour)), handler.RefreshToken)
	router.POST("/verify-email", handler.VerifyEmail)
	router.POST("/request-password-reset", rateLimiter.LimitByIP("auth_password_reset", rateLimitCfg.PasswordResetLimit, parseWindow(rateLimitCfg.PasswordResetWindow, 1*time.Hour)), handler.RequestPasswordReset)
	router.POST("/reset-password", handler.ResetPassword)
	router.POST("/wallet-challenge", rateLimiter.LimitByIP("auth_wallet_challenge", rateLimitCfg.WalletChallengeLimit, parseWindow(rateLimitCfg.WalletChallengeWindow, 1*time.Minute)), handler.GenerateWalletChallenge)

	// Protected endpoints
	protected := router.Group("")
	protected.Use(AuthMiddleware(tokenManager))
	{
		protected.GET("/me", handler.GetProfile)
		protected.PUT("/me", handler.UpdateProfile)
		protected.POST("/change-password", handler.ChangePassword)
		protected.POST("/logout", handler.Logout)
	}
}
