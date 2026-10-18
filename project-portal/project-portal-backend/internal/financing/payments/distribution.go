package payments

import (
	"fmt"
	"math"

	"github.com/google/uuid"
)

type Beneficiary struct {
	UserID      uuid.UUID
	Percent     float64
	TaxWithheld float64
}

type DistributionInput struct {
	TotalReceived      float64
	PlatformFeePercent float64
	Beneficiaries      []Beneficiary
}

// BeneficiaryPayoutStatus tracks a single beneficiary's Stellar payout
// execution outcome, independent of the pure arithmetic Compute performs.
type BeneficiaryPayoutStatus string

const (
	// BeneficiaryPayoutPending means execution has not been attempted yet.
	BeneficiaryPayoutPending BeneficiaryPayoutStatus = "pending"
	// BeneficiaryPayoutSucceeded means the on-chain payment was confirmed.
	// A beneficiary already in this state is skipped on retry (#569).
	BeneficiaryPayoutSucceeded BeneficiaryPayoutStatus = "succeeded"
	// BeneficiaryPayoutFailed means execution was attempted and failed for
	// this beneficiary specifically; it does not block other beneficiaries.
	BeneficiaryPayoutFailed BeneficiaryPayoutStatus = "failed"
	// BeneficiaryPayoutSkipped means no on-chain transfer was attempted
	// because, after tax withholding, there was nothing left to pay out.
	BeneficiaryPayoutSkipped BeneficiaryPayoutStatus = "skipped"
)

type BeneficiaryAmount struct {
	UserID      uuid.UUID
	Percent     float64
	Amount      float64
	TaxWithheld float64

	// PayoutAmount is Amount-TaxWithheld — the amount actually transferred
	// on-chain. Populated at execution time, not by Compute.
	PayoutAmount float64
	// StellarAddress is the verified wallet address the payout was (or will
	// be) sent to. Populated at execution time.
	StellarAddress string
	// Status tracks this beneficiary's payout execution, independent of the
	// other beneficiaries in the same distribution (#569).
	Status BeneficiaryPayoutStatus
	// TransactionHash is the confirmed Stellar transaction hash once Status
	// is BeneficiaryPayoutSucceeded.
	TransactionHash string
	// FailureReason is a human-readable explanation set when Status is
	// BeneficiaryPayoutFailed.
	FailureReason string
}

// DistributionStatus summarizes execution across all beneficiaries in a
// DistributionOutput.
type DistributionStatus string

const (
	DistributionStatusPending   DistributionStatus = "pending"
	DistributionStatusCompleted DistributionStatus = "completed"
	// DistributionStatusPartial means at least one beneficiary succeeded and
	// at least one failed — the whole distribution is neither a clean
	// success nor a clean failure (#569).
	DistributionStatusPartial DistributionStatus = "partial"
	DistributionStatusFailed  DistributionStatus = "failed"
)

type DistributionOutput struct {
	PlatformFeeAmount float64
	NetAmount         float64
	Beneficiaries     []BeneficiaryAmount
	// Status summarizes execution across all beneficiaries; Pending until
	// PayoutExecutor.Execute has run.
	Status DistributionStatus
}

type Distributor struct{}

func NewDistributor() *Distributor {
	return &Distributor{}
}

func (d *Distributor) Compute(input DistributionInput) (*DistributionOutput, error) {
	if input.TotalReceived <= 0 {
		return nil, fmt.Errorf("total_received must be greater than zero")
	}
	if input.PlatformFeePercent < 0 || input.PlatformFeePercent > 100 {
		return nil, fmt.Errorf("platform_fee_percent must be between 0 and 100")
	}
	if len(input.Beneficiaries) == 0 {
		return nil, fmt.Errorf("at least one beneficiary is required")
	}
	percentSum := 0.0
	for _, b := range input.Beneficiaries {
		if b.Percent < 0 {
			return nil, fmt.Errorf("beneficiary percent cannot be negative")
		}
		percentSum += b.Percent
	}
	if percentSum > 100.0001 {
		return nil, fmt.Errorf("beneficiary percent total cannot exceed 100")
	}

	platformFeeAmount := round4(input.TotalReceived * input.PlatformFeePercent / 100)
	netAmount := round4(input.TotalReceived - platformFeeAmount)

	beneficiaries := make([]BeneficiaryAmount, 0, len(input.Beneficiaries))
	for _, beneficiary := range input.Beneficiaries {
		amount := round4(netAmount * beneficiary.Percent / 100)
		payoutAmount := round4(amount - beneficiary.TaxWithheld)
		if payoutAmount < 0 {
			payoutAmount = 0
		}
		beneficiaries = append(beneficiaries, BeneficiaryAmount{
			UserID:       beneficiary.UserID,
			Percent:      beneficiary.Percent,
			Amount:       amount,
			TaxWithheld:  beneficiary.TaxWithheld,
			PayoutAmount: payoutAmount,
			Status:       BeneficiaryPayoutPending,
		})
	}

	return &DistributionOutput{
		PlatformFeeAmount: platformFeeAmount,
		NetAmount:         netAmount,
		Beneficiaries:     beneficiaries,
		Status:            DistributionStatusPending,
	}, nil
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
