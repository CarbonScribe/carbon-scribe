package minting

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stellar/go/keypair"
	"github.com/stretchr/testify/assert"
)

// fakeContractClient is an explicit test double injected directly via
// NewService's client parameter, rather than relying on env-var absence
// falling back to the package's own mockContractClient.
type fakeContractClient struct {
	tokenID int
	txHash  string
	err     error
}

func (f *fakeContractClient) Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (int, string, error) {
	return f.tokenID, f.txHash, f.err
}

func clearMintingEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		MintingUseMockClientEnvVar,
		"CARBON_ASSET_AUTHORITY_SECRET_KEY",
		"STELLAR_SECRET_KEY",
		"CARBON_ASSET_CONTRACT_ID",
		"STELLAR_RPC_URL",
		"STELLAR_NETWORK_PASSPHRASE",
		"CARBON_ASSET_DEFAULT_PROJECT_OWNER",
		"CARBON_ASSET_AUTHORITY_PUBLIC_KEY",
		"STELLAR_PUBLIC_KEY",
	} {
		t.Setenv(key, "")
	}
}

// Unit tests for the minting service that don't depend on external databases.
// This is to avoid unsynced go.mod in CI when sqlite is not already present.

func TestMintingConstants(t *testing.T) {
	assert.Equal(t, 15, DefaultPollAttempts)
	assert.Equal(t, 2*time.Second, DefaultPollInterval)
	assert.Equal(t, int64(300), int64(MintTransactionTimeoutSeconds))
}

func TestMintingMetadataPreparation(t *testing.T) {
	projectID := uuid.New()
	
	// Testing internal logic that we can verify without a DB
	assert.NotEqual(t, uuid.Nil, projectID)
}

func TestMockMinting(t *testing.T) {
	mockClient := &mockContractClient{}
	ctx := context.Background()
	
	projectID := uuid.New()
	metadata := CarbonAssetMetadata{
		ProjectID:     projectID.String(),
		VintageYear:   2024,
		MethodologyID: 123,
	}

	tokenID, txHash, err := mockClient.Mint(ctx, "G_OWNER", metadata)

	assert.NoError(t, err)
	assert.NotEmpty(t, txHash)
	assert.Greater(t, tokenID, 0)
}

func TestNewServicePanicsOnNilClient(t *testing.T) {
	assert.Panics(t, func() {
		NewService(nil, nil, nil)
	})
}

func TestNewServiceAcceptsExplicitClientInjection(t *testing.T) {
	client := &fakeContractClient{tokenID: 7, txHash: "REAL_TX_HASH"}
	svc := NewService(nil, client, nil)
	assert.NotNil(t, svc)

	impl, ok := svc.(*service)
	assert.True(t, ok)
	assert.Same(t, CarbonAssetContractClient(client), impl.contractClient)
}

func TestNewContractClientFromEnv_NoKeyConfigured_NeverImplicitlyMocks(t *testing.T) {
	clearMintingEnv(t)

	for _, isProduction := range []bool{true, false} {
		client, err := NewContractClientFromEnv(isProduction)
		assert.Error(t, err, "isProduction=%v", isProduction)
		assert.Nil(t, client, "isProduction=%v", isProduction)
		assert.Contains(t, err.Error(), "CARBON_ASSET_AUTHORITY_SECRET_KEY")
	}
}

func TestNewContractClientFromEnv_InvalidKey_FailsLoudlyInsteadOfMocking(t *testing.T) {
	clearMintingEnv(t)
	t.Setenv("CARBON_ASSET_AUTHORITY_SECRET_KEY", "not-a-valid-stellar-seed")

	for _, isProduction := range []bool{true, false} {
		client, err := NewContractClientFromEnv(isProduction)
		assert.Error(t, err, "isProduction=%v", isProduction)
		assert.Nil(t, client, "isProduction=%v", isProduction)
	}
}

func TestNewContractClientFromEnv_MockOptIn_RejectedInProduction(t *testing.T) {
	clearMintingEnv(t)
	t.Setenv(MintingUseMockClientEnvVar, "true")

	client, err := NewContractClientFromEnv(true)
	assert.Error(t, err)
	assert.Nil(t, client)
	assert.Contains(t, err.Error(), "not permitted in production")
}

func TestNewContractClientFromEnv_MockOptIn_AllowedOutsideProduction(t *testing.T) {
	clearMintingEnv(t)
	t.Setenv(MintingUseMockClientEnvVar, "true")

	client, err := NewContractClientFromEnv(false)
	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.True(t, isMockContractClient(client))
}

func TestNewContractClientFromEnv_ValidKey_ReturnsRealClient(t *testing.T) {
	clearMintingEnv(t)
	kp, err := keypair.Random()
	assert.NoError(t, err)
	t.Setenv("CARBON_ASSET_AUTHORITY_SECRET_KEY", kp.Seed())

	client, err := NewContractClientFromEnv(true)
	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.False(t, isMockContractClient(client))
	_, ok := client.(*realContractClient)
	assert.True(t, ok)
}

func TestIsMockContractClient(t *testing.T) {
	assert.True(t, isMockContractClient(&mockContractClient{}))
	assert.False(t, isMockContractClient(&fakeContractClient{}))
}

func TestResolveDefaultOwnerAddress_MissingEnv_FailsExplicitly(t *testing.T) {
	clearMintingEnv(t)

	address, err := resolveDefaultOwnerAddress()
	assert.Error(t, err)
	assert.Empty(t, address)
	assert.Contains(t, err.Error(), "CARBON_ASSET_DEFAULT_PROJECT_OWNER")
}

func TestResolveDefaultOwnerAddress_MalformedValue_FailsExplicitly(t *testing.T) {
	clearMintingEnv(t)
	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", "not-a-stellar-address")

	address, err := resolveDefaultOwnerAddress()
	assert.Error(t, err)
	assert.Empty(t, address)
	assert.Contains(t, err.Error(), "not a valid Stellar account address")
}

func TestResolveDefaultOwnerAddress_ValidValue_Succeeds(t *testing.T) {
	clearMintingEnv(t)
	kp, err := keypair.Random()
	assert.NoError(t, err)
	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", kp.Address())

	address, err := resolveDefaultOwnerAddress()
	assert.NoError(t, err)
	assert.Equal(t, kp.Address(), address)
}

func TestResolveDefaultOwnerAddress_PrefersMostSpecificEnvVar(t *testing.T) {
	clearMintingEnv(t)
	primary, err := keypair.Random()
	assert.NoError(t, err)
	fallback, err := keypair.Random()
	assert.NoError(t, err)

	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", primary.Address())
	t.Setenv("STELLAR_PUBLIC_KEY", fallback.Address())

	address, err := resolveDefaultOwnerAddress()
	assert.NoError(t, err)
	assert.Equal(t, primary.Address(), address)
}
