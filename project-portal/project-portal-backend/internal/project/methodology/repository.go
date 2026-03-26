package methodology

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	GetMethodologyIDForProject(ctx context.Context, projectID uuid.UUID) (int, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetMethodologyIDForProject(ctx context.Context, projectID uuid.UUID) (int, error) {
	var result struct {
		MethodologyTokenID int
	}
	err := r.db.WithContext(ctx).Table("projects").
		Select("methodology_token_id").
		Where("id = ?", projectID).
		Scan(&result).Error
	if err != nil {
		return 0, err
	}
	return result.MethodologyTokenID, nil
}
