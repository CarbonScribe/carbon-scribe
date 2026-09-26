package collaboration

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

// FakeCollaborationRepo is a mock implementation of the Repository interface for testing
type FakeCollaborationRepo struct {
	mu sync.RWMutex

	CreatedInvitation *ProjectInvitation
	CreatedComment    *Comment
	CreatedTask       *Task
	CreatedResource   *SharedResource
	Activities        []ActivityLog
	ExistingTask      *Task // For UpdateTask tests
	// Additional fields for integration tests
	Invitations []ProjectInvitation
	Comments    []Comment
	Tasks       []Task
	Resources   []SharedResource
	Members     []EnrichedProjectMember // <-- add this for test control
	}

	// GetEnrichedMember returns a fake enriched member for testing
	func (f *FakeCollaborationRepo) GetEnrichedMember(ctx context.Context, projectID, userID string) (*EnrichedProjectMember, error) {
		return &EnrichedProjectMember{
			ID:        "fake-id",
			ProjectID: projectID,
			UserID:    userID,
			Role:      "owner",
			JoinedAt:  time.Now(),
			DisplayName: "Fake User",
			Email:     "fake@example.com",
			AvatarURL: "https://example.com/avatar.png",
			Phone:     "1234567890",
			Location:  "Test City",
			Title:     "Engineer",
			Bio:       "Test bio",
		}, nil
	}

func (f *FakeCollaborationRepo) AddMember(ctx context.Context, member *ProjectMember) error {
	return nil
}

func (f *FakeCollaborationRepo) GetMember(ctx context.Context, projectID, userID string) (*ProjectMember, error) {
	// For testing purposes, return a member with a role based on the userID
	// This allows us to test permission scenarios
	role := "viewer" // default
	if strings.Contains(userID, "owner") {
		role = "owner"
	} else if strings.Contains(userID, "manager") {
		role = "manager"
	} else if strings.Contains(userID, "contributor") {
		role = "contributor"
	}

	return &ProjectMember{
		ProjectID:   projectID,
		UserID:      userID,
		Role:        role,
		Permissions: []string{"read", "write"},
		JoinedAt:    time.Now(),
		UpdatedAt:   time.Now(),
	}, nil
}

func (f *FakeCollaborationRepo) ListMembers(ctx context.Context, projectID string, limit, offset int) ([]EnrichedProjectMember, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var filtered []EnrichedProjectMember
	for _, m := range f.Members {
		if m.ProjectID == projectID {
			filtered = append(filtered, m)
		}
	}

	// Sort by joined_at desc
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].JoinedAt.After(filtered[j].JoinedAt)
	})

	// Apply pagination
	if offset >= len(filtered) {
		return []EnrichedProjectMember{}, nil
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered) - offset
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], nil
}

func (f *FakeCollaborationRepo) CountMembers(ctx context.Context, projectID string) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int64
	for _, m := range f.Members {
		if m.ProjectID == projectID {
			count++
		}
	}
	return count, nil
}

func (f *FakeCollaborationRepo) UpdateMember(ctx context.Context, member *ProjectMember) error {
	return nil
}

func (f *FakeCollaborationRepo) RemoveMember(ctx context.Context, projectID, userID string) error {
	return nil
}

func (f *FakeCollaborationRepo) CreateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if invite.ID == "" {
		invite.ID = "invitation-1"
	}
	clone := *invite
	f.CreatedInvitation = &clone
	f.Invitations = append(f.Invitations, clone)
	return nil
}

func (f *FakeCollaborationRepo) GetInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, invitation := range f.Invitations {
		if invitation.ID == invitationID {
			clone := invitation
			return &clone, nil
		}
	}
	return nil, errors.New("invitation not found")
}

func (f *FakeCollaborationRepo) GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, invitation := range f.Invitations {
		if invitation.Token == token {
			clone := invitation
			return &clone, nil
		}
	}
	return nil, errors.New("invitation not found")
}

func (f *FakeCollaborationRepo) ListInvitations(ctx context.Context, projectID string, limit, offset int) ([]ProjectInvitation, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var filtered []ProjectInvitation
	for _, invitation := range f.Invitations {
		if invitation.ProjectID == projectID {
			filtered = append(filtered, invitation)
		}
	}

	// Sort by created_at desc
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	// Apply pagination
	if offset >= len(filtered) {
		return []ProjectInvitation{}, nil
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered) - offset
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], nil
}

func (f *FakeCollaborationRepo) CountInvitations(ctx context.Context, projectID string) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int64
	for _, invitation := range f.Invitations {
		if invitation.ProjectID == projectID {
			count++
		}
	}
	return count, nil
}

func (f *FakeCollaborationRepo) UpdateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for index, existing := range f.Invitations {
		if existing.ID == invite.ID {
			f.Invitations[index] = *invite
			return nil
		}
	}
	return errors.New("invitation not found")
}

