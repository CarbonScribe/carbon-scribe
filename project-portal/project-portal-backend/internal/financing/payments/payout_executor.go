package payments

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/stellar/go/txnbuild"
	"project-portal/project-portal-backend/internal/financing"
)

// PayoutExecutor defines the interface for executing payouts
type PayoutExecutor interface {
	Execute(ctx context.Context, distribution *DistributionOutput, payoutID uuid.UUID) error
}

// StellarPayoutExecutor implements PayoutExecutor for the Stellar network
type StellarPayoutExecutor struct {
	repo financing.Repository
	// Add Stellar client and auth client here
}

func NewStellarPayoutExecutor(repo financing.Repository) *StellarPayoutExecutor {
	return &StellarPayoutExecutor{
		repo: repo,
	}
}

func (e *StellarPayoutExecutor) Execute(ctx context.Context, distribution *DistributionOutput, payoutID uuid.UUID) error {
	// 1. Fetch payout from repo to verify status
	payout, err := e.repo.GetRevenueDistribution(ctx, payoutID)
	if err != nil {
		return fmt.Errorf("fetch payout: %w", err)
	}

	if payout.PaymentStatus != "pending" {
		return fmt.Errorf("payout %s already processed or not pending", payoutID)
	}

	// 2. Iterate through beneficiaries
	for i, b := range distribution.Beneficiaries {
		// 3. Resolve UserID to Stellar Public Key
		address, err := e.resolveUserAddress(ctx, b.UserID)
		if err != nil {
			distribution.Beneficiaries[i].Status = "failed"
			distribution.Beneficiaries[i].FailureReason = err.Error()
			continue
		}

		// 4. Check Trustline for each beneficiary
		if err := e.checkTrustline(ctx, address); err != nil {
			distribution.Beneficiaries[i].Status = "failed"
			distribution.Beneficiaries[i].FailureReason = err.Error()
			continue
		}

		// 5. Build and execute payment (stubbed)
		distribution.Beneficiaries[i].Status = "success"
		distribution.Beneficiaries[i].TransactionHash = "dummy-tx-hash"
	}

	// 6. Update distribution status in repo
	payout.PaymentStatus = "completed"
	payout.PaymentProcessedAt = &[]time.Time{time.Now().UTC()}[0]
	return e.repo.UpdateRevenueDistribution(ctx, payout)
}

func (e *StellarPayoutExecutor) resolveUserAddress(ctx context.Context, userID uuid.UUID) (string, error) {
	// In a real implementation, call Auth service repository/service to get user wallet
	// return wallet, nil
	return "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", nil
}

func (e *StellarPayoutExecutor) checkTrustline(ctx context.Context, address string) error {
	// In a real implementation, call Stellar RPC to check if asset trustline exists
	return nil
}
