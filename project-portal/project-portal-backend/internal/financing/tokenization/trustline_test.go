package tokenization

import (
	"context"
	"testing"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/base"
	"github.com/stellar/go/support/render/problem"
	"github.com/stellar/go/txnbuild"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const testAssetCode = "USDC"

// testBuyerAddress and testAssetIssuer are real, checksum-valid Stellar
// public keys (generated once for the whole test binary) so that txnbuild's
// strkey decoding/validation behaves exactly as it would in production,
// instead of silently no-op'ing on a hand-typed placeholder string.
var (
	testBuyerAddress = keypair.MustRandom().Address()
	testAssetIssuer  = keypair.MustRandom().Address()
)

func newHorizonNotFoundError() error {
	return &horizonclient.Error{
		Problem: problem.P{
			Type:   "https://stellar.org/horizon-errors/not_found",
			Title:  "Resource Missing",
			Status: 404,
		},
	}
}

func newHorizonNoTrustError() error {
	return &horizonclient.Error{
		Problem: problem.P{
			Type:   "transaction_failed",
			Title:  "Transaction Failed",
			Status: 400,
			Extras: map[string]any{
				"result_codes": map[string]any{
					"transaction": "tx_failed",
					"operations":  []any{"op_no_trust"},
				},
			},
		},
	}
}

func newRealClientWithMockHorizon(t *testing.T) (*RealStellarClient, *horizonclient.MockClient) {
	t.Helper()
	authority, err := keypair.Random()
	require.NoError(t, err)
	mockHorizon := &horizonclient.MockClient{}
	client := &RealStellarClient{
		contractID:        DefaultCarbonAssetContractID,
		horizon:           mockHorizon,
		networkPassphrase: "Test SDF Network ; September 2015",
		authority:         authority,
	}
	return client, mockHorizon
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

// ============================================================================
// hasTrustlineInBalances / defaultTrustlineLimit (pure helpers)
// ============================================================================

func TestHasTrustlineInBalancesFound(t *testing.T) {
	balances := []hProtocol.Balance{creditBalance("USDC", testAssetIssuer, "0")}
	assert.True(t, hasTrustlineInBalances(balances, "USDC", testAssetIssuer))
}

func TestHasTrustlineInBalancesNotFound(t *testing.T) {
	balances := []hProtocol.Balance{creditBalance("EURT", testAssetIssuer, "50")}
	assert.False(t, hasTrustlineInBalances(balances, "USDC", testAssetIssuer))
}

func TestDefaultTrustlineLimitConfigured(t *testing.T) {
	DefaultTrustlineLimits["TESTCODE"] = "1000000"
	defer delete(DefaultTrustlineLimits, "TESTCODE")

	assert.Equal(t, "1000000", defaultTrustlineLimit("testcode"))
}

func TestDefaultTrustlineLimitFallsBackToMax(t *testing.T) {
	assert.Equal(t, txnbuild.MaxTrustlineLimit, defaultTrustlineLimit("UNCONFIGURED_CODE"))
}

// ============================================================================
// IsNoTrustlineHorizonError
// ============================================================================

func TestIsNoTrustlineHorizonErrorDetectsOpNoTrust(t *testing.T) {
	assert.True(t, IsNoTrustlineHorizonError(newHorizonNoTrustError()))
}

func TestIsNoTrustlineHorizonErrorFalseForOtherErrors(t *testing.T) {
	assert.False(t, IsNoTrustlineHorizonError(newHorizonNotFoundError()))
	assert.False(t, IsNoTrustlineHorizonError(assert.AnError))
}

// ============================================================================
// MockStellarClient trustline behavior
// ============================================================================

func TestMockBuildTrustlineTransactionReturnsXDR(t *testing.T) {
	client := NewMockStellarClient()
	resp, err := client.BuildTrustlineTransaction(context.Background(), TrustlineRequest{
		BuyerAddress: testBuyerAddress,
		AssetCode:    "USDC",
		AssetIssuer:  testAssetIssuer,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.TransactionXDR)
	assert.Equal(t, "USDC", resp.AssetCode)
	assert.Equal(t, txnbuild.MaxTrustlineLimit, resp.Limit)
}

func TestMockBuildTrustlineTransactionRejectsUnfundedBuyer(t *testing.T) {
	client := NewMockStellarClient()
	_, err := client.BuildTrustlineTransaction(context.Background(), TrustlineRequest{
		BuyerAddress: "GUNFUNDEDBUYERACCOUNT",
		AssetCode:    "USDC",
		AssetIssuer:  testAssetIssuer,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrBuyerAccountNotFound)
}

func TestMockHasTrustlineEstablishedByDefault(t *testing.T) {
	client := NewMockStellarClient()
	ok, err := client.HasTrustline(context.Background(), testBuyerAddress, "USDC", testAssetIssuer)
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestMockHasTrustlineRemoved(t *testing.T) {
	client := NewMockStellarClient()
	ok, err := client.HasTrustline(context.Background(), "GNOTRUSTBUYERACCOUNT", "USDC", testAssetIssuer)
	require.NoError(t, err)
	assert.False(t, ok)
}

// ============================================================================
// RealStellarClient.BuildTrustlineTransaction (via mocked horizon)
// ============================================================================

func TestRealBuildTrustlineTransactionSuccess(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress), nil)

	resp, err := client.BuildTrustlineTransaction(context.Background(), TrustlineRequest{
		BuyerAddress: testBuyerAddress,
		AssetCode:    testAssetCode,
		AssetIssuer:  testAssetIssuer,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.TransactionXDR)
	assert.Equal(t, testAssetCode, resp.AssetCode)
	assert.Equal(t, testAssetIssuer, resp.AssetIssuer)
	mockHorizon.AssertExpectations(t)
}

func TestRealBuildTrustlineTransactionRejectsUnknownBuyer(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(hProtocol.Account{}, newHorizonNotFoundError())

	_, err := client.BuildTrustlineTransaction(context.Background(), TrustlineRequest{
		BuyerAddress: testBuyerAddress,
		AssetCode:    testAssetCode,
		AssetIssuer:  testAssetIssuer,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrBuyerAccountNotFound)
	mockHorizon.AssertExpectations(t)
}

func TestRealBuildTrustlineTransactionUsesConfiguredLimit(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress), nil)

	resp, err := client.BuildTrustlineTransaction(context.Background(), TrustlineRequest{
		BuyerAddress: testBuyerAddress,
		AssetCode:    testAssetCode,
		AssetIssuer:  testAssetIssuer,
		Limit:        "500",
	})
	require.NoError(t, err)
	assert.Equal(t, "500", resp.Limit)
}

// ============================================================================
// RealStellarClient.HasTrustline / ensureRecipientTrustline (established, missing, removed)
// ============================================================================

func TestRealHasTrustlineEstablished(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress, creditBalance(testAssetCode, testAssetIssuer, "10")), nil)

	ok, err := client.HasTrustline(context.Background(), testBuyerAddress, testAssetCode, testAssetIssuer)
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestRealHasTrustlineMissing(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress), nil)

	ok, err := client.HasTrustline(context.Background(), testBuyerAddress, testAssetCode, testAssetIssuer)
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestEnsureRecipientTrustlineBlocksMintWhenMissing(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress), nil)

	err := client.ensureRecipientTrustline(context.Background(), testBuyerAddress, testAssetCode)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrTrustlineMissing)
}