func (f *FakeCollaborationRepo) CreateActivity(ctx context.Context, activity *ActivityLog) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	clone := *activity
	f.Activities = append(f.Activities, clone)
	return nil
}

func (f *FakeCollaborationRepo) ListActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	filtered := make([]ActivityLog, 0, len(f.Activities))
	for _, activity := range f.Activities {
		if activity.ProjectID == projectID {
			filtered = append(filtered, activity)
		}
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	if offset >= len(filtered) {
		return []ActivityLog{}, nil
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered) - offset
	}

	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[offset:end], nil
}

func (f *FakeCollaborationRepo) CountActivities(ctx context.Context, projectID string) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int64
	for _, activity := range f.Activities {
		if activity.ProjectID == projectID {
			count++
		}
	}
	return count, nil
}

func (f *FakeCollaborationRepo) CreateComment(ctx context.Context, comment *Comment) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if comment.ID == "" {
		comment.ID = "comment-1"
	}
	clone := *comment
	f.CreatedComment = &clone
	f.Comments = append(f.Comments, clone)
	return nil
}

func (f *FakeCollaborationRepo) ListComments(ctx context.Context, projectID string, limit, offset int) ([]Comment, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var filtered []Comment
	for _, comment := range f.Comments {
		if comment.ProjectID == projectID {
			filtered = append(filtered, comment)
		}
	}

	// Sort by created_at asc
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.Before(filtered[j].CreatedAt)
	})

	// Apply pagination
	if offset >= len(filtered) {
		return []Comment{}, nil
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered) - offset
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], nil
}

func (f *FakeCollaborationRepo) CountComments(ctx context.Context, projectID string) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int64
	for _, comment := range f.Comments {
		if comment.ProjectID == projectID {
			count++
		}
	}
	return count, nil
}

func (f *FakeCollaborationRepo) CreateTask(ctx context.Context, task *Task) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if task.ID == "" {
		if len(f.Tasks) == 0 {
			task.ID = "existing-task"
		} else {
			task.ID = "task-" + time.Now().Format("150405.000000000")
		}
	}
	clone := *task
	f.CreatedTask = &clone
	f.Tasks = append(f.Tasks, clone)
	if clone.ID == "existing-task" {
		f.ExistingTask = &clone
	}
	return nil
}

func (f *FakeCollaborationRepo) GetTask(ctx context.Context, taskID string) (*Task, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, task := range f.Tasks {
		if task.ID == taskID {
			clone := task
			return &clone, nil
		}
	}
	if taskID == "existing-task" && f.ExistingTask != nil {
		clone := *f.ExistingTask
		return &clone, nil
	}
	if taskID == "task123" {
		return &Task{
			ID:          "task123",
			ProjectID:   "p1",
			Title:       "Test Task",
			Description: "Test Description",
			Status:      "todo",
			Priority:    "medium",
			CreatedBy:   "test-user",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}, nil
	}
	return nil, errors.New("task not found")
}

func (f *FakeCollaborationRepo) ListTasks(ctx context.Context, projectID string, limit, offset int) ([]Task, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var filtered []Task
	for _, task := range f.Tasks {
		if task.ProjectID == projectID {
			filtered = append(filtered, task)
		}
	}

	// Sort by created_at desc
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	// Apply pagination
	if offset >= len(filtered) {
		return []Task{}, nil
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered) - offset
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], nil
}

func (f *FakeCollaborationRepo) CountTasks(ctx context.Context, projectID string) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int64
	for _, task := range f.Tasks {
		if task.ProjectID == projectID {
			count++
		}
	}
	return count, nil
}

func (f *FakeCollaborationRepo) UpdateTask(ctx context.Context, task *Task) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	clone := *task
	for index, existing := range f.Tasks {
		if existing.ID == task.ID {
			f.Tasks[index] = clone
			if task.ID == "existing-task" {
				f.ExistingTask = &clone
			}
			return nil
		}
	}
	if task.ID == "existing-task" {
		f.ExistingTask = &clone
	}
	return nil
}

func (f *FakeCollaborationRepo) CreateResource(ctx context.Context, resource *SharedResource) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if resource.ID == "" {
		resource.ID = "resource-1"
	}
	clone := *resource
	f.CreatedResource = &clone
	f.Resources = append(f.Resources, clone)
	return nil
}

func (f *FakeCollaborationRepo) ListResources(ctx context.Context, projectID string, limit, offset int) ([]SharedResource, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var filtered []SharedResource
	for _, resource := range f.Resources {
		if resource.ProjectID == projectID {
			filtered = append(filtered, resource)
		}
	}

	// Sort by created_at desc
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	// Apply pagination
	if offset >= len(filtered) {
		return []SharedResource{}, nil
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered) - offset
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], nil
}

func (f *FakeCollaborationRepo) CountResources(ctx context.Context, projectID string) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int64
	for _, resource := range f.Resources {
		if resource.ProjectID == projectID {
			count++
		}
	}
	return count, nil
}
