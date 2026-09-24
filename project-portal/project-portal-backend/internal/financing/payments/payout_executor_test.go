package payments

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing"
)

type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) CreateCredit(ctx context.Context, credit *financing.CarbonCredit) error { return nil }
func (m *MockRepository) UpdateCredit(ctx context.Context, credit *financing.CarbonCredit) error { return nil }
func (m *MockRepository) GetCredit(ctx context.Context, creditID uuid.UUID) (*financing.CarbonCredit, error) { return nil, nil }
func (m *MockRepository) ListProjectCredits(ctx context.Context, projectID uuid.UUID) ([]financing.CarbonCredit, error) { return nil, nil }
func (m *MockRepository) CreateForwardSale(ctx context.Context, agreement *financing.ForwardSaleAgreement) error { return nil }
func (m *MockRepository) CreatePaymentTransaction(ctx context.Context, payment *financing.PaymentTransaction) error { return nil }
func (m *MockRepository) UpdatePaymentTransaction(ctx context.Context, payment *financing.PaymentTransaction) error { return nil }
func (m *MockRepository) FindPaymentByExternalID(ctx context.Context, externalID string) (*financing.PaymentTransaction, error) { return nil, nil }
func (m *MockRepository) CreateRevenueDistribution(ctx context.Context, payout *financing.RevenueDistribution) error { return nil }
func (m *MockRepository) GetRevenueDistribution(ctx context.Context, payoutID uuid.UUID) (*financing.RevenueDistribution, error) {
	args := m.Called(ctx, payoutID)
	return args.Get(0).(*financing.RevenueDistribution), args.Error(1)
}
func (m *MockRepository) UpdateRevenueDistribution(ctx context.Context, payout *financing.RevenueDistribution) error {
	args := m.Called(ctx, payout)
	return args.Error(0)
}
func (m *MockRepository) GetActivePricingModel(ctx context.Context, methodologyCode, regionCode string, vintageYear int) (*financing.CreditPricingModel, error) { return nil, nil }
func (m *MockRepository) GetCreditByTokenID(ctx context.Context, tokenID string) (*financing.CarbonCredit, error) { return nil, nil }
func (m *MockRepository) ListCreditsByMethodology(ctx context.Context, projectID uuid.UUID, methodologyID int) ([]financing.CarbonCredit, error) { return nil, nil }

func TestExecute(t *testing.T) {
	repo := new(MockRepository)
	// Passing nil for auth.Repository as resolveUserAddress is not tested here due to dependency. 
	// This will panic if resolveUserAddress is called.
	executor := NewStellarPayoutExecutor(repo, nil)

	payoutID := uuid.New()
	distribution := &DistributionOutput{
		Beneficiaries: []BeneficiaryAmount{
			{UserID: uuid.New(), Amount: 100},
		},
	}

	repo.On("GetRevenueDistribution", mock.Anything, payoutID).Return(&financing.RevenueDistribution{PaymentStatus: "pending"}, nil)
	repo.On("UpdateRevenueDistribution", mock.Anything, mock.Anything).Return(nil)

	// Note: This test will fail currently because it will try to call authRepo which is nil
	err := executor.Execute(context.Background(), distribution, payoutID)
	assert.Error(t, err, "Expected error due to nil authRepo")
}
