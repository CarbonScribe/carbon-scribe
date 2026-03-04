package collaboration

import (
	"context"
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
		Type:      "system",
		Action:    "user_invited",
		Metadata:  map[string]any{"email": email, "role": role},
		CreatedAt: time.Now(),
	})

	return invite, nil
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
