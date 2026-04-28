package collaboration

import (
	"context"
	"errors"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/collaboration/dto"

	"github.com/google/uuid"
)

// GetEnrichedMember returns a single enriched project member with profile data
func (s *Service) GetEnrichedMember(ctx context.Context, projectID, userID string) (*dto.EnrichedProjectMemberResponse, error) {
       m, err := s.repo.GetEnrichedMember(ctx, projectID, userID)
       if err != nil {
	       return nil, err
       }
       resp := &dto.EnrichedProjectMemberResponse{
	       UserID:      m.UserID,
	       DisplayName: m.DisplayName,
	       Email:       m.Email,
	       AvatarURL:   m.AvatarURL,
	       Phone:       m.Phone,
	       Location:    m.Location,
	       Title:       m.Title,
	       Bio:         m.Bio,
	       Role:        m.Role,
	       JoinedAt:    m.JoinedAt,
       }
       return resp, nil
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// checkUserPermission checks if a user has the required role for an operation
func (s *Service) checkUserPermission(ctx context.Context, projectID, userID string, allowedRoles ...string) error {
	member, err := s.repo.GetMember(ctx, projectID, userID)
	if err != nil {
		return errors.New("user not found in project")
	}

	for _, allowedRole := range allowedRoles {
		if member.Role == allowedRole {
			return nil
		}
	}

	return errors.New("insufficient permissions")
}

// InviteUser creates an invitation for a user
func (s *Service) InviteUser(ctx context.Context, projectID, invitedByUserID, email, role string) (*ProjectInvitation, error) {
	// Check permission: only owners and managers can invite users
	if err := s.checkUserPermission(ctx, projectID, invitedByUserID, "owner", "manager"); err != nil {
		return nil, err
	}

	token := uuid.New().String()
	invite := &ProjectInvitation{
		ProjectID: projectID,
		Email:     email,
		Role:      role,
		Token:     token,
		Status:    "pending",
		ExpiresAt: time.Now().Add(48 * time.Hour),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.repo.CreateInvitation(ctx, invite); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: projectID,
		UserID:    invitedByUserID,
		Type:      "user",
		Action:    "user_invited",
		Metadata:  map[string]any{"email": email, "role": role, "invited_by": invitedByUserID},
		CreatedAt: time.Now(),
	})

	return invite, nil
}

func (s *Service) ListProjectActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error) {
	return s.repo.ListActivities(ctx, projectID, limit, offset)
}

func (s *Service) AddComment(ctx context.Context, req CreateCommentRequest, actorUserID string) (*Comment, error) {
	comment := &Comment{
		ProjectID:   req.ProjectID,
		UserID:      actorUserID,
		ResourceID:  req.ResourceID,
		ParentID:    req.ParentID,
		Content:     req.Content,
		Mentions:    req.Mentions,
		Attachments: req.Attachments,
		Location:    req.Location,
	}
	comment.CreatedAt = time.Now()
	comment.UpdatedAt = time.Now()
	if err := s.repo.CreateComment(ctx, comment); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: comment.ProjectID,
		UserID:    comment.UserID,
		Type:      "user",
		Action:    "comment_added",
		CreatedAt: time.Now(),
	})
	return comment, nil
}

func (s *Service) CreateTask(ctx context.Context, req CreateTaskRequest, actorUserID string) (*Task, error) {
	task := &Task{
		ProjectID:   req.ProjectID,
		AssignedTo:  req.AssignedTo,
		CreatedBy:   actorUserID,
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Priority:    req.Priority,
		DueDate:     req.DueDate,
	}
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	if err := s.repo.CreateTask(ctx, task); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: task.ProjectID,
		UserID:    task.CreatedBy,
		Type:      "user",
		Action:    "task_created",
		Metadata:  map[string]any{"task_title": task.Title},
		CreatedAt: time.Now(),
	})
	return task, nil
}



func (s *Service) ListMembers(ctx context.Context, projectID string) ([]dto.EnrichedProjectMemberResponse, error) {
       enriched, err := s.repo.ListMembers(ctx, projectID)
       if err != nil {
	       return nil, err
       }
       // Map to DTO
       var resp []dto.EnrichedProjectMemberResponse
       for _, m := range enriched {
	       resp = append(resp, dto.EnrichedProjectMemberResponse{
		       UserID:      m.UserID,
		       DisplayName: m.DisplayName,
		       Email:       m.Email,
		       AvatarURL:   m.AvatarURL,
		       Phone:       m.Phone,
		       Location:    m.Location,
		       Title:       m.Title,
		       Bio:         m.Bio,
		       Role:        m.Role,
		       JoinedAt:    m.JoinedAt,
	       })
       }
       return resp, nil
}

func (s *Service) RemoveMember(ctx context.Context, projectID, requestingUserID, targetUserID string) error {
	// Check permission: only owners and managers can remove members
	if err := s.checkUserPermission(ctx, projectID, requestingUserID, "owner", "manager"); err != nil {
		return err
	}

	return s.repo.RemoveMember(ctx, projectID, targetUserID)
}

