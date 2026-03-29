package tokenization

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stellar/go/xdr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMockMintReturnsTokens(t *testing.T) {
	client := NewMockStellarClient()
	resp, err := client.Mint(context.Background(), MintRequest{
		AssetCode:     "CRB2024",
		AssetIssuer:   "GTESTISSUER",
		Amount:        2,
		BatchSize:     1,
		MethodologyID: 101,
		ProjectID:     uuid.New(),
		VintageYear:   2024,
	})

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.TransactionHash)
	assert.GreaterOrEqual(t, len(resp.TokenIDs), 1)
}

func TestBuildMetadataValIncludesMethodology(t *testing.T) {
	projectID := uuid.New()
	val, err := buildMetadataVal(MintRequest{
		MethodologyID: 88,
		ProjectID:     projectID,
		VintageYear:   2025,
		Amount:        10,
	})
	require.NoError(t, err)
	require.Equal(t, xdr.ScValTypeScvMap, val.Type)

	entries := val.MustMap()
	foundMethodology := false
	for _, e := range *entries {
		if e.Key.Type == xdr.ScValTypeScvSymbol && string(e.Key.MustSym()) == "methodology_id" {
			foundMethodology = true
			assert.Equal(t, xdr.ScValTypeScvU32, e.Val.Type)
			assert.Equal(t, uint32(88), uint32(e.Val.MustU32()))
		}
	}
	assert.True(t, foundMethodology)
}

func TestScAddressValRejectsInvalidAddress(t *testing.T) {
	_, err := scAddressVal("NOT_A_STELLAR_ADDRESS")
	require.Error(t, err)
}
