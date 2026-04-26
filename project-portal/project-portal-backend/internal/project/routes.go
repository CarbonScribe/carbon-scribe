package project

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/project/quality"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, handler *Handler, qualityHandler *quality.Handler) {
	projectGroup := r.Group("/api/v1/projects")
	{
		 projectGroup.POST("", handler.CreateProject)
		 projectGroup.GET("", handler.ListProjects)
		 projectGroup.GET("/:id", handler.GetProject)
		 projectGroup.PUT("/:id", handler.UpdateProject)
		 projectGroup.DELETE("/:id", handler.DeleteProject)

		 // Quality scoring endpoints
		 projectGroup.GET("/:id/quality-score", qualityHandler.GetProjectScore)
		 projectGroup.GET("/:id/quality-score/history", qualityHandler.GetScoreHistory)
		 projectGroup.POST("/:id/quality-score/recalculate", qualityHandler.RecalculateScore)
	}

	// Global quality endpoints
	r.GET("/api/v1/projects/quality/ranking", qualityHandler.ListTopScores)
	r.POST("/api/v1/projects/quality/sync", qualityHandler.SyncScoresToContract)
}