func TestEnsureRecipientTrustlineAllowsMintWhenEstablished(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress, creditBalance(testAssetCode, client.authority.Address(), "10")), nil)

	err := client.ensureRecipientTrustline(context.Background(), testBuyerAddress, testAssetCode)
	assert.NoError(t, err)
}

func TestEnsureRecipientTrustlineDetectsRemovedTrustline(t *testing.T) {
	// Simulates a trustline that existed at onboarding but was later removed
	// by the account holder: the re-check immediately before transfer must
	// still catch it, since only a fresh Horizon lookup reflects removal.
	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: testBuyerAddress}).
		Return(accountWithBalances(testBuyerAddress), nil).Once()

	err := client.ensureRecipientTrustline(context.Background(), testBuyerAddress, testAssetCode)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrTrustlineMissing)
	mockHorizon.AssertExpectations(t)
}

// ============================================================================
// AuthorizeTrustlineIfRequired
// ============================================================================

func TestAuthorizeTrustlineIfRequiredNoopWhenNotConfigured(t *testing.T) {
	client, mockHorizon := newRealClientWithMockHorizon(t)
	err := client.AuthorizeTrustlineIfRequired(context.Background(), testBuyerAddress, "UNRESTRICTED")
	require.NoError(t, err)
	mockHorizon.AssertNotCalled(t, "AccountDetail")
}

func TestAuthorizeTrustlineIfRequiredSubmitsWhenConfigured(t *testing.T) {
	AssetsRequiringAuthorization["RESTRICTED"] = true
	defer delete(AssetsRequiringAuthorization, "RESTRICTED")

	client, mockHorizon := newRealClientWithMockHorizon(t)
	mockHorizon.On("AccountDetail", horizonclient.AccountRequest{AccountID: client.authority.Address()}).
		Return(accountWithBalances(client.authority.Address()), nil)
	mockHorizon.On("SubmitTransaction", mock.Anything).
		Return(hProtocol.Transaction{Successful: true}, nil)

	err := client.AuthorizeTrustlineIfRequired(context.Background(), testBuyerAddress, "restricted")
	require.NoError(t, err)
	mockHorizon.AssertExpectations(t)
}
