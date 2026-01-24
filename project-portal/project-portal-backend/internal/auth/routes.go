package auth

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, handler *Handler) {
	authGroup := r.Group("/auth")
	{
		authGroup.GET("/ping", handler.Ping)
		authGroup.POST("/register", handler.Register)
		authGroup.POST("/login", handler.Login)

		// Submission endpoints
		authGroup.POST("/submit", SubmitQuest)
		authGroup.GET("/submissions", ListSubmissions)
	}
}
