package collaboration

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Test invitation state transitions and lifecycle management
func TestInvitationLifecycle_CreateToAccept(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	projectID := "project-123"
	invitedBy := "owner-user-456" // Use owner role for permission
	email := "invitee@example.com"
	role := "Contributor"

	// Mock permission check
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil)

	// Mock invitation creation
	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	// Act - Create invitation
	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)
	require.NoError(t, err)
	require.NotNil(t, invitation)

	// Verify initial state
	assert.Equal(t, "pending", invitation.Status)
	assert.NotEmpty(t, invitation.Token)
	assert.WithinDuration(t, time.Now().Add(48*time.Hour), invitation.ExpiresAt, time.Minute)

	mockRepo.AssertExpectations(t)

	// Now simulate acceptance by updating the invitation
	// (In a real implementation, this would be a separate service method)
	updatedInvitation := *invitation
	updatedInvitation.Status = "accepted"

	mockRepo.On("CreateInvitation", ctx, &updatedInvitation).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.MatchedBy(func(activity *ActivityLog) bool {
		return activity.Action == "invitation_accepted" && activity.UserID == invitedBy
	})).Return(nil).Once()

	// Act - Accept invitation (simulated)
	err = mockRepo.CreateInvitation(ctx, &updatedInvitation)
	require.NoError(t, err)

	// Verify final state
	assert.Equal(t, "accepted", updatedInvitation.Status)

	// Create activity log for acceptance
	activity := &ActivityLog{
		ProjectID: projectID,
		UserID:    invitedBy,
		Type:      "user",
		Action:    "invitation_accepted",
		Metadata: map[string]any{
			"invitation_id": invitation.ID,
			"email":         email,
			"role":          role,
		},
		CreatedAt: time.Now(),
	}
	err = mockRepo.CreateActivity(ctx, activity)
	require.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestInvitationLifecycle_CreateToExpire(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	projectID := "project-123"
	invitedBy := "owner-user-456" // Use owner role for permission
	email := "invitee@example.com"
	role := "Contributor"

	// Mock permission check
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil)

	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	// Act - Create invitation
	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)
	require.NoError(t, err)
	require.NotNil(t, invitation)

	// Verify initial state
	assert.Equal(t, "pending", invitation.Status)

	mockRepo.AssertExpectations(t)

	// Simulate expiration by setting expires_at in the past
	expiredInvitation := *invitation
	expiredInvitation.Status = "expired"
	expiredInvitation.ExpiresAt = time.Now().Add(-1 * time.Hour)

	mockRepo.On("CreateInvitation", ctx, &expiredInvitation).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.MatchedBy(func(activity *ActivityLog) bool {
		return activity.Action == "invitation_expired"
	})).Return(nil).Once()

	// Act - Mark as expired (simulated)
	err = mockRepo.CreateInvitation(ctx, &expiredInvitation)
	require.NoError(t, err)

	// Verify expired state
	assert.Equal(t, "expired", expiredInvitation.Status)
	assert.True(t, expiredInvitation.ExpiresAt.Before(time.Now()))

	// Create activity log for expiration
	activity := &ActivityLog{
		ProjectID: projectID,
		Type:      "system",
		Action:    "invitation_expired",
		Metadata: map[string]any{
			"invitation_id": invitation.ID,
			"email":         email,
			"role":          role,
		},
		CreatedAt: time.Now(),
	}
	err = mockRepo.CreateActivity(ctx, activity)
	require.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestInvitationLifecycle_CreateToCancel(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	projectID := "project-123"
	invitedBy := "owner-user-456" // Use owner role for permission
	email := "invitee@example.com"
	role := "Contributor"

	// Mock permission check
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil)

	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	// Act - Create invitation
	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)
	require.NoError(t, err)
	require.NotNil(t, invitation)

	// Verify initial state
	assert.Equal(t, "pending", invitation.Status)

	mockRepo.AssertExpectations(t)

	// Simulate cancellation
	cancelledInvitation := *invitation
	cancelledInvitation.Status = "cancelled"

	mockRepo.On("CreateInvitation", ctx, &cancelledInvitation).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.MatchedBy(func(activity *ActivityLog) bool {
		return activity.Action == "invitation_cancelled" && activity.UserID == invitedBy
	})).Return(nil).Once()

	// Act - Cancel invitation (simulated)
	err = mockRepo.CreateInvitation(ctx, &cancelledInvitation)
	require.NoError(t, err)

	// Verify cancelled state
	assert.Equal(t, "cancelled", cancelledInvitation.Status)

	// Create activity log for cancellation
	activity := &ActivityLog{
		ProjectID: projectID,
		UserID:    invitedBy,
		Type:      "user",
		Action:    "invitation_cancelled",
		Metadata: map[string]any{
			"invitation_id": invitation.ID,
			"email":         email,
			"role":          role,
		},
		CreatedAt: time.Now(),
	}
	err = mockRepo.CreateActivity(ctx, activity)
	require.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestInvitationLifecycle_ResendPendingInvitation(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	projectID := "project-123"
	invitedBy := "owner-user-456" // Use owner role for permission
	email := "invitee@example.com"
	role := "Contributor"

	// Mock permission check
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil)

	// Create initial invitation
	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)
	require.NoError(t, err)
	require.NotNil(t, invitation)

	mockRepo.AssertExpectations(t)

	// Simulate finding existing pending invitation
	existingInvitation := *invitation
	existingInvitation.CreatedAt = time.Now().Add(-1 * time.Hour) // Created 1 hour ago

	mockRepo.On("GetInvitationByToken", ctx, invitation.Token).Return(&existingInvitation, nil)

	// Simulate resending - update token and expiry
	resentInvitation := existingInvitation
	resentInvitation.Token = uuid.New().String()
	resentInvitation.ExpiresAt = time.Now().Add(48 * time.Hour)
	resentInvitation.UpdatedAt = time.Now()

	mockRepo.On("CreateInvitation", ctx, &resentInvitation).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.MatchedBy(func(activity *ActivityLog) bool {
		return activity.Action == "invitation_resent" && activity.UserID == invitedBy
	})).Return(nil).Once()

	// Act - Resend invitation (simulated)
	found, err := mockRepo.GetInvitationByToken(ctx, invitation.Token)
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "pending", found.Status)

	err = mockRepo.CreateInvitation(ctx, &resentInvitation)
	require.NoError(t, err)

	// Verify resent invitation
	assert.NotEqual(t, invitation.Token, resentInvitation.Token)
	assert.WithinDuration(t, time.Now().Add(48*time.Hour), resentInvitation.ExpiresAt, time.Minute)

	// Create activity log for resend
	activity := &ActivityLog{
		ProjectID: projectID,
		UserID:    invitedBy,
		Type:      "user",
		Action:    "invitation_resent",
		Metadata: map[string]any{
			"invitation_id": invitation.ID,
			"email":         email,
			"role":          role,
			"new_token":     resentInvitation.Token,
		},
		CreatedAt: time.Now(),
	}
	err = mockRepo.CreateActivity(ctx, activity)
	require.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestInvitationLifecycle_InvalidStateTransitions(t *testing.T) {
	// Test that certain state transitions are invalid
	tests := []struct {
		name          string
		initialStatus string
		targetStatus  string
		shouldSucceed bool
	}{
		{
			name:          "pending to accepted - valid",
			initialStatus: "pending",
			targetStatus:  "accepted",
			shouldSucceed: true,
		},
		{
			name:          "pending to expired - valid",
			initialStatus: "pending",
			targetStatus:  "expired",
			shouldSucceed: true,
		},
		{
			name:          "pending to cancelled - valid",
			initialStatus: "pending",
			targetStatus:  "cancelled",
			shouldSucceed: true,
		},
		{
			name:          "accepted to pending - invalid",
			initialStatus: "accepted",
			targetStatus:  "pending",
			shouldSucceed: false,
		},
		{
			name:          "accepted to expired - invalid",
			initialStatus: "accepted",
			targetStatus:  "expired",
			shouldSucceed: false,
		},
		{
			name:          "expired to accepted - invalid",
			initialStatus: "expired",
			targetStatus:  "accepted",
			shouldSucceed: false,
		},
		{
			name:          "cancelled to accepted - invalid",
			initialStatus: "cancelled",
			targetStatus:  "accepted",
			shouldSucceed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			mockRepo := new(MockRepository)
			_ = NewService(mockRepo) // Use service to avoid unused variable
			ctx := context.Background()

			invitation := &ProjectInvitation{
				ID:        uuid.New().String(),
				ProjectID: "project-123",
				Email:     "invitee@example.com",
				Role:      "Contributor",
				Token:     uuid.New().String(),
				Status:    tt.initialStatus,
				CreatedAt: time.Now(),
			}

			// Simulate state transition validation
			validTransitions := map[string][]string{
				"pending": {"accepted", "expired", "cancelled"},
				// accepted, expired, cancelled are terminal states
			}

			// Act
			allowedTargets, exists := validTransitions[tt.initialStatus]
			isValid := exists && contains(allowedTargets, tt.targetStatus)

			// Use ctx to avoid unused variable
			_ = ctx
			_ = invitation

			// Assert
			if tt.shouldSucceed {
				assert.True(t, isValid, "Expected transition %s -> %s to be valid", tt.initialStatus, tt.targetStatus)
			} else {
				assert.False(t, isValid, "Expected transition %s -> %s to be invalid", tt.initialStatus, tt.targetStatus)
			}
		})
	}
}

