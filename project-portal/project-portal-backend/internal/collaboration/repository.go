package collaboration

import (
	"context"

	"gorm.io/gorm"
)

type Repository interface {
	// Project Member
	AddMember(ctx context.Context, member *ProjectMember) error
	GetMember(ctx context.Context, projectID, userID string) (*ProjectMember, error)
	ListMembers(ctx context.Context, projectID string) ([]ProjectMember, error)
	UpdateMember(ctx context.Context, member *ProjectMember) error
	RemoveMember(ctx context.Context, projectID, userID string) error

	// Invitation
	CreateInvitation(ctx context.Context, invite *ProjectInvitation) error
	GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error)
	ListInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error)

	// Activity
	CreateActivity(ctx context.Context, activity *ActivityLog) error
	ListActivities(ctx context.Context, projectID string, limit, offset int) ([]ActivityLog, error)

	// Comment
	CreateComment(ctx context.Context, comment *Comment) error
	ListComments(ctx context.Context, projectID string) ([]Comment, error)

	// Task
	CreateTask(ctx context.Context, task *Task) error
	GetTask(ctx context.Context, taskID string) (*Task, error)
	ListTasks(ctx context.Context, projectID string) ([]Task, error)
	UpdateTask(ctx context.Context, task *Task) error

	// Resource
	CreateResource(ctx context.Context, resource *SharedResource) error
	ListResources(ctx context.Context, projectID string) ([]SharedResource, error)
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

func (r *repository) ListMembers(ctx context.Context, projectID string) ([]ProjectMember, error) {
	var members []ProjectMember
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
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

func (r *repository) GetInvitationByToken(ctx context.Context, token string) (*ProjectInvitation, error) {
	var invite ProjectInvitation
	if err := r.db.WithContext(ctx).Where("token = ?", token).First(&invite).Error; err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *repository) ListInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error) {
	var invites []ProjectInvitation
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&invites).Error; err != nil {
		return nil, err
	}
	return invites, nil
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

// Comment

func (r *repository) CreateComment(ctx context.Context, comment *Comment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *repository) ListComments(ctx context.Context, projectID string) ([]Comment, error) {
	var comments []Comment
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at asc").Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
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

func (r *repository) ListTasks(ctx context.Context, projectID string) ([]Task, error) {
	var tasks []Task
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at desc").Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *repository) UpdateTask(ctx context.Context, task *Task) error {
	return r.db.WithContext(ctx).Save(task).Error
}

// Resource

func (r *repository) CreateResource(ctx context.Context, resource *SharedResource) error {
	return r.db.WithContext(ctx).Create(resource).Error
}

func (r *repository) ListResources(ctx context.Context, projectID string) ([]SharedResource, error) {
	var resources []SharedResource
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&resources).Error; err != nil {
		return nil, err
	}
	return resources, nil
}
