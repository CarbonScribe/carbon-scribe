package collaboration

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, h *Handler) {
	v1 := r.Group("/api/v1/collaboration")
	{
		// Project Invitation
		v1.POST("/projects/:id/invite", h.InviteUser)

		// Activity Feed
		v1.GET("/projects/:id/activities", h.GetActivities)

		// Comments
		v1.POST("/comments", h.CreateComment)

		// Tasks
		v1.POST("/tasks", h.CreateTask)

		// Resources
		v1.POST("/resources", h.CreateResource)
	}
}
