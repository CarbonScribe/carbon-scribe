package collaboration

import (
	"context"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Skip repository tests on Windows due to CGO issues
func skipOnWindows(t *testing.T) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("Skipping repository tests on Windows due to CGO/SQLite dependency issues")
	}
}

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	// Auto-migrate all tables
	err = db.AutoMigrate(
		&ProjectMember{},
		&ProjectInvitation{},
		&ActivityLog{},
		&Comment{},
		&Task{},
		&SharedResource{},
		&ResourceBooking{},
	)
	require.NoError(t, err)

	return db
}

func TestRepository_AddMember_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	member := &ProjectMember{
		ProjectID:   "project-123",
		UserID:      "user-456",
		Role:        RoleContributor,
		Permissions: []string{"read", "write"},
		JoinedAt:    time.Now(),
	}

	// Act
	err := repo.AddMember(ctx, member)

	// Assert
	require.NoError(t, err)

	// Verify member was added
	var savedMember ProjectMember
	err = db.Where("project_id = ? AND user_id = ?", member.ProjectID, member.UserID).First(&savedMember).Error
	require.NoError(t, err)
	assert.Equal(t, member.ProjectID, savedMember.ProjectID)
	assert.Equal(t, member.UserID, savedMember.UserID)
	assert.Equal(t, member.Role, savedMember.Role)
	assert.Equal(t, member.Permissions, savedMember.Permissions)
}

func TestRepository_GetMember_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a member first
	member := &ProjectMember{
		ProjectID:   "project-123",
		UserID:      "user-456",
		Role:        RoleManager,
		Permissions: []string{"read", "write", "admin"},
		JoinedAt:    time.Now(),
	}
	err := db.Create(member).Error
	require.NoError(t, err)

	// Act
	found, err := repo.GetMember(ctx, "project-123", "user-456")

	// Assert
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, member.ProjectID, found.ProjectID)
	assert.Equal(t, member.UserID, found.UserID)
	assert.Equal(t, member.Role, found.Role)
	assert.Equal(t, member.Permissions, found.Permissions)
}

func TestRepository_GetMember_NotFound(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Act
	found, err := repo.GetMember(ctx, "project-123", "user-456")

	// Assert
	assert.Error(t, err)
	assert.Nil(t, found)
	assert.Equal(t, gorm.ErrRecordNotFound, err)
}

func TestRepository_ListMembers_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	projectID := "project-123"
	members := []ProjectMember{
		{ProjectID: projectID, UserID: "user-1", Role: RoleOwner, Permissions: []string{"all"}},
		{ProjectID: projectID, UserID: "user-2", Role: RoleContributor, Permissions: []string{"read", "write"}},
		{ProjectID: projectID, UserID: "user-3", Role: RoleViewer, Permissions: []string{"read"}},
	}

	for _, member := range members {
		err := db.Create(&member).Error
		require.NoError(t, err)
	}

	// Act
	found, err := repo.ListMembers(ctx, projectID)

	// Assert
	require.NoError(t, err)
	assert.Len(t, found, 3)

	// Verify all members are returned
	userIDs := make(map[string]bool)
	for _, member := range found {
		userIDs[member.UserID] = true
		assert.Equal(t, projectID, member.ProjectID)
	}
	assert.True(t, userIDs["user-1"])
	assert.True(t, userIDs["user-2"])
	assert.True(t, userIDs["user-3"])
}

func TestRepository_ListMembers_Empty(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Act
	found, err := repo.ListMembers(ctx, "project-123")

	// Assert
	require.NoError(t, err)
	assert.Empty(t, found)
}

func TestRepository_UpdateMember_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	member := &ProjectMember{
		ProjectID:   "project-123",
		UserID:      "user-456",
		Role:        RoleContributor,
		Permissions: []string{"read"},
		JoinedAt:    time.Now(),
	}
	err := db.Create(member).Error
	require.NoError(t, err)

	// Update member
	member.Role = RoleManager
	member.Permissions = []string{"read", "write", "admin"}

	// Act
	err = repo.UpdateMember(ctx, member)

	// Assert
	require.NoError(t, err)

	// Verify update
	var updatedMember ProjectMember
	err = db.Where("project_id = ? AND user_id = ?", member.ProjectID, member.UserID).First(&updatedMember).Error
	require.NoError(t, err)
	assert.Equal(t, RoleManager, updatedMember.Role)
	assert.Equal(t, []string{"read", "write", "admin"}, updatedMember.Permissions)
}

