package methodology

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrCapNotConfigured   = errors.New("methodology cap not configured")
	ErrCapExceeded        = errors.New("methodology supply cap exceeded")
	ErrProjectCapExceeded = errors.New("methodology per-project cap exceeded")
	ErrVintageCapExceeded = errors.New("methodology per-vintage cap exceeded")
)

type MintValidationInput struct {
	MethodologyTokenID int
	ProjectID          uuid.UUID
	VintageYear        *int
	RequestedAmount    int64
}

type CapRepository interface {
	GetMethodologyCap(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error)
	UpsertMethodologyCap(ctx context.Context, cap *MethodologyCap) error
	RecordCapConfigurationSource(ctx context.Context, source *CapConfigurationSource) error
	ListMintingAttemptsByMethodology(ctx context.Context, methodologyTokenID int, limit int) ([]MintingAttempt, error)
	ListMintingAttemptsByProject(ctx context.Context, projectID uuid.UUID, limit int) ([]MintingAttempt, error)
	ListCapsNearLimit(ctx context.Context, thresholdRatio float64) ([]MethodologyCap, error)
	ValidateAndExecuteMint(ctx context.Context, input MintValidationInput, executeMint func(context.Context) error) (*MintingAttempt, error)
}

func (r *repository) GetMethodologyCap(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error) {
	var cap MethodologyCap
	now := time.Now().UTC()
	err := r.db.WithContext(ctx).
		Where("methodology_token_id = ?", methodologyTokenID).
		Where("effective_from <= ?", now).
		Where("effective_to IS NULL OR effective_to >= ?", now).
		First(&cap).Error
	if err != nil {
		return nil, err
	}
	return &cap, nil
}

func (r *repository) UpsertMethodologyCap(ctx context.Context, cap *MethodologyCap) error {
	if cap.EffectiveFrom.IsZero() {
		cap.EffectiveFrom = time.Now().UTC()
	}
	if cap.MethodologyTokenID <= 0 {
		return fmt.Errorf("invalid methodology token id")
	}
	if cap.MaxSupply <= 0 {
		return fmt.Errorf("max supply must be positive")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing MethodologyCap
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("methodology_token_id = ?", cap.MethodologyTokenID).
			First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(cap).Error
		}
		if err != nil {
			return err
		}

		if cap.CurrentSupply < existing.CurrentSupply {
			cap.CurrentSupply = existing.CurrentSupply
		}

		existing.MaxSupply = cap.MaxSupply
		existing.CapPerProject = cap.CapPerProject
		existing.CapPerVintage = cap.CapPerVintage
		existing.EffectiveFrom = cap.EffectiveFrom
		existing.EffectiveTo = cap.EffectiveTo
		existing.CreatedBy = cap.CreatedBy
		existing.CurrentSupply = cap.CurrentSupply
		existing.UpdatedAt = time.Now().UTC()
		return tx.Save(&existing).Error
	})
}

func (r *repository) RecordCapConfigurationSource(ctx context.Context, source *CapConfigurationSource) error {
	return r.db.WithContext(ctx).Create(source).Error
}

func (r *repository) ListMintingAttemptsByMethodology(ctx context.Context, methodologyTokenID int, limit int) ([]MintingAttempt, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var attempts []MintingAttempt
	err := r.db.WithContext(ctx).
		Where("methodology_token_id = ?", methodologyTokenID).
		Order("attempted_at DESC").
		Limit(limit).
		Find(&attempts).Error
	return attempts, err
}

func (r *repository) ListMintingAttemptsByProject(ctx context.Context, projectID uuid.UUID, limit int) ([]MintingAttempt, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var attempts []MintingAttempt
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("attempted_at DESC").
		Limit(limit).
		Find(&attempts).Error
	return attempts, err
}

func (r *repository) ListCapsNearLimit(ctx context.Context, thresholdRatio float64) ([]MethodologyCap, error) {
	if thresholdRatio <= 0 || thresholdRatio >= 1 {
		thresholdRatio = 0.9
	}

	var caps []MethodologyCap
	now := time.Now().UTC()
	err := r.db.WithContext(ctx).
		Where("effective_from <= ?", now).
		Where("effective_to IS NULL OR effective_to >= ?", now).
		Where("max_supply > 0").
		Where("(current_supply::numeric / max_supply::numeric) >= ?", thresholdRatio).
		Order("(current_supply::numeric / max_supply::numeric) DESC").
		Find(&caps).Error
	return caps, err
}

