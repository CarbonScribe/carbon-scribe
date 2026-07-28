package collaboration

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	// Project Member
	AddMember(ctx context.Context, member *ProjectMember) error
	GetMember(ctx context.Context, projectID, userID string) (*ProjectMember, error)
	ListMembers(ctx context.Context, projectID string, limit, offset int) ([]EnrichedProjectMember, error)
	CountMembers(ctx context.Context, projectID string) (int64, error)
	UpdateMember(ctx context.Context, member *ProjectMember) error
	RemoveMember(ctx context.Context, projectID, userID string) error

	// Enriched member
	GetEnrichedMember(ctx context.Context, projectID, userID string) (*EnrichedProjectMember, error)

	// Invitation
	CreateInvitation(ctx context.Context, invite *ProjectInvitation) error
	GetInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error)
	GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error)
	ListInvitations(ctx context.Context, projectID string, limit, offset int) ([]ProjectInvitation, error)
	CountInvitations(ctx context.Context, projectID string) (int64, error)
	UpdateInvitation(ctx context.Context, invite *ProjectInvitation) error

	// Activity
	CreateActivity(ctx context.Context, activity *ActivityLog) error
	ListActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error)
	CountActivities(ctx context.Context, projectID string) (int64, error)

	// Comment
	CreateComment(ctx context.Context, comment *Comment) error
	ListComments(ctx context.Context, projectID string, limit, offset int) ([]Comment, error)
	CountComments(ctx context.Context, projectID string) (int64, error)

	// Task
	CreateTask(ctx context.Context, task *Task) error
	GetTask(ctx context.Context, taskID string) (*Task, error)
	ListTasks(ctx context.Context, projectID string, limit, offset int) ([]Task, error)
	CountTasks(ctx context.Context, projectID string) (int64, error)
	UpdateTask(ctx context.Context, task *Task) error

	// Resource
	CreateResource(ctx context.Context, resource *SharedResource) error
	ListResources(ctx context.Context, projectID string, limit, offset int) ([]SharedResource, error)
	CountResources(ctx context.Context, projectID string) (int64, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Project Member

func (r *repository) AddMember(ctx context.Context, member *ProjectMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *repository) GetMember(ctx context.Context, projectID, userID string) (*ProjectMember, error) {
	var member ProjectMember
	if err := r.db.WithContext(ctx).Where("project_id = ? AND user_id = ?", projectID, userID).First(&member).Error; err != nil {
		return nil, err
	}
	return &member, nil
}

// GetEnrichedMember returns a single enriched project member with profile data
func (r *repository) GetEnrichedMember(ctx context.Context, projectID, userID string) (*EnrichedProjectMember, error) {
	var member EnrichedProjectMember
	err := r.db.WithContext(ctx).Raw(`
		SELECT pm.id, pm.user_id, pm.role, pm.joined_at,
			u.full_name AS display_name, u.email, u.avatar_url, u.phone, u.location, u.title, u.bio
		FROM project_members pm
		JOIN users u ON pm.user_id = u.id
		WHERE pm.project_id = ? AND pm.user_id = ?
	`, projectID, userID).Scan(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// EnrichedProjectMember is a join struct for member + user profile
type EnrichedProjectMember struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	UserID      string    `json:"user_id"`
	Role        string    `json:"role"`
	JoinedAt    time.Time `json:"joined_at"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	AvatarURL   string    `json:"avatar_url"`
	Phone       string    `json:"phone,omitempty"`
	Location    string    `json:"location,omitempty"`
	Title       string    `json:"title,omitempty"`
	Bio         string    `json:"bio,omitempty"`
}

func (r *repository) ListMembers(ctx context.Context, projectID string, limit, offset int) ([]EnrichedProjectMember, error) {
	var members []EnrichedProjectMember
	// Custom SQL join for project_members + users with pagination
	err := r.db.WithContext(ctx).Raw(`
		 SELECT pm.id, pm.user_id, pm.role, pm.joined_at,
			 u.full_name AS display_name, u.email, u.avatar_url, u.phone, u.location, u.title, u.bio
		 FROM project_members pm
		 JOIN users u ON pm.user_id = u.id
		 WHERE pm.project_id = ?
		 ORDER BY pm.joined_at DESC
		 LIMIT ? OFFSET ?
	`, projectID, limit, offset).Scan(&members).Error
	if err != nil {
		 return nil, err
	}
	return members, nil
}

func (r *repository) CountMembers(ctx context.Context, projectID string) (int64, error) {
	var count int64
	row := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM project_members pm
		JOIN users u ON pm.user_id = u.id
		WHERE pm.project_id = ?
	`, projectID).Row()
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *repository) UpdateMember(ctx context.Context, member *ProjectMember) error {
	return r.db.WithContext(ctx).Save(member).Error
}

func (r *repository) RemoveMember(ctx context.Context, projectID, userID string) error {
	return r.db.WithContext(ctx).Where("project_id = ? AND user_id = ?", projectID, userID).Delete(&ProjectMember{}).Error
}

// Invitation

func (r *repository) CreateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	return r.db.WithContext(ctx).Create(invite).Error
}

