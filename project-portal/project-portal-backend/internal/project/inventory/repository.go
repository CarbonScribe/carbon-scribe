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
	// GetFreshCreditByTokenID returns the cached row only if it has not expired.
	// Expired (or zero-expiry) rows yield gorm.ErrRecordNotFound so callers
	// refresh from chain instead of serving stale data.
	GetFreshCreditByTokenID(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*ProjectCreditCache, error)
	ListCreditsByProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error)
	ListCreditsByStatus(ctx context.Context, projectID uuid.UUID, status AssetStatus, limit, offset int) ([]ProjectCreditCache, int64, error)
	ListActiveCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error)
	ListRetiredCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error)
	GetInventorySummary(ctx context.Context, projectID uuid.UUID) (*InventorySummary, error)
	GetLastSyncTime(ctx context.Context, projectID uuid.UUID) (time.Time, error)
	DeleteProjectCache(ctx context.Context, projectID uuid.UUID) error
	// PurgeExpiredCache deletes rows past expires_at and returns the count removed.
	PurgeExpiredCache(ctx context.Context) (int64, error)
	// CountExpiredCache returns the number of rows past expires_at without deleting.
	CountExpiredCache(ctx context.Context) (int64, error)
}

// defaultCacheTTL is the fallback expiry horizon applied at the data layer when
// the caller did not populate ExpiresAt. It mirrors NewService's default so
// every cache write is guaranteed an expires_at value.
const defaultCacheTTL = 5 * time.Minute

// ensureExpiry guarantees every cache write carries an expires_at value.
func ensureExpiry(cache *ProjectCreditCache, now time.Time) {
	if cache.LastSynced.IsZero() {
		cache.LastSynced = now
	}
	if cache.ExpiresAt.IsZero() {
		cache.ExpiresAt = cache.LastSynced.Add(defaultCacheTTL)
	}
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new inventory repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) UpsertCreditCache(ctx context.Context, cache *ProjectCreditCache) error {
	now := time.Now().UTC()
	cache.LastSynced = now
	ensureExpiry(cache, now)
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "project_id"}, {Name: "token_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"owner_address", "status", "vintage_year", "methodology_id", "quality_score", "is_burned", "last_synced", "expires_at", "updated_at"}),
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
		ensureExpiry(&caches[i], now)
	}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "project_id"}, {Name: "token_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"owner_address", "status", "vintage_year", "methodology_id", "quality_score", "is_burned", "last_synced", "expires_at", "updated_at"}),
		}).
		CreateInBatches(caches, 100).Error
}

func (r *repository) GetCreditByTokenID(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*ProjectCreditCache, error) {
	return r.GetFreshCreditByTokenID(ctx, projectID, tokenID)
}

func (r *repository) GetFreshCreditByTokenID(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*ProjectCreditCache, error) {
	var cache ProjectCreditCache
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND token_id = ?", projectID, tokenID).
		Where("expires_at > ?", time.Now().UTC()).
		First(&cache).Error
	if err != nil {
		return nil, err
	}
	return &cache, nil
}

func (r *repository) ListCreditsByProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64
	now := time.Now().UTC()

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND expires_at > ?", projectID, now).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND expires_at > ?", projectID, now).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) ListCreditsByStatus(ctx context.Context, projectID uuid.UUID, status AssetStatus, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64
	now := time.Now().UTC()

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status = ? AND is_burned = FALSE AND expires_at > ?", projectID, status, now).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND status = ? AND is_burned = FALSE AND expires_at > ?", projectID, status, now).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) ListActiveCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64
	now := time.Now().UTC()

	activeStatuses := []AssetStatus{StatusIssued, StatusListed}

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status IN ? AND is_burned = FALSE AND expires_at > ?", projectID, activeStatuses, now).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND status IN ? AND is_burned = FALSE AND expires_at > ?", projectID, activeStatuses, now).
		Order("token_id ASC").
		Limit(limit).
		Offset(offset).
		Find(&caches).Error

	return caches, total, err
}

func (r *repository) ListRetiredCredits(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]ProjectCreditCache, int64, error) {
	var caches []ProjectCreditCache
	var total int64
	now := time.Now().UTC()

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND (status = ? OR is_burned = TRUE) AND expires_at > ?", projectID, StatusRetired, now).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND (status = ? OR is_burned = TRUE) AND expires_at > ?", projectID, StatusRetired, now).
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
	now := time.Now().UTC()

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND is_burned = FALSE AND expires_at > ?", projectID, now).
		Count(&summary.TotalCredits).Error; err != nil {
		return nil, err
	}

	activeStatuses := []AssetStatus{StatusIssued, StatusListed}
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status IN ? AND is_burned = FALSE AND expires_at > ?", projectID, activeStatuses, now).
		Count(&summary.ActiveCredits).Error; err != nil {
		return nil, err
	}

	var retiredCount int64
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND (status = ? OR is_burned = TRUE) AND expires_at > ?", projectID, StatusRetired, now).
		Count(&retiredCount).Error; err != nil {
		return nil, err
	}
	summary.RetiredCredits = retiredCount

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status = ? AND is_burned = FALSE AND expires_at > ?", projectID, StatusLocked, now).
		Count(&summary.LockedCredits).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("project_id = ? AND status = ? AND is_burned = FALSE AND expires_at > ?", projectID, StatusListed, now).
		Count(&summary.ListedCredits).Error; err != nil {
		return nil, err
	}

	var lastSynced time.Time
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Select("MAX(last_synced)").
		Where("project_id = ? AND expires_at > ?", projectID, now).
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

// PurgeExpiredCache deletes all rows whose expires_at is in the past (or zero)
// and returns the number of rows removed. The idx_project_credit_cache_expires_at
// index keeps this efficient as the table grows.
func (r *repository) PurgeExpiredCache(ctx context.Context) (int64, error) {
	result := r.db.WithContext(ctx).
		Where("expires_at <= ?", time.Now().UTC()).
		Delete(&ProjectCreditCache{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

// CountExpiredCache returns the number of rows past expires_at without deleting them.
func (r *repository) CountExpiredCache(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&ProjectCreditCache{}).
		Where("expires_at <= ?", time.Now().UTC()).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
