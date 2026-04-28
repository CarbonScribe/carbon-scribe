package inventory

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository defines the interface for inventory data persistence
type Repository interface {
	UpsertCreditCache(ctx context.Context, cache *ProjectCreditCache) error
	BulkUpsertCreditCache(ctx context.Context, caches []ProjectCreditCache) error
	GetCreditByTokenID(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*ProjectCreditCache, error)
	ListCreditsByProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error)
	ListCreditsByStatus(ctx context.Context, projectID uuid.UUID, status AssetStatus, limit, offset int) ([]ProjectCreditCache, int64, error)
	ListActiveCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error)
	ListRetiredCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error)
	GetInventorySummary(ctx context.Context, projectID uuid.UUID) (*InventorySummary, error)
	GetLastSyncTime(ctx context.Context, projectID uuid.UUID) (time.Time, error)
	DeleteProjectCache(ctx context.Context, projectID uuid.UUID) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new inventory repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) UpsertCreditCache(ctx context.Context, cache *ProjectCreditCache) error {
	cache.LastSynced = time.Now().UTC()
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "project_id"}, {Name: "token_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"owner_address", "status", "vintage_year", "methodology_id", "quality_score", "is_burned", "last_synced", "updated_at"}),
		}).
		Create(cache).Error
}

func (r *repository) BulkUpsertCreditCache(ctx context.Context, caches []ProjectCreditCache) error {
	if len(caches) == 0 {
		return nil
	}
	now := time.Now().UTC()
	for i := range caches {
		caches[i].LastSynced = now
	}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "project_id"}, {Name: "token_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"owner_address", "status", "vintage_year", "methodology_id", "quality_score", "is_burned", "last_synced", "updated_at"}),
		}).
		CreateInBatches(caches, 100).Error
}

func (r *repository) GetCreditByTokenID(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*ProjectCreditCache, error) {
	var cache ProjectCreditCache
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND token_id = ?", projectID, tokenID).
		First(&cache).Error
	if err != nil {
		return nil, err
	}
	return &cache, nil
}

func (r *repository) ListCreditsByProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ?", projectID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) ListCreditsByStatus(ctx context.Context, projectID uuid.UUID, status AssetStatus, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status = ? AND is_burned = FALSE", projectID, status).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND status = ? AND is_burned = FALSE", projectID, status).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) ListActiveCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64

	activeStatuses := []AssetStatus{StatusIssued, StatusListed}

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status IN ? AND is_burned = FALSE", projectID, activeStatuses).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND status IN ? AND is_burned = FALSE", projectID, activeStatuses).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) ListRetiredCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND (status = ? OR is_burned = TRUE)", projectID, StatusRetired).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND (status = ? OR is_burned = TRUE)", projectID, StatusRetired).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) GetInventorySummary(ctx context.Context, projectID uuid.UUID) (*InventorySummary, error) {
	summary := &InventorySummary{
		ProjectID: projectID,
	}

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND is_burned = FALSE", projectID).
		Count(&summary.TotalCredits).Error; err != nil {
		return nil, err
	}

	activeStatuses := []AssetStatus{StatusIssued, StatusListed}
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status IN ? AND is_burned = FALSE", projectID, activeStatuses).
		Count(&summary.ActiveCredits).Error; err != nil {
		return nil, err
	}

	var retiredCount int64
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND (status = ? OR is_burned = TRUE)", projectID, StatusRetired).
		Count(&retiredCount).Error; err != nil {
		return nil, err
	}
	summary.RetiredCredits = retiredCount

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status = ? AND is_burned = FALSE", projectID, StatusLocked).
		Count(&summary.LockedCredits).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status = ? AND is_burned = FALSE", projectID, StatusListed).
		Count(&summary.ListedCredits).Error; err != nil {
		return nil, err
	}

	var lastSynced time.Time
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Select("MAX(last_synced)").
		Where("project_id = ?", projectID).
		Row().Scan(&lastSynced); err != nil {
		lastSynced = time.Time{}
	}
	summary.LastSynced = lastSynced

	return summary, nil
}

func (r *repository) GetLastSyncTime(ctx context.Context, projectID uuid.UUID) (time.Time, error) {
	var lastSynced time.Time
	err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Select("MAX(last_synced)").
		Where("project_id = ?", projectID).
		Row().Scan(&lastSynced)
	return lastSynced, err
}

func (r *repository) DeleteProjectCache(ctx context.Context, projectID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Delete(&ProjectCreditCache{}).Error
}
