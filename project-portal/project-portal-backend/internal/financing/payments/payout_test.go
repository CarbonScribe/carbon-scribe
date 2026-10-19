package payments

import (
	"context"
	"testing"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/tokenization/minting"

	"github.com/google/uuid"
	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/base"
	"github.com/stellar/go/support/render/problem"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const testPayoutAssetCode = "USDC"

var testAssetIssuer = keypair.MustRandom().Address()

// ============================================================================
// Test doubles
// ============================================================================

// fakeWalletResolver models auth.Repository's GetUserWallets for tests,
// without a real database.
type fakeWalletResolver struct {
	wallets map[string][]auth.UserWallet
	err     error
}

func (f *fakeWalletResolver) GetUserWallets(userID string) ([]auth.UserWallet, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.wallets[userID], nil
}

func verifiedWallet(address string, primary bool) auth.UserWallet {
	return auth.UserWallet{WalletAddress: address, IsPrimary: primary, Verified: true}
}

func newRealExecutorWithMockHorizon(t *testing.T, wallets *fakeWalletResolver) (*RealPayoutExecutor, *horizonclient.MockClient) {
	t.Helper()
	treasury, err := keypair.Random()
	require.NoError(t, err)
	mockHorizon := &horizonclient.MockClient{}
	executor := &RealPayoutExecutor{
		horizon:           mockHorizon,
		networkPassphrase: "Test SDF Network ; September 2015",
		treasury:          treasury,
		wallets:           wallets,
		retryPolicy:       minting.RetryPolicy{MaxAttempts: 1},
	}
	return executor, mockHorizon
}

func accountWithBalances(accountID string, balances ...hProtocol.Balance) hProtocol.Account {
	return hProtocol.Account{AccountID: accountID, Balances: balances}
}

func creditBalance(code, issuer, amount string) hProtocol.Balance {
	return hProtocol.Balance{
		Balance: amount,
		Asset:   base.Asset{Type: "credit_alphanum4", Code: code, Issuer: issuer},
	}
}

func newHorizonServerError() error {
	return &horizonclient.Error{
		Problem: problem.P{Type: "server_error", Title: "Internal Server Error", Status: 500},
	}
}

func beneficiary(userID uuid.UUID, payoutAmount float64) BeneficiaryAmount {
	return BeneficiaryAmount{
		UserID:       userID,
		Amount:       payoutAmount,
		PayoutAmount: payoutAmount,
		Status:       BeneficiaryPayoutPending,
	}
}

func setAssetIssuer(t *testing.T, code, issuer string) {
	t.Helper()
	PayoutAssetIssuers[code] = issuer
	t.Cleanup(func() { delete(PayoutAssetIssuers, code) })
}

// ============================================================================
// ResolveVerifiedWallet
// ============================================================================

func TestResolveVerifiedWalletPrefersPrimary(t *testing.T) {
	userID := uuid.New()
	secondary := keypair.MustRandom().Address()
	primary := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(secondary, false), verifiedWallet(primary, true)},
	}}

	address, err := ResolveVerifiedWallet(resolver, userID)
	require.NoError(t, err)
	assert.Equal(t, primary, address)
}

func TestResolveVerifiedWalletFallsBackToAnyVerified(t *testing.T) {
	userID := uuid.New()
	addr := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(addr, false)},
	}}

	address, err := ResolveVerifiedWallet(resolver, userID)
	require.NoError(t, err)
	assert.Equal(t, addr, address)
}

func TestResolveVerifiedWalletRejectsUnverified(t *testing.T) {
	userID := uuid.New()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {{WalletAddress: keypair.MustRandom().Address(), Verified: false}},
	}}

	_, err := ResolveVerifiedWallet(resolver, userID)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrNoVerifiedWallet)
}

func TestResolveVerifiedWalletRejectsNoWallets(t *testing.T) {
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{}}
	_, err := ResolveVerifiedWallet(resolver, uuid.New())
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrNoVerifiedWallet)
}

// ============================================================================
// RealPayoutExecutor.Execute — success, missing trustline, partial failure
// ============================================================================

