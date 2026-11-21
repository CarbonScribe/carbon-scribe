package minting

import (
	"testing"

	"github.com/stellar/go/keypair"
	"github.com/stretchr/testify/assert"
)

// #793: resolveOwnerAddress uses the project's own registered wallet when
// present, never consulting the environment-configured fallback.
func TestResolveOwnerAddress_UsesProjectWalletWhenPresent(t *testing.T) {
	clearMintingEnv(t)
	kp, err := keypair.Random()
	assert.NoError(t, err)

	address, err := resolveOwnerAddress(kp.Address())
	assert.NoError(t, err)
	assert.Equal(t, kp.Address(), address)
}

// #793: two projects with different wallets must resolve to different
// addresses.
func TestResolveOwnerAddress_DifferentProjectsResolveToDifferentAddresses(t *testing.T) {
	clearMintingEnv(t)
	kp1, _ := keypair.Random()
	kp2, _ := keypair.Random()

	address1, err1 := resolveOwnerAddress(kp1.Address())
	address2, err2 := resolveOwnerAddress(kp2.Address())

	assert.NoError(t, err1)
	assert.NoError(t, err2)
	assert.NotEqual(t, address1, address2)
}

// #793: a project with no registered wallet fails with a clear, descriptive
// error when the default-owner fallback isn't opted into.
func TestResolveOwnerAddress_MissingWalletFailsWithoutOptIn(t *testing.T) {
	clearMintingEnv(t)

	address, err := resolveOwnerAddress("")
	assert.Error(t, err)
	assert.Empty(t, address)
	assert.Contains(t, err.Error(), "no registered Stellar wallet")
}

func TestResolveOwnerAddress_BlankWalletIsTreatedAsMissing(t *testing.T) {
	clearMintingEnv(t)

	address, err := resolveOwnerAddress("   ")
	assert.Error(t, err)
	assert.Empty(t, address)
}

// #793: resolveDefaultOwnerAddress is opt-in only.
func TestResolveDefaultOwnerAddress_NotEnabledByDefault(t *testing.T) {
	clearMintingEnv(t)
	kp, _ := keypair.Random()
	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", kp.Address())

	address, err := resolveDefaultOwnerAddress()
	assert.Error(t, err)
	assert.Empty(t, address)
	assert.Contains(t, err.Error(), MintingAllowDefaultOwnerEnvVar)
}

// #793: the production fallback is refused even when explicitly opted in.
func TestResolveDefaultOwnerAddress_RefusedInProduction(t *testing.T) {
	clearMintingEnv(t)
	kp, _ := keypair.Random()
	t.Setenv(MintingAllowDefaultOwnerEnvVar, "true")
	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", kp.Address())
	t.Setenv("SERVER_MODE", "production")

	address, err := resolveDefaultOwnerAddress()
	assert.Error(t, err)
	assert.Empty(t, address)
	assert.Contains(t, err.Error(), "not permitted in production")
}

func TestResolveDefaultOwnerAddress_AllowedOutsideProductionWhenOptedIn(t *testing.T) {
	clearMintingEnv(t)
	kp, _ := keypair.Random()
	t.Setenv(MintingAllowDefaultOwnerEnvVar, "true")
	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", kp.Address())
	t.Setenv("SERVER_MODE", "development")

	address, err := resolveDefaultOwnerAddress()
	assert.NoError(t, err)
	assert.Equal(t, kp.Address(), address)
}

// #793: the minting authority's own public key must never be used as the
// fallback recipient, even if it's the only thing configured.
func TestResolveDefaultOwnerAddress_NeverUsesAuthorityPublicKey(t *testing.T) {
	clearMintingEnv(t)
	kp, _ := keypair.Random()
	t.Setenv(MintingAllowDefaultOwnerEnvVar, "true")
	t.Setenv("SERVER_MODE", "development")
	t.Setenv("CARBON_ASSET_AUTHORITY_PUBLIC_KEY", kp.Address())

	address, err := resolveDefaultOwnerAddress()
	assert.Error(t, err)
	assert.Empty(t, address)
}

func TestResolveDefaultOwnerAddress_FallsBackToStellarPublicKey(t *testing.T) {
	clearMintingEnv(t)
	kp, _ := keypair.Random()
	t.Setenv(MintingAllowDefaultOwnerEnvVar, "true")
	t.Setenv("SERVER_MODE", "development")
	t.Setenv("STELLAR_PUBLIC_KEY", kp.Address())

	address, err := resolveDefaultOwnerAddress()
	assert.NoError(t, err)
	assert.Equal(t, kp.Address(), address)
}

func TestResolveDefaultOwnerAddress_RejectsMalformedAddress(t *testing.T) {
	clearMintingEnv(t)
	t.Setenv(MintingAllowDefaultOwnerEnvVar, "true")
	t.Setenv("SERVER_MODE", "development")
	t.Setenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER", "not-a-valid-address")

	address, err := resolveDefaultOwnerAddress()
	assert.Error(t, err)
	assert.Empty(t, address)
}