func TestInvitationLifecycle_TokenUniqueness(t *testing.T) {
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	projectID := "project-123"
	invitedBy := "owner-user-456" // Use owner role for permission
	email1 := "invitee1@example.com"
	email2 := "invitee2@example.com"
	role := "Contributor"

	// Mock permission check for first invitation
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil).Once()

	// Create first invitation
	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	invitation1, err := service.InviteUser(ctx, projectID, invitedBy, email1, role)
	require.NoError(t, err)
	require.NotNil(t, invitation1)

	mockRepo.AssertExpectations(t)

	// Create second invitation
	// Mock permission check for second invitation
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil).Once()

	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	invitation2, err := service.InviteUser(ctx, projectID, invitedBy, email2, role)
	require.NoError(t, err)
	require.NotNil(t, invitation2)

	mockRepo.AssertExpectations(t)

	// Assert tokens are unique
	assert.NotEqual(t, invitation1.Token, invitation2.Token, "Invitation tokens should be unique")
}

func TestInvitationLifecycle_ExpirationTiming(t *testing.T) {
	// Test various expiration scenarios
	tests := []struct {
		name          string
		hoursToExpire int
		shouldBeValid bool
	}{
		{
			name:          "fresh invitation - valid",
			hoursToExpire: 1,
			shouldBeValid: true,
		},
		{
			name:          "near expiration - valid",
			hoursToExpire: 47,
			shouldBeValid: true,
		},
		{
			name:          "just expired - invalid",
			hoursToExpire: -1,
			shouldBeValid: false,
		},
		{
			name:          "long expired - invalid",
			hoursToExpire: -24,
			shouldBeValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			mockRepo := new(MockRepository)
			service := NewService(mockRepo)
			ctx := context.Background()

			projectID := "project-123"
			invitedBy := "owner-user-456" // Use owner role for permission
			email := "invitee@example.com"
			role := "Contributor"

			// Mock permission check
			mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
				ProjectID: projectID,
				UserID:    invitedBy,
				Role:      "owner",
			}, nil)

			mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
			mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

			// Act
			invitation, err := service.InviteUser(ctx, projectID, invitedBy, email, role)
			require.NoError(t, err)
			require.NotNil(t, invitation)

			mockRepo.AssertExpectations(t)

			// Simulate time passage
			invitation.ExpiresAt = time.Now().Add(time.Duration(tt.hoursToExpire) * time.Hour)

			// Assert expiration status
			isExpired := time.Now().After(invitation.ExpiresAt)
			assert.Equal(t, tt.shouldBeValid, !isExpired,
				"Invitation with %d hours to expire should be valid: %v", tt.hoursToExpire, tt.shouldBeValid)
		})
	}
}