func TestRepository_RemoveMember_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	member := &ProjectMember{
		ProjectID: "project-123",
		UserID:    "user-456",
		Role:      RoleContributor,
		JoinedAt:  time.Now(),
	}
	err := db.Create(member).Error
	require.NoError(t, err)

	// Act
	err = repo.RemoveMember(ctx, "project-123", "user-456")

	// Assert
	require.NoError(t, err)

	// Verify member is soft deleted
	var found ProjectMember
	err = db.Unscoped().Where("project_id = ? AND user_id = ?", "project-123", "user-456").First(&found).Error
	require.NoError(t, err)
	assert.NotNil(t, found.DeletedAt)
}

func TestRepository_CreateInvitation_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	invitation := &ProjectInvitation{
		ProjectID: "project-123",
		Email:     "invitee@example.com",
		Role:      RoleContributor,
		Token:     "unique-token",
		Status:    "pending",
		ExpiresAt: time.Now().Add(48 * time.Hour),
	}

	// Act
	err := repo.CreateInvitation(ctx, invitation)

	// Assert
	require.NoError(t, err)

	// Verify invitation was created
	var savedInvitation ProjectInvitation
	err = db.Where("token = ?", invitation.Token).First(&savedInvitation).Error
	require.NoError(t, err)
	assert.Equal(t, invitation.ProjectID, savedInvitation.ProjectID)
	assert.Equal(t, invitation.Email, savedInvitation.Email)
	assert.Equal(t, invitation.Role, savedInvitation.Role)
	assert.Equal(t, invitation.Token, savedInvitation.Token)
	assert.Equal(t, invitation.Status, savedInvitation.Status)
}

func TestRepository_GetInvitationByToken_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	invitation := &ProjectInvitation{
		ProjectID: "project-123",
		Email:     "invitee@example.com",
		Role:      RoleContributor,
		Token:     "unique-token",
		Status:    "pending",
		ExpiresAt: time.Now().Add(48 * time.Hour),
	}
	err := db.Create(invitation).Error
	require.NoError(t, err)

	// Act
	found, err := repo.GetInvitationByToken(ctx, "unique-token")

	// Assert
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, invitation.ProjectID, found.ProjectID)
	assert.Equal(t, invitation.Email, found.Email)
	assert.Equal(t, invitation.Token, found.Token)
	assert.Equal(t, invitation.Status, found.Status)
}

func TestRepository_ListInvitations_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	projectID := "project-123"
	invitations := []ProjectInvitation{
		{ProjectID: projectID, Email: "invite1@example.com", Role: RoleContributor, Token: "token1", Status: "pending"},
		{ProjectID: projectID, Email: "invite2@example.com", Role: RoleViewer, Token: "token2", Status: "accepted"},
	}

	for _, invitation := range invitations {
		err := db.Create(&invitation).Error
		require.NoError(t, err)
	}

	// Act
	found, err := repo.ListInvitations(ctx, projectID)

	// Assert
	require.NoError(t, err)
	assert.Len(t, found, 2)

	// Verify all invitations are returned
	emails := make(map[string]bool)
	for _, invitation := range found {
		emails[invitation.Email] = true
		assert.Equal(t, projectID, invitation.ProjectID)
	}
	assert.True(t, emails["invite1@example.com"])
	assert.True(t, emails["invite2@example.com"])
}

