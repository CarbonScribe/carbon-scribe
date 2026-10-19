package payments

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComputeSplitsNetAmountByPercent(t *testing.T) {
	d := NewDistributor()
	userA := uuid.New()
	userB := uuid.New()

	output, err := d.Compute(DistributionInput{
		TotalReceived:      1000,
		PlatformFeePercent: 10,
		Beneficiaries: []Beneficiary{
			{UserID: userA, Percent: 60},
			{UserID: userB, Percent: 40},
		},
	})
	require.NoError(t, err)

	assert.Equal(t, 100.0, output.PlatformFeeAmount)
	assert.Equal(t, 900.0, output.NetAmount)
	require.Len(t, output.Beneficiaries, 2)
	assert.Equal(t, 540.0, output.Beneficiaries[0].Amount)
	assert.Equal(t, 360.0, output.Beneficiaries[1].Amount)
}

func TestComputeDeductsTaxWithheldFromPayoutAmount(t *testing.T) {
	d := NewDistributor()
	output, err := d.Compute(DistributionInput{
		TotalReceived:      1000,
		PlatformFeePercent: 0,
		Beneficiaries: []Beneficiary{
			{UserID: uuid.New(), Percent: 100, TaxWithheld: 150},
		},
	})
	require.NoError(t, err)

	b := output.Beneficiaries[0]
	assert.Equal(t, 1000.0, b.Amount)
	assert.Equal(t, 150.0, b.TaxWithheld)
	// PayoutAmount is what actually moves on-chain — Amount minus
	// TaxWithheld — not the gross Amount (#569).
	assert.Equal(t, 850.0, b.PayoutAmount)
}

func TestComputeClampsPayoutAmountAtZeroWhenTaxExceedsAmount(t *testing.T) {
	d := NewDistributor()
	output, err := d.Compute(DistributionInput{
		TotalReceived:      100,
		PlatformFeePercent: 0,
		Beneficiaries: []Beneficiary{
			// A misconfigured TaxWithheld larger than the beneficiary's own
			// share must not drive PayoutAmount negative.
			{UserID: uuid.New(), Percent: 100, TaxWithheld: 500},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, 0.0, output.Beneficiaries[0].PayoutAmount)
}

func TestComputeDefaultsExecutionStatusToPending(t *testing.T) {
	d := NewDistributor()
	output, err := d.Compute(DistributionInput{
		TotalReceived:      100,
		PlatformFeePercent: 0,
		Beneficiaries:      []Beneficiary{{UserID: uuid.New(), Percent: 100}},
	})
	require.NoError(t, err)

	assert.Equal(t, DistributionStatusPending, output.Status)
	assert.Equal(t, BeneficiaryPayoutPending, output.Beneficiaries[0].Status)
	assert.Empty(t, output.Beneficiaries[0].TransactionHash)
}

func TestComputeRejectsNonPositiveTotal(t *testing.T) {
	d := NewDistributor()
	_, err := d.Compute(DistributionInput{
		TotalReceived:      0,
		PlatformFeePercent: 10,
		Beneficiaries:      []Beneficiary{{UserID: uuid.New(), Percent: 100}},
	})
	assert.Error(t, err)
}

func TestComputeRejectsPercentOver100(t *testing.T) {
	d := NewDistributor()
	_, err := d.Compute(DistributionInput{
		TotalReceived:      100,
		PlatformFeePercent: 0,
		Beneficiaries: []Beneficiary{
			{UserID: uuid.New(), Percent: 60},
			{UserID: uuid.New(), Percent: 60},
		},
	})
	assert.Error(t, err)
}

func TestComputeRejectsEmptyBeneficiaries(t *testing.T) {
	d := NewDistributor()
	_, err := d.Compute(DistributionInput{TotalReceived: 100, PlatformFeePercent: 0})
	assert.Error(t, err)
}
