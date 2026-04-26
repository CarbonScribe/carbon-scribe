// ...existing code...
package collaboration

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/collaboration/dto"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRepository implements a mock for the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) GetEnrichedMember(ctx context.Context, projectID, userID string) (*EnrichedProjectMember, error) {
	args := m.Called(ctx, projectID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*EnrichedProjectMember), args.Error(1)
}

func (m *MockRepository) AddMember(ctx context.Context, member *ProjectMember) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockRepository) GetMember(ctx context.Context, projectID, userID string) (*ProjectMember, error) {
	args := m.Called(ctx, projectID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ProjectMember), args.Error(1)
}

func (m *MockRepository) ListMembers(ctx context.Context, projectID string) ([]EnrichedProjectMember, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]EnrichedProjectMember), args.Error(1)
}

func (m *MockRepository) UpdateMember(ctx context.Context, member *ProjectMember) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockRepository) RemoveMember(ctx context.Context, projectID, userID string) error {
	args := m.Called(ctx, projectID, userID)
	return args.Error(0)
}

func (m *MockRepository) CreateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	args := m.Called(ctx, invite)
	return args.Error(0)
}

func (m *MockRepository) GetInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	args := m.Called(ctx, invitationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ProjectInvitation), args.Error(1)
}

func (m *MockRepository) GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ProjectInvitation), args.Error(1)
}

func (m *MockRepository) ListInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ProjectInvitation), args.Error(1)
}

func (m *MockRepository) UpdateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	args := m.Called(ctx, invite)
	return args.Error(0)
}

func (m *MockRepository) CreateActivity(ctx context.Context, activity *ActivityLog) error {
	args := m.Called(ctx, activity)
	return args.Error(0)
}

func (m *MockRepository) ListActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error) {
	args := m.Called(ctx, projectID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ActivityLog), args.Error(1)
}

func (m *MockRepository) CreateComment(ctx context.Context, comment *Comment) error {
	args := m.Called(ctx, comment)
	return args.Error(0)
}

func (m *MockRepository) ListComments(ctx context.Context, projectID string) ([]Comment, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]Comment), args.Error(1)
}

func (m *MockRepository) CreateTask(ctx context.Context, task *Task) error {
	args := m.Called(ctx, task)
	return args.Error(0)
}

func (m *MockRepository) GetTask(ctx context.Context, taskID string) (*Task, error) {
	args := m.Called(ctx, taskID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Task), args.Error(1)
}

func (m *MockRepository) ListTasks(ctx context.Context, projectID string) ([]Task, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]Task), args.Error(1)
}

func (m *MockRepository) UpdateTask(ctx context.Context, task *Task) error {
	args := m.Called(ctx, task)
	return args.Error(0)
}

func (m *MockRepository) CreateResource(ctx context.Context, resource *SharedResource) error {
	args := m.Called(ctx, resource)
	return args.Error(0)
}

func (m *MockRepository) ListResources(ctx context.Context, projectID string) ([]SharedResource, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]SharedResource), args.Error(1)
}