func TestRepository_CreateActivity_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	activity := &ActivityLog{
		ProjectID: "project-123",
		UserID:    "user-456",
		Type:      "user",
		Action:    "user_invited",
		Metadata:  map[string]any{"email": "invitee@example.com"},
		CreatedAt: time.Now(),
	}

	// Act
	err := repo.CreateActivity(ctx, activity)

	// Assert
	require.NoError(t, err)

	// Verify activity was created
	var savedActivity ActivityLog
	err = db.Where("project_id = ? AND action = ?", activity.ProjectID, activity.Action).First(&savedActivity).Error
	require.NoError(t, err)
	assert.Equal(t, activity.ProjectID, savedActivity.ProjectID)
	assert.Equal(t, activity.UserID, savedActivity.UserID)
	assert.Equal(t, activity.Type, savedActivity.Type)
	assert.Equal(t, activity.Action, savedActivity.Action)
}

func TestRepository_ListActivities_Success_WithPagination(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	projectID := "project-123"
	activities := []ActivityLog{}
	for i := 0; i < 25; i++ {
		activity := ActivityLog{
			ProjectID: projectID,
			UserID:    "user-456",
			Type:      "user",
			Action:    "action_" + string(rune(i)),
			CreatedAt: time.Now().Add(time.Duration(i) * time.Hour),
		}
		activities = append(activities, activity)
	}

	for _, activity := range activities {
		err := db.Create(&activity).Error
		require.NoError(t, err)
	}

	// Act - first page
	found1, err := repo.ListActivities(ctx, projectID, 10, 0)

	// Assert first page
	require.NoError(t, err)
	assert.Len(t, found1, 10)

	// Act - second page
	found2, err := repo.ListActivities(ctx, projectID, 10, 10)

	// Assert second page
	require.NoError(t, err)
	assert.Len(t, found2, 10)

	// Act - third page (remaining)
	found3, err := repo.ListActivities(ctx, projectID, 10, 20)

	// Assert third page
	require.NoError(t, err)
	assert.Len(t, found3, 5)

	// Verify ordering (should be descending by created_at)
	allActivities := append(found1, append(found2, found3...)...)
	for i := 1; i < len(allActivities); i++ {
		assert.True(t, allActivities[i-1].CreatedAt.After(allActivities[i].CreatedAt) ||
			allActivities[i-1].CreatedAt.Equal(allActivities[i].CreatedAt))
	}
}

func TestRepository_CreateComment_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	comment := &Comment{
		ProjectID: "project-123",
		UserID:    "user-456",
		Content:   "This is a test comment",
		Mentions:  []string{"user-789"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Act
	err := repo.CreateComment(ctx, comment)

	// Assert
	require.NoError(t, err)

	// Verify comment was created
	var savedComment Comment
	err = db.Where("project_id = ? AND user_id = ?", comment.ProjectID, comment.UserID).First(&savedComment).Error
	require.NoError(t, err)
	assert.Equal(t, comment.ProjectID, savedComment.ProjectID)
	assert.Equal(t, comment.UserID, savedComment.UserID)
	assert.Equal(t, comment.Content, savedComment.Content)
	assert.Equal(t, comment.Mentions, savedComment.Mentions)
}

func TestRepository_ListComments_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	projectID := "project-123"
	comments := []Comment{
		{ProjectID: projectID, UserID: "user-1", Content: "First comment", CreatedAt: time.Now().Add(-2 * time.Hour)},
		{ProjectID: projectID, UserID: "user-2", Content: "Second comment", CreatedAt: time.Now().Add(-1 * time.Hour)},
		{ProjectID: projectID, UserID: "user-3", Content: "Third comment", CreatedAt: time.Now()},
	}

	for _, comment := range comments {
		err := db.Create(&comment).Error
		require.NoError(t, err)
	}

	// Act
	found, err := repo.ListComments(ctx, projectID)

	// Assert
	require.NoError(t, err)
	assert.Len(t, found, 3)

	// Verify ordering (should be ascending by created_at)
	for i := 1; i < len(found); i++ {
		assert.True(t, found[i-1].CreatedAt.Before(found[i].CreatedAt) ||
			found[i-1].CreatedAt.Equal(found[i].CreatedAt))
	}
}

