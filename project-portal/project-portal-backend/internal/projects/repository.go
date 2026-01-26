package projects

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectFilter for listing projects
type ProjectFilter struct {
	OwnerID *uuid.UUID
	Status  *string
	Offset  int
	Limit   int
}

// ProjectRepository interface for project CRUD operations
type ProjectRepository interface {
	Create(ctx context.Context, project *Project) error
	GetByID(ctx context.Context, id uuid.UUID) (*Project, error)
	Update(ctx context.Context, project *Project) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filter ProjectFilter) ([]*Project, error)
}

// StatusHistoryRepository interface
type StatusHistoryRepository interface {
	Create(ctx context.Context, history *ProjectStatusHistory) error
	ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectStatusHistory, error)
}

// TeamMemberRepository interface
type TeamMemberRepository interface {
	Create(ctx context.Context, member *ProjectTeamMember) error
	ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectTeamMember, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// ActivityRepository interface
type ActivityRepository interface {
	Create(ctx context.Context, activity *ProjectActivity) error
	ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectActivity, error)
}

// TagRepository interface
type TagRepository interface {
	Create(ctx context.Context, tag *ProjectTag) error
	ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectTag, error)
	Delete(ctx context.Context, projectID uuid.UUID, tag string) error
}

// CommentRepository interface
type CommentRepository interface {
	Create(ctx context.Context, comment *ProjectComment) error
	ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectComment, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// GORM implementations

type gormProjectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) ProjectRepository {
	return &gormProjectRepository{db: db}
}

func (r *gormProjectRepository) Create(ctx context.Context, project *Project) error {
	return r.db.WithContext(ctx).Create(project).Error
}

func (r *gormProjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*Project, error) {
	var project Project
	err := r.db.WithContext(ctx).First(&project, id).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *gormProjectRepository) Update(ctx context.Context, project *Project) error {
	return r.db.WithContext(ctx).Save(project).Error
}

func (r *gormProjectRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&Project{}, id).Error
}

func (r *gormProjectRepository) List(ctx context.Context, filter ProjectFilter) ([]*Project, error) {
	var projects []*Project
	query := r.db.WithContext(ctx)

	if filter.OwnerID != nil {
		query = query.Where("owner_id = ?", *filter.OwnerID)
	}
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}

	err := query.Offset(filter.Offset).Limit(filter.Limit).Find(&projects).Error
	return projects, err
}

type gormStatusHistoryRepository struct {
	db *gorm.DB
}

func NewStatusHistoryRepository(db *gorm.DB) StatusHistoryRepository {
	return &gormStatusHistoryRepository{db: db}
}

func (r *gormStatusHistoryRepository) Create(ctx context.Context, history *ProjectStatusHistory) error {
	return r.db.WithContext(ctx).Create(history).Error
}

func (r *gormStatusHistoryRepository) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectStatusHistory, error) {
	var histories []*ProjectStatusHistory
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("changed_at DESC").Find(&histories).Error
	return histories, err
}

type gormTeamMemberRepository struct {
	db *gorm.DB
}

func NewTeamMemberRepository(db *gorm.DB) TeamMemberRepository {
	return &gormTeamMemberRepository{db: db}
}

func (r *gormTeamMemberRepository) Create(ctx context.Context, member *ProjectTeamMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *gormTeamMemberRepository) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectTeamMember, error) {
	var members []*ProjectTeamMember
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&members).Error
	return members, err
}

func (r *gormTeamMemberRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&ProjectTeamMember{}, id).Error
}

type gormActivityRepository struct {
	db *gorm.DB
}

func NewActivityRepository(db *gorm.DB) ActivityRepository {
	return &gormActivityRepository{db: db}
}

func (r *gormActivityRepository) Create(ctx context.Context, activity *ProjectActivity) error {
	return r.db.WithContext(ctx).Create(activity).Error
}

func (r *gormActivityRepository) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectActivity, error) {
	var activities []*ProjectActivity
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").Find(&activities).Error
	return activities, err
}

type gormTagRepository struct {
	db *gorm.DB
}

func NewTagRepository(db *gorm.DB) TagRepository {
	return &gormTagRepository{db: db}
}

func (r *gormTagRepository) Create(ctx context.Context, tag *ProjectTag) error {
	return r.db.WithContext(ctx).Create(tag).Error
}

func (r *gormTagRepository) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectTag, error) {
	var tags []*ProjectTag
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&tags).Error
	return tags, err
}

func (r *gormTagRepository) Delete(ctx context.Context, projectID uuid.UUID, tag string) error {
	return r.db.WithContext(ctx).Where("project_id = ? AND tag = ?", projectID, tag).Delete(&ProjectTag{}).Error
}

type gormCommentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) CommentRepository {
	return &gormCommentRepository{db: db}
}

func (r *gormCommentRepository) Create(ctx context.Context, comment *ProjectComment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *gormCommentRepository) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]*ProjectComment, error) {
	var comments []*ProjectComment
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").Find(&comments).Error
	return comments, err
}

func (r *gormCommentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&ProjectComment{}, id).Error
}