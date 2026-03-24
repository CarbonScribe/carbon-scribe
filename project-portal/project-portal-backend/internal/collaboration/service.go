package collaboration

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// InviteUser creates an invitation for a user
func (s *Service) InviteUser(ctx context.Context, projectID, email, role string) (*ProjectInvitation, error) {
	token := uuid.New().String()
	invite := &ProjectInvitation{
		ProjectID:   projectID,
		Email:       email,
		Role:        role,
		Token:       token,
		Status:      InvitationStatusPending,
		ExpiresAt:   time.Now().Add(48 * time.Hour),
		ResentCount: 0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateInvitation(ctx, invite); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: projectID,
		Type:      "system",
		Action:    "user_invited",
		Metadata:  map[string]any{"email": email, "role": role},
		CreatedAt: time.Now(),
	})

	return invite, nil
}

// ResendInvitation resends an invitation email
func (s *Service) ResendInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	invite, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, errors.New("invitation not found")
	}

	// Validate invitation can be resent
	if invite.Status != InvitationStatusPending {
		return nil, errors.New("only pending invitations can be resent")
	}

	if invite.ResentCount >= MaxInvitationResends {
		return nil, errors.New("maximum resend limit reached")
	}

	if time.Now().After(invite.ExpiresAt) {
		invite.Status = InvitationStatusExpired
		_ = s.repo.UpdateInvitation(ctx, invite)
		return nil, errors.New("invitation has expired")
	}

	// Update resent info
	now := time.Now()
	invite.ResentAt = &now
	invite.ResentCount++
	invite.UpdatedAt = now

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return nil, err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		Type:      "system",
		Action:    "invitation_resent",
		Metadata:  map[string]any{"email": invite.Email, "resent_count": invite.ResentCount},
		CreatedAt: time.Now(),
	})

	return invite, nil
}

// CancelInvitation cancels a pending invitation
func (s *Service) CancelInvitation(ctx context.Context, invitationID string) error {
	invite, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return errors.New("invitation not found")
	}

	if invite.Status != InvitationStatusPending {
		return errors.New("only pending invitations can be cancelled")
	}

	invite.Status = InvitationStatusCancelled
	invite.UpdatedAt = time.Now()

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		Type:      "system",
		Action:    "invitation_cancelled",
		Metadata:  map[string]any{"email": invite.Email},
		CreatedAt: time.Now(),
	})

	return nil
}

// AcceptInvitation accepts an invitation and creates a project member
func (s *Service) AcceptInvitation(ctx context.Context, invitationID string) (*ProjectMember, error) {
	invite, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, errors.New("invitation not found")
	}

	if invite.Status != InvitationStatusPending {
		return nil, errors.New("only pending invitations can be accepted")
	}

	if time.Now().After(invite.ExpiresAt) {
		invite.Status = InvitationStatusExpired
		_ = s.repo.UpdateInvitation(ctx, invite)
		return nil, errors.New("invitation has expired")
	}

	// Create project member
	member := &ProjectMember{
		ProjectID: invite.ProjectID,
		UserID:    invite.Email, // Use email as user ID for now
		Role:      invite.Role,
		JoinedAt:  time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	// Update invitation status
	invite.Status = InvitationStatusAccepted
	invite.UpdatedAt = time.Now()
	_ = s.repo.UpdateInvitation(ctx, invite)

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		UserID:    invite.Email,
		Type:      "system",
		Action:    "invitation_accepted",
		Metadata:  map[string]any{"email": invite.Email, "role": invite.Role},
		CreatedAt: time.Now(),
	})

	return member, nil
}

// DeclineInvitation declines an invitation
func (s *Service) DeclineInvitation(ctx context.Context, invitationID string) error {
	invite, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return errors.New("invitation not found")
	}

	if invite.Status != InvitationStatusPending {
		return errors.New("only pending invitations can be declined")
	}

	if time.Now().After(invite.ExpiresAt) {
		invite.Status = InvitationStatusExpired
		_ = s.repo.UpdateInvitation(ctx, invite)
		return errors.New("invitation has expired")
	}

	invite.Status = InvitationStatusDeclined
	invite.UpdatedAt = time.Now()

	if err := s.repo.UpdateInvitation(ctx, invite); err != nil {
		return err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: invite.ProjectID,
		Type:      "system",
		Action:    "invitation_declined",
		Metadata:  map[string]any{"email": invite.Email},
		CreatedAt: time.Now(),
	})

	return nil
}

func (s *Service) ListProjectActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error) {
	return s.repo.ListActivities(ctx, projectID, limit, offset)
}

func (s *Service) AddComment(ctx context.Context, comment *Comment) error {
	comment.CreatedAt = time.Now()
	comment.UpdatedAt = time.Now()
	if err := s.repo.CreateComment(ctx, comment); err != nil {
		return err
	}

	// Log activity
	_ = s.repo.CreateActivity(ctx, &ActivityLog{
		ProjectID: comment.ProjectID,
		UserID:    comment.UserID,
		Type:      "user",
		Action:    "comment_added",
		CreatedAt: time.Now(),
	})
	return nil
}

func (s *Service) CreateTask(ctx context.Context, task *Task) error {
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	if err := s.repo.CreateTask(ctx, task); err != nil {
		return err
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
	return nil
}

func (s *Service) ListMembers(ctx context.Context, projectID string) ([]ProjectMember, error) {
	return s.repo.ListMembers(ctx, projectID)
}

func (s *Service) RemoveMember(ctx context.Context, projectID, userID string) error {
	return s.repo.RemoveMember(ctx, projectID, userID)
}

func (s *Service) ListInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error) {
	return s.repo.ListInvitations(ctx, projectID)
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

func (s *Service) AddResource(ctx context.Context, resource *SharedResource) error {
	resource.CreatedAt = time.Now()
	resource.UpdatedAt = time.Now()
	if err := s.repo.CreateResource(ctx, resource); err != nil {
		return err
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
	return nil
}
