package collaboration

import "github.com/gin-gonic/gin"

func RegisterRoutes(v1 *gin.RouterGroup, h *Handler) {
	collab := v1.Group("/collaboration")
	collab.Use(authRequired())
	{
		// Project members
		collab.GET("/projects/:id/members", h.ListMembers)
		collab.DELETE("/projects/:id/members/:userId", h.RemoveMember)

		// Project invitations
		collab.POST("/projects/:id/invite", h.InviteUser)
		collab.GET("/projects/:id/invitations", h.ListInvitations)

		// Activity feed
		collab.GET("/projects/:id/activities", h.GetActivities)

		// Comments
		collab.GET("/projects/:id/comments", h.ListComments)
		collab.POST("/comments", h.CreateComment)

		// Tasks
		collab.GET("/projects/:id/tasks", h.ListTasks)
		collab.POST("/tasks", h.CreateTask)
		collab.PATCH("/tasks/:id", h.UpdateTask)

		// Resources
		collab.GET("/projects/:id/resources", h.ListResources)
		collab.POST("/resources", h.CreateResource)
	}
}
