package financing

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	CreateCredit(ctx context.Context, credit *CarbonCredit) error
	UpdateCredit(ctx context.Context, credit *CarbonCredit) error
	GetCredit(ctx context.Context, creditID uuid.UUID) (*CarbonCredit, error)
	ListProjectCredits(ctx context.Context, projectID uuid.UUID) ([]CarbonCredit, error)
	CreateForwardSale(ctx context.Context, agreement *ForwardSaleAgreement) error
	CreatePaymentTransaction(ctx context.Context, payment *PaymentTransaction) error
	UpdatePaymentTransaction(ctx context.Context, payment *PaymentTransaction) error
	FindPaymentByExternalID(ctx context.Context, externalID string) (*PaymentTransaction, error)
	CreateRevenueDistribution(ctx context.Context, payout *RevenueDistribution) error
	GetRevenueDistribution(ctx context.Context, payoutID uuid.UUID) (*RevenueDistribution, error)
	GetActivePricingModel(ctx context.Context, methodologyCode, regionCode string, vintageYear int) (*CreditPricingModel, error)
	GetCreditByTokenID(ctx context.Context, tokenID string) (*CarbonCredit, error)
	ListCreditsByMethodology(ctx context.Context, projectID uuid.UUID, methodologyID int) ([]CarbonCredit, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateCredit(ctx context.Context, credit *CarbonCredit) error {
	return r.db.WithContext(ctx).Create(credit).Error
}

func (r *repository) UpdateCredit(ctx context.Context, credit *CarbonCredit) error {
	return r.db.WithContext(ctx).Save(credit).Error
}

func (r *repository) GetCredit(ctx context.Context, creditID uuid.UUID) (*CarbonCredit, error) {
	var credit CarbonCredit
	err := r.db.WithContext(ctx).Where("id = ?", creditID).First(&credit).Error
	if err != nil {
		return nil, err
	}
	return &credit, nil
}

func (r *repository) ListProjectCredits(ctx context.Context, projectID uuid.UUID) ([]CarbonCredit, error) {
	var credits []CarbonCredit
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at desc").
		Find(&credits).Error
	if err != nil {
		return nil, err
	}
	return credits, nil
}

func (r *repository) CreateForwardSale(ctx context.Context, agreement *ForwardSaleAgreement) error {
	return r.db.WithContext(ctx).Create(agreement).Error
}

func (r *repository) CreatePaymentTransaction(ctx context.Context, payment *PaymentTransaction) error {
	return r.db.WithContext(ctx).Create(payment).Error
}

func (r *repository) UpdatePaymentTransaction(ctx context.Context, payment *PaymentTransaction) error {
	return r.db.WithContext(ctx).Save(payment).Error
}

func (r *repository) FindPaymentByExternalID(ctx context.Context, externalID string) (*PaymentTransaction, error) {
	var payment PaymentTransaction
	err := r.db.WithContext(ctx).Where("external_id = ?", externalID).First(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *repository) CreateRevenueDistribution(ctx context.Context, payout *RevenueDistribution) error {
	return r.db.WithContext(ctx).Create(payout).Error
}

func (r *repository) GetRevenueDistribution(ctx context.Context, payoutID uuid.UUID) (*RevenueDistribution, error) {
	var payout RevenueDistribution
	err := r.db.WithContext(ctx).Where("id = ?", payoutID).First(&payout).Error
	if err != nil {
		return nil, err
	}
	return &payout, nil
}

func (r *repository) GetActivePricingModel(ctx context.Context, methodologyCode, regionCode string, vintageYear int) (*CreditPricingModel, error) {
	now := time.Now().UTC()
	var model CreditPricingModel
	err := r.db.WithContext(ctx).
		Where("methodology_code = ? AND is_active = TRUE", methodologyCode).
		Where("region_code = ? OR region_code = '' OR region_code IS NULL", regionCode).
		Where("vintage_year = ? OR vintage_year IS NULL", vintageYear).
		Where("valid_from <= ?", now).
		Where("valid_until IS NULL OR valid_until >= ?", now).
		Order("vintage_year desc NULLS LAST").
		Order("created_at desc").
		First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *repository) GetCreditByTokenID(ctx context.Context, tokenID string) (*CarbonCredit, error) {
	var credit CarbonCredit
	err := r.db.WithContext(ctx).
		Where("token_ids @> ?", "[\""+tokenID+"\"]").
		First(&credit).Error
	if err != nil {
		return nil, err
	}
	return &credit, nil
}

func (r *repository) ListCreditsByMethodology(ctx context.Context, projectID uuid.UUID, methodologyID int) ([]CarbonCredit, error) {
	var credits []CarbonCredit
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND methodology_token_id = ?", projectID, methodologyID).
		Find(&credits).Error
	return credits, err
}