func (r *repository) ValidateAndExecuteMint(ctx context.Context, input MintValidationInput, executeMint func(context.Context) error) (*MintingAttempt, error) {
	if input.MethodologyTokenID <= 0 {
		return nil, fmt.Errorf("invalid methodology token id")
	}
	if input.ProjectID == uuid.Nil {
		return nil, fmt.Errorf("invalid project id")
	}
	if input.RequestedAmount <= 0 {
		return nil, fmt.Errorf("requested amount must be positive")
	}

	var loggedAttempt *MintingAttempt
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		var cap MethodologyCap
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("methodology_token_id = ?", input.MethodologyTokenID).
			Where("effective_from <= ?", now).
			Where("effective_to IS NULL OR effective_to >= ?", now).
			First(&cap).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCapNotConfigured
		}
		if err != nil {
			return err
		}

		before := cap.CurrentSupply
		reject := func(reason string, rejectErr error) error {
			after := before
			attempt := MintingAttempt{
				MethodologyTokenID:  input.MethodologyTokenID,
				ProjectID:           input.ProjectID,
				RequestedAmount:     input.RequestedAmount,
				Approved:            false,
				RejectionReason:     strings.TrimSpace(reason),
				CurrentSupplyBefore: &before,
				CurrentSupplyAfter:  &after,
				VintageYear:         input.VintageYear,
				AttemptedAt:         now,
			}
			if createErr := tx.Create(&attempt).Error; createErr != nil {
				return createErr
			}
			loggedAttempt = &attempt
			return rejectErr
		}

		if before+input.RequestedAmount > cap.MaxSupply {
			reason := fmt.Sprintf("requested amount %d exceeds methodology max supply %d (current %d)", input.RequestedAmount, cap.MaxSupply, before)
			return reject(reason, ErrCapExceeded)
		}

		if cap.CapPerProject != nil {
			var mintedForProject int64
			if err := tx.Model(&MintingAttempt{}).
				Select("COALESCE(SUM(requested_amount), 0)").
				Where("methodology_token_id = ? AND project_id = ? AND approved = TRUE", input.MethodologyTokenID, input.ProjectID).
				Scan(&mintedForProject).Error; err != nil {
				return err
			}
			if mintedForProject+input.RequestedAmount > *cap.CapPerProject {
				reason := fmt.Sprintf("requested amount %d exceeds per-project cap %d (already minted %d)", input.RequestedAmount, *cap.CapPerProject, mintedForProject)
				return reject(reason, ErrProjectCapExceeded)
			}
		}

		if cap.CapPerVintage != nil && input.VintageYear != nil {
			var mintedForVintage int64
			if err := tx.Model(&MintingAttempt{}).
				Select("COALESCE(SUM(requested_amount), 0)").
				Where("methodology_token_id = ? AND vintage_year = ? AND approved = TRUE", input.MethodologyTokenID, *input.VintageYear).
				Scan(&mintedForVintage).Error; err != nil {
				return err
			}
			if mintedForVintage+input.RequestedAmount > *cap.CapPerVintage {
				reason := fmt.Sprintf("requested amount %d exceeds per-vintage cap %d (already minted %d)", input.RequestedAmount, *cap.CapPerVintage, mintedForVintage)
				return reject(reason, ErrVintageCapExceeded)
			}
		}

		if err := executeMint(ctx); err != nil {
			reason := fmt.Sprintf("minting failed after validation: %v", err)
			return reject(reason, err)
		}

		after := before + input.RequestedAmount
		if err := tx.Model(&MethodologyCap{}).
			Where("id = ?", cap.ID).
			Updates(map[string]any{
				"current_supply": after,
				"updated_at":     time.Now().UTC(),
			}).Error; err != nil {
			return err
		}

		attempt := MintingAttempt{
			MethodologyTokenID:  input.MethodologyTokenID,
			ProjectID:           input.ProjectID,
			RequestedAmount:     input.RequestedAmount,
			Approved:            true,
			CurrentSupplyBefore: &before,
			CurrentSupplyAfter:  &after,
			VintageYear:         input.VintageYear,
			AttemptedAt:         now,
		}
		if err := tx.Create(&attempt).Error; err != nil {
			return err
		}
		loggedAttempt = &attempt
		return nil
	})
	if err != nil {
		return loggedAttempt, err
	}
	return loggedAttempt, nil
}
