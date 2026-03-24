package collaboration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// MockRepository for testing
type mockRepository struct {
	invitations map[string]*ProjectInvitation
	members     map[string]*ProjectMember
	activities  []ActivityLog
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		invitations: make(map[string]*ProjectInvitation),
		members:     make(map[string]*ProjectMember),
		activities:  []ActivityLog{},
	}
}

func (m *mockRepository) CreateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	m.invitations[invite.ID] = invite
	return nil
}

func (m *mockRepository) GetInvitationByID(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	if inv, ok := m.invitations[invitationID]; ok {
		return inv, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockRepository) GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error) {
	for _, inv := range m.invitations {
		if inv.Token == token {
			return inv, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockRepository) ListInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error) {
	var result []ProjectInvitation
	for _, inv := range m.invitations {
		if inv.ProjectID == projectID {
			result = append(result, *inv)
		}
	}
	return result, nil
}

func (m *mockRepository) UpdateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	m.invitations[invite.ID] = invite
	return nil
}

func (m *mockRepository) AddMember(ctx context.Context, member *ProjectMember) error {
	m.members[member.ID] = member
	return nil
}

func (m *mockRepository) GetMember(ctx context.Context, projectID, userID string) (*ProjectMember, error) {
	for _, member := range m.members {
		if member.ProjectID == projectID && member.UserID == userID {
			return member, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockRepository) ListMembers(ctx context.Context, projectID string) ([]ProjectMember, error) {
	var result []ProjectMember
	for _, member := range m.members {
		if member.ProjectID == projectID {
			result = append(result, *member)
		}
	}
	return result, nil
}

func (m *mockRepository) UpdateMember(ctx context.Context, member *ProjectMember) error {
	m.members[member.ID] = member
	return nil
}

func (m *mockRepository) RemoveMember(ctx context.Context, projectID, userID string) error {
	for id, member := range m.members {
		if member.ProjectID == projectID && member.UserID == userID {
			delete(m.members, id)
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (m *mockRepository) CreateActivity(ctx context.Context, activity *ActivityLog) error {
	m.activities = append(m.activities, *activity)
	return nil
}

func (m *mockRepository) ListActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error) {
	var result []ActivityLog
	for _, activity := range m.activities {
		if activity.ProjectID == projectID {
			result = append(result, activity)
		}
	}
	return result, nil
}

func (m *mockRepository) CreateComment(ctx context.Context, comment *Comment) error {
	return nil
}

func (m *mockRepository) ListComments(ctx context.Context, projectID string) ([]Comment, error) {
	return []Comment{}, nil
}

func (m *mockRepository) CreateTask(ctx context.Context, task *Task) error {
	return nil
}

func (m *mockRepository) GetTask(ctx context.Context, taskID string) (*Task, error) {
	return nil, gorm.ErrRecordNotFound
}

func (m *mockRepository) ListTasks(ctx context.Context, projectID string) ([]Task, error) {
	return []Task{}, nil
}

func (m *mockRepository) UpdateTask(ctx context.Context, task *Task) error {
	return nil
}

func (m *mockRepository) CreateResource(ctx context.Context, resource *SharedResource) error {
	return nil
}

func (m *mockRepository) ListResources(ctx context.Context, projectID string) ([]SharedResource, error) {
	return []SharedResource{}, nil
}

// Tests
func TestResendInvitation(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create initial invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)
	assert.Equal(t, InvitationStatusPending, invite.Status)
	assert.Equal(t, 0, invite.ResentCount)

	// Resend invitation
	resent, err := service.ResendInvitation(ctx, invite.ID)
	require.NoError(t, err)
	assert.Equal(t, InvitationStatusPending, resent.Status)
	assert.Equal(t, 1, resent.ResentCount)
	assert.NotNil(t, resent.ResentAt)

	// Verify resend count increments
	resent2, err := service.ResendInvitation(ctx, invite.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, resent2.ResentCount)
}

func TestCancelInvitation(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)

	// Cancel invitation
	err = service.CancelInvitation(ctx, invite.ID)
	require.NoError(t, err)

	// Verify status changed
	cancelled, err := repo.GetInvitationByID(ctx, invite.ID)
	require.NoError(t, err)
	assert.Equal(t, InvitationStatusCancelled, cancelled.Status)
}

func TestAcceptInvitation(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)

	// Accept invitation
	member, err := service.AcceptInvitation(ctx, invite.ID)
	require.NoError(t, err)
	assert.NotNil(t, member)
	assert.Equal(t, "project-1", member.ProjectID)
	assert.Equal(t, RoleContributor, member.Role)

	// Verify invitation status changed
	accepted, err := repo.GetInvitationByID(ctx, invite.ID)
	require.NoError(t, err)
	assert.Equal(t, InvitationStatusAccepted, accepted.Status)
}

func TestDeclineInvitation(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)

	// Decline invitation
	err = service.DeclineInvitation(ctx, invite.ID)
	require.NoError(t, err)

	// Verify status changed
	declined, err := repo.GetInvitationByID(ctx, invite.ID)
	require.NoError(t, err)
	assert.Equal(t, InvitationStatusDeclined, declined.Status)
}

func TestInvitationExpiry(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)

	// Manually expire the invitation
	invite.ExpiresAt = time.Now().Add(-1 * time.Hour)
	repo.UpdateInvitation(ctx, invite)

	// Try to accept expired invitation
	_, err = service.AcceptInvitation(ctx, invite.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expired")

	// Verify status is marked as expired
	expired, _ := repo.GetInvitationByID(ctx, invite.ID)
	assert.Equal(t, InvitationStatusExpired, expired.Status)
}

func TestMaxResendLimit(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)

	// Resend max times
	for i := 0; i < MaxInvitationResends; i++ {
		_, err := service.ResendInvitation(ctx, invite.ID)
		require.NoError(t, err)
	}

	// Try to resend beyond limit
	_, err = service.ResendInvitation(ctx, invite.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "maximum resend limit")
}

func TestInvitationStateTransitions(t *testing.T) {
	repo := newMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	// Create invitation
	invite, err := service.InviteUser(ctx, "project-1", "user@example.com", RoleContributor)
	require.NoError(t, err)
	assert.Equal(t, InvitationStatusPending, invite.Status)

	// Try to accept non-pending invitation (after declining)
	err = service.DeclineInvitation(ctx, invite.ID)
	require.NoError(t, err)

	// Try to accept declined invitation
	_, err = service.AcceptInvitation(ctx, invite.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "only pending invitations can be accepted")
}