func (r *repository) GetInvitation(ctx context.Context, invitationID string) (*ProjectInvitation, error) {
	var invite ProjectInvitation
	if err := r.db.WithContext(ctx).Where("id = ?", invitationID).First(&invite).Error; err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *repository) GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error) {
	var invite ProjectInvitation
	if err := r.db.WithContext(ctx).Where("token = ?", token).First(&invite).Error; err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *repository) ListInvitations(ctx context.Context, projectID string, limit, offset int) ([]ProjectInvitation, error) {
	var invites []ProjectInvitation
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).
		Order("created_at desc").
		Limit(limit).Offset(offset).
		Find(&invites).Error; err != nil {
		return nil, err
	}
	return invites, nil
}

func (r *repository) CountInvitations(ctx context.Context, projectID string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&ProjectInvitation{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *repository) UpdateInvitation(ctx context.Context, invite *ProjectInvitation) error {
	return r.db.WithContext(ctx).Save(invite).Error
}

// Activity

func (r *repository) CreateActivity(ctx context.Context, activity *ActivityLog) error {
	return r.db.WithContext(ctx).Create(activity).Error
}

func (r *repository) ListActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error) {
	var activities []ActivityLog
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at desc").Limit(limit).Offset(offset).Find(&activities).Error; err != nil {
		return nil, err
	}
	return activities, nil
}

func (r *repository) CountActivities(ctx context.Context, projectID string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&ActivityLog{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// Comment

func (r *repository) CreateComment(ctx context.Context, comment *Comment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *repository) ListComments(ctx context.Context, projectID string, limit, offset int) ([]Comment, error) {
	var comments []Comment
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).
		Order("created_at asc").
		Limit(limit).Offset(offset).
		Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}

func (r *repository) CountComments(ctx context.Context, projectID string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&Comment{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// Task

func (r *repository) CreateTask(ctx context.Context, task *Task) error {
	return r.db.WithContext(ctx).Create(task).Error
}

func (r *repository) GetTask(ctx context.Context, taskID string) (*Task, error) {
	var task Task
	if err := r.db.WithContext(ctx).Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *repository) ListTasks(ctx context.Context, projectID string, limit, offset int) ([]Task, error) {
	var tasks []Task
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).
		Order("created_at desc").
		Limit(limit).Offset(offset).
		Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *repository) CountTasks(ctx context.Context, projectID string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&Task{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *repository) UpdateTask(ctx context.Context, task *Task) error {
	return r.db.WithContext(ctx).Save(task).Error
}

// Resource

func (r *repository) CreateResource(ctx context.Context, resource *SharedResource) error {
	return r.db.WithContext(ctx).Create(resource).Error
}

func (r *repository) ListResources(ctx context.Context, projectID string, limit, offset int) ([]SharedResource, error) {
	var resources []SharedResource
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).
		Order("created_at desc").
		Limit(limit).Offset(offset).
		Find(&resources).Error; err != nil {
		return nil, err
	}
	return resources, nil
}

func (r *repository) CountResources(ctx context.Context, projectID string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&SharedResource{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
