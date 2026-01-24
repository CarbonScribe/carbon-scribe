package auth

import "github.com/gin-gonic/gin"

// RegisterRoutes registers Auth routes
func RegisterRoutes(r *gin.Engine, handler *Handler) {
	authGroup := r.Group("/auth")
	{
		authGroup.GET("/ping", handler.Ping)
		authGroup.POST("/register", handler.Register)
		authGroup.POST("/login", handler.Login)
		authGroup.POST("/refresh", handler.Refresh)
		authGroup.POST("/logout", handler.Logout)
		authGroup.POST("/verify-email", handler.VerifyEmail)
		authGroup.POST("/me", handler.Me)
		authGroup.POST("/change-password", handler.ChangePassword)
		authGroup.PUT("/me", handler.UpdateProfile)
		authGroup.POST("/request-password-reset", handler.RequestPasswordReset)
		authGroup.POST("/reset-password", handler.ResetPassword)

		// Submission endpoints
		authGroup.POST("/submit", SubmitQuest)
		authGroup.GET("/submissions", ListSubmissions)
	}
}
