package methodology

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	GetMethodologyIDForProject(ctx context.Context, projectID uuid.UUID) (int, error)
	GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*MethodologyRegistration, error)
	GetRegistrationByTokenID(ctx context.Context, tokenID int) (*MethodologyRegistration, error)
	CreateRegistration(ctx context.Context, registration *MethodologyRegistration) error
	UpdateProjectMethodology(ctx context.Context, projectID uuid.UUID, tokenID int, contractID string) error
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

func (r *repository) GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*MethodologyRegistration, error) {
	var registration MethodologyRegistration
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("registered_at DESC").
		First(&registration).Error
	if err != nil {
		return nil, err
	}
	return &registration, nil
}

func (r *repository) GetRegistrationByTokenID(ctx context.Context, tokenID int) (*MethodologyRegistration, error) {
	var registration MethodologyRegistration
	err := r.db.WithContext(ctx).
		Where("methodology_token_id = ?", tokenID).
		Order("registered_at DESC").
		First(&registration).Error
	if err != nil {
		return nil, err
	}
	return &registration, nil
}

func (r *repository) CreateRegistration(ctx context.Context, registration *MethodologyRegistration) error {
	if registration.RegisteredAt.IsZero() {
		registration.RegisteredAt = time.Now().UTC()
	}
	return r.db.WithContext(ctx).Create(registration).Error
}

func (r *repository) UpdateProjectMethodology(ctx context.Context, projectID uuid.UUID, tokenID int, contractID string) error {
	updates := map[string]interface{}{
		"methodology_token_id":    tokenID,
		"methodology_contract_id": contractID,
		"updated_at":              time.Now().UTC(),
	}
	return r.db.WithContext(ctx).
		Table("projects").
		Where("id = ?", projectID).
		Updates(updates).Error
}