func TestExecutePaysVerifiedBeneficiaryWithTrustline(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	userID := uuid.New()
	address := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(address, true)},
	}}
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, resolver)

	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: address}).
		Return(accountWithBalances(address, creditBalance(testPayoutAssetCode, testAssetIssuer, "0")), nil)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: executor.treasury.Address()}).
		Return(accountWithBalances(executor.treasury.Address()), nil)
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{Successful: true, Hash: "tx-hash-1"}, nil)

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(userID, 100)}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutSucceeded, output.Beneficiaries[0].Status)
	assert.Equal(t, "tx-hash-1", output.Beneficiaries[0].TransactionHash)
	assert.Equal(t, address, output.Beneficiaries[0].StellarAddress)
	assert.Equal(t, DistributionStatusCompleted, output.Status)
	mockHorizon.AssertExpectations(t)
}

func TestExecuteFailsIsolatedBeneficiaryOnMissingTrustline(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	userID := uuid.New()
	address := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(address, true)},
	}}
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, resolver)

	// Account exists but holds no line for the payout asset at all.
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: address}).
		Return(accountWithBalances(address), nil)

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(userID, 100)}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutFailed, output.Beneficiaries[0].Status)
	assert.Equal(t, ErrTrustlineMissing.Error(), output.Beneficiaries[0].FailureReason)
	assert.Equal(t, DistributionStatusFailed, output.Status)
	mockHorizon.AssertNotCalled(t, "SubmitTransaction", mock.Anything)
}

func TestExecutePartialFailureDoesNotBlockOtherBeneficiaries(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	paidUser := uuid.New()
	unresolvedUser := uuid.New() // has no wallet on file at all
	paidAddress := keypair.MustRandom().Address()

	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		paidUser.String(): {verifiedWallet(paidAddress, true)},
	}}
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, resolver)

	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: paidAddress}).
		Return(accountWithBalances(paidAddress, creditBalance(testPayoutAssetCode, testAssetIssuer, "0")), nil)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: executor.treasury.Address()}).
		Return(accountWithBalances(executor.treasury.Address()), nil)
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{Successful: true, Hash: "tx-hash-ok"}, nil)

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{
		beneficiary(paidUser, 60),
		beneficiary(unresolvedUser, 40),
	}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutSucceeded, output.Beneficiaries[0].Status)
	assert.Equal(t, "tx-hash-ok", output.Beneficiaries[0].TransactionHash)

	assert.Equal(t, BeneficiaryPayoutFailed, output.Beneficiaries[1].Status)
	assert.Contains(t, output.Beneficiaries[1].FailureReason, ErrNoVerifiedWallet.Error())

	// A mix of one success and one failure is a partial outcome, not an
	// opaque distribution-level error (#569).
	assert.Equal(t, DistributionStatusPartial, output.Status)
}

func TestExecuteSkipsZeroAmountAfterTaxWithholding(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	userID := uuid.New()
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, &fakeWalletResolver{})

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{
		{UserID: userID, Amount: 10, TaxWithheld: 10, PayoutAmount: 0, Status: BeneficiaryPayoutPending},
	}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutSkipped, output.Beneficiaries[0].Status)
	mockHorizon.AssertNotCalled(t, "AccountDetail", mock.Anything)
}

func TestExecuteReturnsErrorWhenAssetIssuerNotConfigured(t *testing.T) {
	executor, _ := newRealExecutorWithMockHorizon(t, &fakeWalletResolver{})
	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(uuid.New(), 100)}}

	err := executor.Execute(context.Background(), "dist-1", "UNCONFIGURED", output)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAssetIssuerNotConfigured)
}

// ============================================================================
// Idempotent retry — a second Execute call must never double-pay (#569)
// ============================================================================

func TestExecuteIsIdempotentOnRetry(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	userID := uuid.New()
	address := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(address, true)},
	}}
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, resolver)

	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: address}).
		Return(accountWithBalances(address, creditBalance(testPayoutAssetCode, testAssetIssuer, "0")), nil).Once()
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: executor.treasury.Address()}).
		Return(accountWithBalances(executor.treasury.Address()), nil).Once()
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{Successful: true, Hash: "tx-hash-once"}, nil).Once()

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(userID, 100)}}

	require.NoError(t, executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output))
	require.Equal(t, BeneficiaryPayoutSucceeded, output.Beneficiaries[0].Status)

	// Simulate a retry against the same (now partially-persisted) output —
	// e.g. the caller's process crashed right after this and reloaded the
	// record from the database. SubmitTransaction must not be called again.
	require.NoError(t, executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output))

	assert.Equal(t, "tx-hash-once", output.Beneficiaries[0].TransactionHash)
	mockHorizon.AssertExpectations(t)
	mockHorizon.AssertNumberOfCalls(t, "SubmitTransaction", 1)
}

