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

type BeneficiaryAmount struct {
	UserID      uuid.UUID
	Percent     float64
	Amount      float64
	TaxWithheld float64
}

type DistributionOutput struct {
	PlatformFeeAmount float64
	NetAmount         float64
	Beneficiaries     []BeneficiaryAmount
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
		beneficiaries = append(beneficiaries, BeneficiaryAmount{
			UserID:      beneficiary.UserID,
			Percent:     beneficiary.Percent,
			Amount:      amount,
			TaxWithheld: beneficiary.TaxWithheld,
		})
	}

	return &DistributionOutput{
		PlatformFeeAmount: platformFeeAmount,
		NetAmount:         netAmount,
		Beneficiaries:     beneficiaries,
	}, nil
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