func TestCollaborationService_InviteUser_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	invitedBy := "owner-user"
	email := "invitee@example.com"
	role := "Contributor"

	// Mock the permission check
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil)

	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil)
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil)

	// Act
	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)

	// Assert
	require.NoError(t, err)
	require.NotNil(t, invitation)
	assert.Equal(t, projectID, invitation.ProjectID)
	assert.Equal(t, email, invitation.Email)
	assert.Equal(t, role, invitation.Role)
	assert.Equal(t, "pending", invitation.Status)
	assert.NotEmpty(t, invitation.Token)
	assert.WithinDuration(t, time.Now().Add(48*time.Hour), invitation.ExpiresAt, time.Minute)
	assert.WithinDuration(t, time.Now(), invitation.CreatedAt, time.Minute)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_InviteUser_RepositoryError(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	invitedBy := "owner-user"
	email := "invitee@example.com"
	role := "Contributor"

	// Mock the permission check
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil)

	expectedErr := errors.New("database error")
	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(expectedErr)

	// Act
	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.Nil(t, invitation)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_InviteUser_PermissionDenied(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	invitedBy := "contributor-user"
	email := "invitee@example.com"
	role := "Contributor"

	// Mock the permission check - contributor role
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "contributor",
	}, nil)

	// Act
	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, "insufficient permissions", err.Error())
	assert.Nil(t, invitation)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_AddComment_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	actorUserID := "user-123"
	req := CreateCommentRequest{
		ProjectID: "project-456",
		Content:   "This is a comment",
		Mentions:  []string{"user-789"},
	}

	mockRepo.On("CreateComment", ctx, mock.AnythingOfType("*collaboration.Comment")).Return(nil)
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil)

	// Act
	comment, err := service.AddComment(ctx, req, actorUserID)

	// Assert
	require.NoError(t, err)
	require.NotNil(t, comment)
	assert.Equal(t, req.ProjectID, comment.ProjectID)
	assert.Equal(t, actorUserID, comment.UserID)
	assert.Equal(t, req.Content, comment.Content)
	assert.Equal(t, req.Mentions, comment.Mentions)
	assert.WithinDuration(t, time.Now(), comment.CreatedAt, time.Minute)
	assert.WithinDuration(t, time.Now(), comment.UpdatedAt, time.Minute)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_AddComment_RepositoryError(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	actorUserID := "user-123"
	req := CreateCommentRequest{
		ProjectID: "project-456",
		Content:   "This is a comment",
	}

	expectedErr := errors.New("database error")
	mockRepo.On("CreateComment", ctx, mock.AnythingOfType("*collaboration.Comment")).Return(expectedErr)

	// Act
	comment, err := service.AddComment(ctx, req, actorUserID)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.Nil(t, comment)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_CreateTask_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	actorUserID := "user-123"
	req := CreateTaskRequest{
		ProjectID:   "project-456",
		Title:       "Test Task",
		Description: "Task description",
		Priority:    "high",
	}

	mockRepo.On("CreateTask", ctx, mock.AnythingOfType("*collaboration.Task")).Return(nil)
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil)

	// Act
	task, err := service.CreateTask(ctx, req, actorUserID)

	// Assert
	require.NoError(t, err)
	require.NotNil(t, task)
	assert.Equal(t, req.ProjectID, task.ProjectID)
	assert.Equal(t, actorUserID, task.CreatedBy)
	assert.Equal(t, req.Title, task.Title)
	assert.Equal(t, req.Description, task.Description)
	assert.Equal(t, req.Priority, task.Priority)
	assert.WithinDuration(t, time.Now(), task.CreatedAt, time.Minute)
	assert.WithinDuration(t, time.Now(), task.UpdatedAt, time.Minute)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_CreateTask_RepositoryError(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	actorUserID := "user-123"
	req := CreateTaskRequest{
		ProjectID: "project-456",
		Title:     "Test Task",
	}

	expectedErr := errors.New("database error")
	mockRepo.On("CreateTask", ctx, mock.AnythingOfType("*collaboration.Task")).Return(expectedErr)

	// Act
	task, err := service.CreateTask(ctx, req, actorUserID)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.Nil(t, task)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_ListMembers_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"

	       expectedMembers := []EnrichedProjectMember{
		       {ID: "1", ProjectID: projectID, UserID: "user-1", Role: "Owner"},
		       {ID: "2", ProjectID: projectID, UserID: "user-2", Role: "Contributor"},
	       }

	       mockRepo.On("ListMembers", ctx, projectID).Return(expectedMembers, nil)

	       // Act
	       members, err := service.ListMembers(ctx, projectID)

	       // Assert
	       require.NoError(t, err)
	       // The service.ListMembers returns []dto.EnrichedProjectMemberResponse, so map expectedMembers for comparison
	       var expectedResp []dto.EnrichedProjectMemberResponse
	       for _, m := range expectedMembers {
		       expectedResp = append(expectedResp, dto.EnrichedProjectMemberResponse{
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
	       assert.Equal(t, expectedResp, members)

	       mockRepo.AssertExpectations(t)
}

func TestCollaborationService_ListMembers_RepositoryError(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"

	expectedErr := errors.New("database error")
	mockRepo.On("ListMembers", ctx, projectID).Return(nil, expectedErr)

	// Act
	members, err := service.ListMembers(ctx, projectID)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.Nil(t, members)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_RemoveMember_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	requestingUserID := "owner-user"
	targetUserID := "user-456"

	// Mock the permission check
	mockRepo.On("GetMember", ctx, projectID, requestingUserID).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    requestingUserID,
		Role:      "owner",
	}, nil)

	mockRepo.On("RemoveMember", ctx, projectID, targetUserID).Return(nil)

	// Act
	err := service.RemoveMember(ctx, projectID, requestingUserID, targetUserID)

	// Assert
	require.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_RemoveMember_RepositoryError(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	requestingUserID := "owner-user"
	targetUserID := "user-456"

	// Mock the permission check
	mockRepo.On("GetMember", ctx, projectID, requestingUserID).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    requestingUserID,
		Role:      "owner",
	}, nil)

	expectedErr := errors.New("database error")
	mockRepo.On("RemoveMember", ctx, projectID, targetUserID).Return(expectedErr)

	// Act
	err := service.RemoveMember(ctx, projectID, requestingUserID, targetUserID)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_RemoveMember_PermissionDenied(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	requestingUserID := "contributor-user"
	targetUserID := "user-456"

	// Mock the permission check - contributor role
	mockRepo.On("GetMember", ctx, projectID, requestingUserID).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    requestingUserID,
		Role:      "contributor",
	}, nil)

	// Act
	err := service.RemoveMember(ctx, projectID, requestingUserID, targetUserID)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, "insufficient permissions", err.Error())

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_ListInvitations_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"

	expectedInvitations := []ProjectInvitation{
		{ID: "1", ProjectID: projectID, Email: "test1@example.com", Role: "Contributor"},
		{ID: "2", ProjectID: projectID, Email: "test2@example.com", Role: "Viewer"},
	}

	mockRepo.On("ListInvitations", ctx, projectID).Return(expectedInvitations, nil)

	// Act
	invitations, err := service.ListInvitations(ctx, projectID)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, expectedInvitations, invitations)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_ListProjectActivities_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	projectID := "project-123"
	limit := 10
	offset := 5

	expectedActivities := []ActivityLog{
		{ID: "1", ProjectID: projectID, Action: "user_invited"},
		{ID: "2", ProjectID: projectID, Action: "comment_added"},
	}

	mockRepo.On("ListActivities", ctx, projectID, limit, offset).Return(expectedActivities, nil)

	// Act
	activities, err := service.ListProjectActivities(ctx, projectID, limit, offset)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, expectedActivities, activities)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_UpdateTask_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	task := &Task{
		ID:          "task-123",
		ProjectID:   "project-456",
		Title:       "Updated Title",
		Description: "Updated description",
		Status:      "in_progress",
	}

	mockRepo.On("UpdateTask", ctx, task).Return(nil)

	// Act
	err := service.UpdateTask(ctx, task)

	// Assert
	require.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_UpdateTask_RepositoryError(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	task := &Task{
		ID:        "task-123",
		ProjectID: "project-456",
		Title:     "Updated Title",
	}

	expectedErr := errors.New("database error")
	mockRepo.On("UpdateTask", ctx, task).Return(expectedErr)

	// Act
	err := service.UpdateTask(ctx, task)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_AddResource_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	actorUserID := "user-123"
	req := CreateResourceRequest{
		ProjectID: "project-456",
		Type:      "document",
		Name:      "Project Spec",
		URL:       "https://example.com/spec",
		Metadata:  map[string]any{"version": "1.0"},
	}

	mockRepo.On("CreateResource", ctx, mock.AnythingOfType("*collaboration.SharedResource")).Return(nil)
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil)

	// Act
	resource, err := service.AddResource(ctx, req, actorUserID)

	// Assert
	require.NoError(t, err)
	require.NotNil(t, resource)
	assert.Equal(t, req.ProjectID, resource.ProjectID)
	assert.Equal(t, req.Type, resource.Type)
	assert.Equal(t, req.Name, resource.Name)
	assert.Equal(t, req.URL, resource.URL)
	assert.Equal(t, req.Metadata, resource.Metadata)
	assert.Equal(t, actorUserID, resource.UploadedBy)
	assert.WithinDuration(t, time.Now(), resource.CreatedAt, time.Minute)
	assert.WithinDuration(t, time.Now(), resource.UpdatedAt, time.Minute)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_GetTask_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	taskID := "task-123"

	expectedTask := &Task{
		ID:        taskID,
		ProjectID: "project-456",
		Title:     "Test Task",
	}

	mockRepo.On("GetTask", ctx, taskID).Return(expectedTask, nil)

	// Act
	task, err := service.GetTask(ctx, taskID)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, expectedTask, task)

	mockRepo.AssertExpectations(t)
}

func TestCollaborationService_GetTask_NotFound(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()
	taskID := "non-existent-task"

	expectedErr := errors.New("task not found")
	mockRepo.On("GetTask", ctx, taskID).Return(nil, expectedErr)

	// Act
	task, err := service.GetTask(ctx, taskID)

	// Assert
	assert.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.Nil(t, task)

	mockRepo.AssertExpectations(t)
}