func TestExecuteIdempotentRetryOnlyResubmitsFailedBeneficiary(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	succeededUser := uuid.New()
	retriedUser := uuid.New()
	retriedAddr := keypair.MustRandom().Address()

	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		retriedUser.String(): {verifiedWallet(retriedAddr, true)},
	}}
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, resolver)

	// retriedUser initially has no trustline...
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: retriedAddr}).
		Return(accountWithBalances(retriedAddr), nil).Once()

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{
		{UserID: succeededUser, Amount: 60, PayoutAmount: 60, Status: BeneficiaryPayoutSucceeded, TransactionHash: "already-paid"},
		beneficiary(retriedUser, 40),
	}}

	require.NoError(t, executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output))
	assert.Equal(t, BeneficiaryPayoutFailed, output.Beneficiaries[1].Status)

	// ...now the beneficiary establishes a trustline and the distribution is
	// retried. The already-succeeded beneficiary must not be touched again.
	resolver.wallets[retriedUser.String()] = []auth.UserWallet{verifiedWallet(retriedAddr, true)}
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: retriedAddr}).
		Return(accountWithBalances(retriedAddr, creditBalance(testPayoutAssetCode, testAssetIssuer, "0")), nil).Once()
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: executor.treasury.Address()}).
		Return(accountWithBalances(executor.treasury.Address()), nil).Once()
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{Successful: true, Hash: "tx-hash-retry"}, nil).Once()

	require.NoError(t, executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output))

	assert.Equal(t, "already-paid", output.Beneficiaries[0].TransactionHash)
	assert.Equal(t, BeneficiaryPayoutSucceeded, output.Beneficiaries[1].Status)
	assert.Equal(t, "tx-hash-retry", output.Beneficiaries[1].TransactionHash)
	assert.Equal(t, DistributionStatusCompleted, output.Status)
	mockHorizon.AssertExpectations(t)
	mockHorizon.AssertNumberOfCalls(t, "SubmitTransaction", 1)
}

// ============================================================================
// Transient-failure retry/backoff
// ============================================================================

func TestSubmitPaymentRetriesOnTransientHorizonError(t *testing.T) {
	setAssetIssuer(t, testPayoutAssetCode, testAssetIssuer)
	userID := uuid.New()
	address := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(address, true)},
	}}
	executor, mockHorizon := newRealExecutorWithMockHorizon(t, resolver)
	executor.retryPolicy = minting.RetryPolicy{MaxAttempts: 2, BaseBackoff: 0}

	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: address}).
		Return(accountWithBalances(address, creditBalance(testPayoutAssetCode, testAssetIssuer, "0")), nil)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: executor.treasury.Address()}).
		Return(accountWithBalances(executor.treasury.Address()), nil)
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{}, newHorizonServerError()).Once()
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{Successful: true, Hash: "tx-after-retry"}, nil).Once()

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(userID, 100)}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutSucceeded, output.Beneficiaries[0].Status)
	assert.Equal(t, "tx-after-retry", output.Beneficiaries[0].TransactionHash)
	mockHorizon.AssertNumberOfCalls(t, "SubmitTransaction", 2)
}

// ============================================================================
// MockPayoutExecutor
// ============================================================================

func TestMockPayoutExecutorPaysResolvedBeneficiary(t *testing.T) {
	userID := uuid.New()
	address := keypair.MustRandom().Address()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet(address, true)},
	}}
	executor := NewMockPayoutExecutor(resolver)

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(userID, 50)}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutSucceeded, output.Beneficiaries[0].Status)
	assert.NotEmpty(t, output.Beneficiaries[0].TransactionHash)
	assert.Equal(t, DistributionStatusCompleted, output.Status)
}

func TestMockPayoutExecutorSimulatesMissingTrustline(t *testing.T) {
	userID := uuid.New()
	resolver := &fakeWalletResolver{wallets: map[string][]auth.UserWallet{
		userID.String(): {verifiedWallet("GNOTRUSTBENEFICIARYACCOUNT", true)},
	}}
	executor := NewMockPayoutExecutor(resolver)

	output := &DistributionOutput{Beneficiaries: []BeneficiaryAmount{beneficiary(userID, 50)}}
	err := executor.Execute(context.Background(), "dist-1", testPayoutAssetCode, output)
	require.NoError(t, err)

	assert.Equal(t, BeneficiaryPayoutFailed, output.Beneficiaries[0].Status)
	assert.Equal(t, ErrTrustlineMissing.Error(), output.Beneficiaries[0].FailureReason)
}
