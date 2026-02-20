package project

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, handler *Handler) {
	projectGroup := r.Group("/api/v1/projects")
	{
		projectGroup.POST("", handler.CreateProject)
		projectGroup.GET("", handler.ListProjects)
		projectGroup.GET("/:id", handler.GetProject)
		projectGroup.PUT("/:id", handler.UpdateProject)
		projectGroup.DELETE("/:id", handler.DeleteProject)
	}
}