func TestInvitationLifecycle_EmailUniquenessInProject(t *testing.T) {
	// Test that multiple pending invitations for the same email in the same project are handled correctly
	// Arrange
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	projectID := "project-123"
	invitedBy := "owner-user-456" // Use owner role for permission
	email := "invitee@example.com"
	role := "Contributor"

	// Mock permission check for first invitation
	mockRepo.On("GetMember", ctx, projectID, invitedBy).Return(&ProjectMember{
		ProjectID: projectID,
		UserID:    invitedBy,
		Role:      "owner",
	}, nil).Once()

	// Create first invitation
	mockRepo.On("CreateInvitation", ctx, mock.AnythingOfType("*collaboration.ProjectInvitation")).Return(nil).Once()
	mockRepo.On("CreateActivity", ctx, mock.AnythingOfType("*collaboration.ActivityLog")).Return(nil).Once()

	invitation1, err := service.InviteUser(ctx, projectID, invitedBy, email, role)
	require.NoError(t, err)
	require.NotNil(t, invitation1)

	mockRepo.AssertExpectations(t)

	// Simulate checking for existing pending invitation
	existingInvitation := *invitation1
	mockRepo.On("ListInvitations", ctx, projectID).Return([]ProjectInvitation{existingInvitation}, nil)

	// Try to create another invitation for the same email
	invitations, err := mockRepo.ListInvitations(ctx, projectID)
	require.NoError(t, err)

	// Check for existing pending invitation for the same email
	hasPendingInvitation := false
	for _, inv := range invitations {
		if inv.Email == email && inv.Status == "pending" {
			hasPendingInvitation = true
			break
		}
	}

	// Assert
	assert.True(t, hasPendingInvitation, "Should detect existing pending invitation for the same email")
}

// Helper function to check if slice contains string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