func TestRepository_CreateTask_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	task := &Task{
		ProjectID:   "project-123",
		CreatedBy:   "user-456",
		Title:       "Test Task",
		Description: "Task description",
		Status:      "todo",
		Priority:    "medium",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Act
	err := repo.CreateTask(ctx, task)

	// Assert
	require.NoError(t, err)

	// Verify task was created
	var savedTask Task
	err = db.Where("project_id = ? AND title = ?", task.ProjectID, task.Title).First(&savedTask).Error
	require.NoError(t, err)
	assert.Equal(t, task.ProjectID, savedTask.ProjectID)
	assert.Equal(t, task.CreatedBy, savedTask.CreatedBy)
	assert.Equal(t, task.Title, savedTask.Title)
	assert.Equal(t, task.Description, savedTask.Description)
	assert.Equal(t, task.Status, savedTask.Status)
	assert.Equal(t, task.Priority, savedTask.Priority)
}

func TestRepository_GetTask_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	task := &Task{
		ProjectID: "project-123",
		CreatedBy: "user-456",
		Title:     "Test Task",
		Status:    "todo",
	}
	err := db.Create(task).Error
	require.NoError(t, err)

	// Act
	found, err := repo.GetTask(ctx, task.ID)

	// Assert
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, task.ProjectID, found.ProjectID)
	assert.Equal(t, task.CreatedBy, found.CreatedBy)
	assert.Equal(t, task.Title, found.Title)
}

func TestRepository_UpdateTask_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	task := &Task{
		ProjectID: "project-123",
		CreatedBy: "user-456",
		Title:     "Original Title",
		Status:    "todo",
	}
	err := db.Create(task).Error
	require.NoError(t, err)

	// Update task
	task.Title = "Updated Title"
	task.Status = "in_progress"

	// Act
	err = repo.UpdateTask(ctx, task)

	// Assert
	require.NoError(t, err)

	// Verify update
	var updatedTask Task
	err = db.Where("id = ?", task.ID).First(&updatedTask).Error
	require.NoError(t, err)
	assert.Equal(t, "Updated Title", updatedTask.Title)
	assert.Equal(t, "in_progress", updatedTask.Status)
}

func TestRepository_CreateResource_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	resource := &SharedResource{
		ProjectID:  "project-123",
		Type:       "document",
		Name:       "Project Specification",
		URL:        "https://example.com/spec.pdf",
		Metadata:   map[string]any{"version": "1.0", "size": "2MB"},
		UploadedBy: "user-456",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Act
	err := repo.CreateResource(ctx, resource)

	// Assert
	require.NoError(t, err)

	// Verify resource was created
	var savedResource SharedResource
	err = db.Where("project_id = ? AND name = ?", resource.ProjectID, resource.Name).First(&savedResource).Error
	require.NoError(t, err)
	assert.Equal(t, resource.ProjectID, savedResource.ProjectID)
	assert.Equal(t, resource.Type, savedResource.Type)
	assert.Equal(t, resource.Name, savedResource.Name)
	assert.Equal(t, resource.URL, savedResource.URL)
	assert.Equal(t, resource.Metadata, savedResource.Metadata)
	assert.Equal(t, resource.UploadedBy, savedResource.UploadedBy)
}

func TestRepository_ListResources_Success(t *testing.T) {
	skipOnWindows(t)
	// Arrange
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	projectID := "project-123"
	resources := []SharedResource{
		{ProjectID: projectID, Type: "document", Name: "Spec 1", UploadedBy: "user-1"},
		{ProjectID: projectID, Type: "link", Name: "External Link", UploadedBy: "user-2"},
		{ProjectID: projectID, Type: "equipment", Name: "Drone", UploadedBy: "user-3"},
	}

	for _, resource := range resources {
		err := db.Create(&resource).Error
		require.NoError(t, err)
	}

	// Act
	found, err := repo.ListResources(ctx, projectID)

	// Assert
	require.NoError(t, err)
	assert.Len(t, found, 3)

	// Verify all resources are returned
	names := make(map[string]bool)
	for _, resource := range found {
		names[resource.Name] = true
		assert.Equal(t, projectID, resource.ProjectID)
	}
	assert.True(t, names["Spec 1"])
	assert.True(t, names["External Link"])
	assert.True(t, names["Drone"])
}
