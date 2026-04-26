package collaboration

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/auth"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(v1 *gin.RouterGroup, h *Handler, tokenManager *auth.TokenManager) {
	collab := v1.Group("/collaboration")
	collab.Use(auth.AuthMiddleware(tokenManager))
	{
		// Project members
		collab.GET("/projects/:id/members", h.ListMembers)
		collab.GET("/projects/:id/members/:userId", h.GetEnrichedMember)
		collab.DELETE("/projects/:id/members/:userId", h.RemoveMember)

		// Project invitations
		collab.POST("/projects/:id/invite", h.InviteUser)
		collab.GET("/projects/:id/invitations", h.ListInvitations)
		collab.POST("/invitations/:invitationId/resend", h.ResendInvitation)
		collab.POST("/invitations/:invitationId/cancel", h.CancelInvitation)
		collab.POST("/invitations/:invitationId/accept", h.AcceptInvitation)
		collab.POST("/invitations/:invitationId/decline", h.DeclineInvitation)

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
