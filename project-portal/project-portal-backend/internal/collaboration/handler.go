package collaboration

import (
	"net/http"
	"strconv"
	"time"

	authctx "carbon-scribe/project-portal/project-portal-backend/internal/auth"

	"github.com/gin-gonic/gin"
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

type inviteUserResponse struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Token     string    `json:"token"`
	Status    string    `json:"status"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// GetEnrichedMember handles GET /projects/:id/members/:userId
func (h *Handler) GetEnrichedMember(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.Param("userId")
	member, err := h.service.GetEnrichedMember(c.Request.Context(), projectID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}
	c.JSON(http.StatusOK, member)
}

func (h *Handler) InviteUser(c *gin.Context) {
	actorUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	projectID := c.Param("id")
	var req InviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invite, err := h.service.InviteUser(c.Request.Context(), projectID, actorUserID, req.Email, req.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, inviteUserResponse{
		ID:        invite.ID,
		ProjectID: invite.ProjectID,
		Email:     invite.Email,
		Role:      invite.Role,
		Token:     invite.Token,
		Status:    invite.Status,
		ExpiresAt: invite.ExpiresAt,
		CreatedAt: invite.CreatedAt,
		UpdatedAt: invite.UpdatedAt,
	})
}

// PaginationResponse wraps list data with pagination metadata
type PaginationResponse struct {
	Data       interface{}    `json:"data"`
	Pagination PaginationMeta `json:"pagination"`
}

// parsePagination extracts and validates limit/offset from query params
func parsePagination(c *gin.Context) (int, int, error) {
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 20 // use default on parse error
	}

	offsetStr := c.DefaultQuery("offset", "0")
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0 // use default on parse error
	}

	return ValidatePagination(limit, offset)
}

func (h *Handler) GetActivities(c *gin.Context) {
	projectID := c.Param("id")

	limit, offset, err := parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	activities, total, err := h.service.ListProjectActivities(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       activities,
		Pagination: BuildPaginationMeta(total, limit, offset),
	})
}

func (h *Handler) CreateComment(c *gin.Context) {
	actorUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	comment, err := h.service.AddComment(c.Request.Context(), req, actorUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, comment)
}

func (h *Handler) CreateTask(c *gin.Context) {
	actorUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.service.CreateTask(c.Request.Context(), req, actorUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func (h *Handler) CreateResource(c *gin.Context) {
	actorUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreateResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resource, err := h.service.AddResource(c.Request.Context(), req, actorUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resource)
}

func (h *Handler) ListMembers(c *gin.Context) {
	projectID := c.Param("id")

	limit, offset, err := parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	members, total, err := h.service.ListMembers(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       members,
		Pagination: BuildPaginationMeta(total, limit, offset),
	})
}

func (h *Handler) RemoveMember(c *gin.Context) {
	projectID := c.Param("id")
	targetUserID := c.Param("userId")

	// Get the requesting user ID from context
	requestingUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.RemoveMember(c.Request.Context(), projectID, requestingUserID, targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ListInvitations(c *gin.Context) {
	projectID := c.Param("id")

	limit, offset, err := parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invitations, total, err := h.service.ListInvitations(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       invitations,
		Pagination: BuildPaginationMeta(total, limit, offset),
	})
}

func (h *Handler) ListComments(c *gin.Context) {
	projectID := c.Param("id")

	limit, offset, err := parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	comments, total, err := h.service.ListComments(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       comments,
		Pagination: BuildPaginationMeta(total, limit, offset),
	})
}

func (h *Handler) ListTasks(c *gin.Context) {
	projectID := c.Param("id")

	limit, offset, err := parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tasks, total, err := h.service.ListTasks(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       tasks,
		Pagination: BuildPaginationMeta(total, limit, offset),
	})
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

	limit, offset, err := parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resources, total, err := h.service.ListResources(c.Request.Context(), projectID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       resources,
		Pagination: BuildPaginationMeta(total, limit, offset),
	})
}

// Invitation Lifecycle Handlers

func (h *Handler) ResendInvitation(c *gin.Context) {
	requestingUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	invitationID := c.Param("invitationId")

	invite, err := h.service.ResendInvitation(c.Request.Context(), invitationID, requestingUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, inviteUserResponse{
		ID:        invite.ID,
		ProjectID: invite.ProjectID,
		Email:     invite.Email,
		Role:      invite.Role,
		Token:     invite.Token,
		Status:    invite.Status,
		ExpiresAt: invite.ExpiresAt,
		CreatedAt: invite.CreatedAt,
		UpdatedAt: invite.UpdatedAt,
	})
}

func (h *Handler) CancelInvitation(c *gin.Context) {
	requestingUserID, err := authctx.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	invitationID := c.Param("invitationId")

	if err := h.service.CancelInvitation(c.Request.Context(), invitationID, requestingUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AcceptInvitation(c *gin.Context) {
	invitationID := c.Param("invitationId")

	invite, err := h.service.AcceptInvitation(c.Request.Context(), invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, inviteUserResponse{
		ID:        invite.ID,
		ProjectID: invite.ProjectID,
		Email:     invite.Email,
		Role:      invite.Role,
		Token:     invite.Token,
		Status:    invite.Status,
		ExpiresAt: invite.ExpiresAt,
		CreatedAt: invite.CreatedAt,
		UpdatedAt: invite.UpdatedAt,
	})
}

func (h *Handler) DeclineInvitation(c *gin.Context) {
	invitationID := c.Param("invitationId")

	invite, err := h.service.DeclineInvitation(c.Request.Context(), invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, inviteUserResponse{
		ID:        invite.ID,
		ProjectID: invite.ProjectID,
		Email:     invite.Email,
		Role:      invite.Role,
		Token:     invite.Token,
		Status:    invite.Status,
		ExpiresAt: invite.ExpiresAt,
		CreatedAt: invite.CreatedAt,
		UpdatedAt: invite.UpdatedAt,
	})
}
