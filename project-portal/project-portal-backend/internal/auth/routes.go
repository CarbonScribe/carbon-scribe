package auth

import (
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterAuthRoutes registers all auth routes with a router group.
// rl may be nil — when nil, rate limiting is skipped (useful in tests).
func RegisterAuthRoutes(router *gin.RouterGroup, handler *Handler, tokenManager *TokenManager, rl *middleware.RateLimiter) {
	// ------------------------------------------------------------------
	// Public endpoints — each has its own rate limit.
	// ------------------------------------------------------------------

	if rl != nil {
		// login: 5 attempts per 15 minutes per IP
		router.POST("/login",
			rl.LimitWithGraduatedCooldown(middleware.RouteConfig{
				MaxRequests: 5,
				Window:      15 * time.Minute,
				KeyPrefix:   "rl:auth:login",
			}, 3, 60),
			handler.Login,
		)

		// register: 3 attempts per hour per IP
		router.POST("/register",
			rl.Limit(middleware.RouteConfig{
				MaxRequests: 3,
				Window:      1 * time.Hour,
				KeyPrefix:   "rl:auth:register",
			}),
			handler.Register,
		)

		// refresh: 10 attempts per hour per IP
		router.POST("/refresh",
			rl.Limit(middleware.RouteConfig{
				MaxRequests: 10,
				Window:      1 * time.Hour,
				KeyPrefix:   "rl:auth:refresh",
			}),
			handler.RefreshToken,
		)

		// forgot-password: 3 attempts per hour per IP
		router.POST("/request-password-reset",
			rl.Limit(middleware.RouteConfig{
				MaxRequests: 3,
				Window:      1 * time.Hour,
				KeyPrefix:   "rl:auth:forgot-password",
			}),
			handler.RequestPasswordReset,
		)

		// resend-verification: 3 attempts per hour per IP
		router.POST("/resend-verification",
			rl.Limit(middleware.RouteConfig{
				MaxRequests: 3,
				Window:      1 * time.Hour,
				KeyPrefix:   "rl:auth:resend-verification",
			}),
			handler.ResendVerification,
		)

		// wallet-challenge: 5 attempts per minute per IP
		router.POST("/wallet-challenge",
			rl.Limit(middleware.RouteConfig{
				MaxRequests: 5,
				Window:      1 * time.Minute,
				KeyPrefix:   "rl:auth:wallet-challenge",
			}),
			handler.GenerateWalletChallenge,
		)
	} else {
		router.POST("/login", handler.Login)
		router.POST("/register", handler.Register)
		router.POST("/refresh", handler.RefreshToken)
		router.POST("/request-password-reset", handler.RequestPasswordReset)
		router.POST("/wallet-challenge", handler.GenerateWalletChallenge)
		router.POST("/resend-verification", handler.ResendVerification)
	}

	// These routes are less sensitive — a simple limit is sufficient
	router.POST("/wallet-login", handler.WalletLogin)
	router.POST("/verify-email", handler.VerifyEmail)
	router.POST("/reset-password", handler.ResetPassword)

	// Protected endpoints
	protected := router.Group("")
	protected.Use(AuthMiddleware(tokenManager), RequireVerifiedEmail(handler.service.repository))
	{
		protected.GET("/me", handler.GetProfile)
		protected.PUT("/me", handler.UpdateProfile)
		protected.POST("/change-password", handler.ChangePassword)
		protected.POST("/logout", handler.Logout)
	}
}