func (s *Service) ListInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error) {
	return s.repo.ListInvitations(ctx, projectID)
}

// ResendInvitation resends an existing pending invitation
func (s *Service) ResendInvitation(ctx context.Context, invitationID, requestingUserID string) (*ProjectInvitation, error) {
	invite, err := s.repo.GetInvitation(ctx, invitationID)
	if err != nil {
		return nil, errors.New("invitation not found")
	}

	// Check permission: only managers/owners can resend
	if err := s.checkUserPermission(ctx, invite.ProjectID, requestingUserID, "owner", "manager"); err != nil {
		return nil, err
	}

	// Can only resend pending invitations
	if invite.Status != "pending" {
		return nil, errors.New("can only resend pending invitations")
	}

	// Check rate limit: max 3 resends
	if invite.ResentCount >= 3 {
		return nil, errors.New("maximum resend limit reached")
	}

	now := time.Now()
	invite.ResentAt = &now
	invite.ResentCount++
	invite.ExpiresAt = now.Add(48 * time.Hour)
	invite.UpdatedAt = now

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		UserID:    requestingUserID,
		Type:      "user",
		Action:    "invitation_resent",
		Metadata:  map[string]any{"email": invite.Email, "resent_count": invite.ResentCount},
		CreatedAt: now,
	})

	return invite, nil
}

// CancelInvitation cancels a pending invitation
func (s *Service) CancelInvitation(ctx context.Context, invitationID, requestingUserID string) error {
	invite, err := s.repo.GetInvitation(ctx, invitationID)
	if err != nil {
		return errors.New("invitation not found")
	}

	// Check permission: only managers/owners can cancel
	if err := s.checkUserPermission(ctx, invite.ProjectID, requestingUserID, "owner", "manager"); err != nil {
		return err
	}

	// Can only cancel pending invitations
	if invite.Status != "pending" {
		return errors.New("can only cancel pending invitations")
	}

	invite.Status = "cancelled"
	invite.UpdatedAt = time.Now()

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		UserID:    requestingUserID,
		Type:      "user",
		Action:    "invitation_cancelled",
		Metadata:  map[string]any{"email": invite.Email},
		CreatedAt: invite.UpdatedAt,
	})

	return nil
}

// AcceptInvitation accepts an invitation (called by the invited user)
func (s *Service) AcceptInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	invite, err := s.repo.GetInvitation(ctx, invitationID)
	if err != nil {
		return nil, errors.New("invitation not found")
	}

	// Can only accept pending invitations
	if invite.Status != "pending" {
		return nil, errors.New("invitation is not pending")
	}

	// Check if invitation is expired
	if time.Now().After(invite.ExpiresAt) {
		return nil, errors.New("invitation has expired")
	}

	invite.Status = "accepted"
	invite.UpdatedAt = time.Now()

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		Type:      "user",
		Action:    "invitation_accepted",
		Metadata:  map[string]any{"email": invite.Email},
		CreatedAt: invite.UpdatedAt,
	})

	return invite, nil
}

// DeclineInvitation declines an invitation (called by the invited user)
func (s *Service) DeclineInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	invite, err := s.repo.GetInvitation(ctx, invitationID)
	if err != nil {
		return nil, errors.New("invitation not found")
	}

	// Can only decline pending invitations
	if invite.Status != "pending" {
		return nil, errors.New("invitation is not pending")
	}

	invite.Status = "declined"
	invite.UpdatedAt = time.Now()

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		Type:      "user",
		Action:    "invitation_declined",
		Metadata:  map[string]any{"email": invite.Email},
		CreatedAt: invite.UpdatedAt,
	})

	return invite, nil
}

func (s *Service) ListComments(ctx context.Context, projectID string) ([]Comment, error) {
	return s.repo.ListComments(ctx, projectID)
}

func (s *Service) ListTasks(ctx context.Context, projectID string) ([]Task, error) {
	return s.repo.ListTasks(ctx, projectID)
}

func (s *Service) GetTask(ctx context.Context, taskID string) (*Task, error) {
	return s.repo.GetTask(ctx, taskID)
}

func (s *Service) UpdateTask(ctx context.Context, task *Task) error {
	return s.repo.UpdateTask(ctx, task)
}

func (s *Service) ListResources(ctx context.Context, projectID string) ([]SharedResource, error) {
	return s.repo.ListResources(ctx, projectID)
}

func (s *Service) AddResource(ctx context.Context, req CreateResourceRequest, actorUserID string) (*SharedResource, error) {
	resource := &SharedResource{
		ProjectID:  req.ProjectID,
		Type:       req.Type,
		Name:       req.Name,
		URL:        req.URL,
		Metadata:   req.Metadata,
		UploadedBy: actorUserID,
	}
	resource.CreatedAt = time.Now()
	resource.UpdatedAt = time.Now()
	if err := s.repo.CreateResource(ctx, resource); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: resource.ProjectID,
		UserID:    resource.UploadedBy,
		Type:      "user",
		Action:    "resource_added",
		Metadata:  map[string]any{"resource_name": resource.Name},
		CreatedAt: time.Now(),
	})
	return resource, nil
}
