package collaboration

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// InviteUserRequest
type InviteUserRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required"`
}

func (h *Handler) InviteUser(c *gin.Context) {
	projectID := c.Param("id")
	var req InviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invite, err := h.service.InviteUser(c.Request.Context(), projectID, req.Email, req.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invite)
}

func (h *Handler) GetActivities(c *gin.Context) {
	projectID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	activities, err := h.service.ListProjectActivities(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, activities)
}

func (h *Handler) CreateComment(c *gin.Context) {
	var comment Comment
	if err := c.ShouldBindJSON(&comment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Assume UserID is set from auth middleware context, but for now take from body

	if err := h.service.AddComment(c.Request.Context(), &comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, comment)
}

func (h *Handler) CreateTask(c *gin.Context) {
	var task Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateTask(c.Request.Context(), &task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func (h *Handler) CreateResource(c *gin.Context) {
	var resource SharedResource
	if err := c.ShouldBindJSON(&resource); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AddResource(c.Request.Context(), &resource); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resource)
}

func (h *Handler) ListMembers(c *gin.Context) {
	projectID := c.Param("id")
	members, err := h.service.ListMembers(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, members)
}

func (h *Handler) RemoveMember(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.Param("userId")
	if err := h.service.RemoveMember(c.Request.Context(), projectID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ListInvitations(c *gin.Context) {
	projectID := c.Param("id")
	invitations, err := h.service.ListInvitations(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, invitations)
}

// ResendInvitation resends an invitation
func (h *Handler) ResendInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	invite, err := h.service.ResendInvitation(c.Request.Context(), invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, invite)
}

// CancelInvitation cancels a pending invitation
func (h *Handler) CancelInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	if err := h.service.CancelInvitation(c.Request.Context(), invitationID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AcceptInvitation accepts an invitation
func (h *Handler) AcceptInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	member, err := h.service.AcceptInvitation(c.Request.Context(), invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, member)
}

// DeclineInvitation declines an invitation
func (h *Handler) DeclineInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	if err := h.service.DeclineInvitation(c.Request.Context(), invitationID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ListComments(c *gin.Context) {
	projectID := c.Param("id")
	comments, err := h.service.ListComments(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func (h *Handler) ListTasks(c *gin.Context) {
	projectID := c.Param("id")
	tasks, err := h.service.ListTasks(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

func (h *Handler) UpdateTask(c *gin.Context) {
	taskID := c.Param("id")
	existing, err := h.service.GetTask(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	var patch Task
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if patch.Status != "" {
		existing.Status = patch.Status
	}
	if patch.AssignedTo != nil {
		existing.AssignedTo = patch.AssignedTo
	}
	if patch.Title != "" {
		existing.Title = patch.Title
	}
	if patch.Description != "" {
		existing.Description = patch.Description
	}
	if patch.Priority != "" {
		existing.Priority = patch.Priority
	}
	if patch.DueDate != nil {
		existing.DueDate = patch.DueDate
	}
	if err := h.service.UpdateTask(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	updated, _ := h.service.GetTask(c.Request.Context(), taskID)
	c.JSON(http.StatusOK, updated)
}

func (h *Handler) ListResources(c *gin.Context) {
	projectID := c.Param("id")
	resources, err := h.service.ListResources(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resources)
}

// authRequired enforces a valid Authorization header and X-User-ID on all
// collaboration endpoints, matching the pattern used by other API modules.
func authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.TrimSpace(c.GetHeader("Authorization")) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing auth header"})
			return
		}
		userIDHeader := strings.TrimSpace(c.GetHeader("X-User-ID"))
		if userIDHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing X-User-ID header"})
			return
		}
		uid, err := uuid.Parse(userIDHeader)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID header"})
			return
		}
		c.Set("collaboration_user_id", uid)
		c.Next()
	}
}
