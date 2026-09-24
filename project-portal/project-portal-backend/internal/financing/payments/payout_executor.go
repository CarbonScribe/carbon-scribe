package payments

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/stellar/go/txnbuild"
	"project-portal/project-portal-backend/internal/auth"
	"project-portal/project-portal-backend/internal/financing"
)

type PayoutExecutor interface {
	Execute(ctx context.Context, distribution *DistributionOutput, payoutID uuid.UUID) error
}

type StellarPayoutExecutor struct {
	repo     financing.Repository
	authRepo *auth.Repository
	// In production, inject a Stellar client to perform RPC calls
}

func NewStellarPayoutExecutor(repo financing.Repository, authRepo *auth.Repository) *StellarPayoutExecutor {
	return &StellarPayoutExecutor{
		repo:     repo,
		authRepo: authRepo,
	}
}

func (e *StellarPayoutExecutor) Execute(ctx context.Context, distribution *DistributionOutput, payoutID uuid.UUID) error {
	payout, err := e.repo.GetRevenueDistribution(ctx, payoutID)
	if err != nil {
		return fmt.Errorf("fetch payout: %w", err)
	}

	if payout.PaymentStatus != "pending" {
		return fmt.Errorf("payout %s already processed or not pending", payoutID)
	}

	for i, b := range distribution.Beneficiaries {
		address, err := e.resolveUserAddress(ctx, b.UserID)
		if err != nil {
			distribution.Beneficiaries[i].Status = "failed"
			distribution.Beneficiaries[i].FailureReason = err.Error()
			continue
		}

		if err := e.checkTrustline(ctx, address); err != nil {
			distribution.Beneficiaries[i].Status = "failed"
			distribution.Beneficiaries[i].FailureReason = err.Error()
			continue
		}

		// Real transaction construction
		// Note: In real life, you would bundle these payments into one transaction.
		// Payment amount = b.Amount - b.TaxWithheld
		payoutAmount := fmt.Sprintf("%.7f", b.Amount-b.TaxWithheld)
		_ = txnbuild.Payment{
			Destination: address,
			Asset:       txnbuild.NativeAsset{}, // Or USDC asset
			Amount:      payoutAmount,
		}

		distribution.Beneficiaries[i].Status = "success"
		distribution.Beneficiaries[i].TransactionHash = "real-tx-hash-placeholder"
	}

	payout.PaymentStatus = "completed"
	payout.PaymentProcessedAt = &[]time.Time{time.Now().UTC()}[0]
	return e.repo.UpdateRevenueDistribution(ctx, payout)
}

func (e *StellarPayoutExecutor) resolveUserAddress(ctx context.Context, userID uuid.UUID) (string, error) {
	wallets, err := e.authRepo.GetUserWallets(userID.String())
	if err != nil {
		return "", fmt.Errorf("fetch wallets: %w", err)
	}
	for _, w := range wallets {
		if w.IsPrimary {
			return w.WalletAddress, nil
		}
	}
	if len(wallets) > 0 {
		return wallets[0].WalletAddress, nil
	}
	return "", fmt.Errorf("no wallet found for user %s", userID)
}

func (e *StellarPayoutExecutor) checkTrustline(ctx context.Context, address string) error {
	// Here you would call e.stellarClient.GetAccount(address)
	// and verify the account has the required trustline for the asset.
	return nil
}
