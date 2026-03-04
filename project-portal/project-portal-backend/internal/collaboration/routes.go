package collaboration

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, h *Handler) {
	v1 := r.Group("/api/v1/collaboration")
	{
		// Project members
		v1.GET("/projects/:id/members", h.ListMembers)
		v1.DELETE("/projects/:id/members/:userId", h.RemoveMember)

		// Project invitations
		v1.POST("/projects/:id/invite", h.InviteUser)
		v1.GET("/projects/:id/invitations", h.ListInvitations)

		// Activity feed
		v1.GET("/projects/:id/activities", h.GetActivities)


		// Comments
		v1.GET("/projects/:id/comments", h.ListComments)
		v1.POST("/comments", h.CreateComment)


		// Tasks
		v1.GET("/projects/:id/tasks", h.ListTasks)
		v1.POST("/tasks", h.CreateTask)
		v1.PATCH("/tasks/:id", h.UpdateTask)

		// Resources
		v1.GET("/projects/:id/resources", h.ListResources)
		v1.POST("/resources", h.CreateResource)
	}
}
