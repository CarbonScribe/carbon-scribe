package methodology

import (
	"testing"

	"github.com/stellar/go/xdr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildMethodologyMetaVal(t *testing.T) {
	val, err := buildMethodologyMetaVal(MethodologyMeta{
		Name:             "Improved Forest Management",
		Version:          "VM0042 v2.1",
		Registry:         "VERRA",
		RegistryLink:     "https://verra.org",
		IssuingAuthority: "GB7BDSZU2Y27LYNLALKKALB52WS2IZWYBDGY6EQBLEED3TJOCVMZRH7H",
	})

	require.NoError(t, err)
	require.Equal(t, xdr.ScValTypeScvMap, val.Type)
	entries := *val.MustMap()
	require.Len(t, entries, 6)
	assert.Equal(t, "ipfs_cid", string(entries[0].Key.MustSym()))
	assert.Equal(t, xdr.ScValTypeScvVoid, entries[0].Val.Type)
	assert.Equal(t, "issuing_authority", string(entries[1].Key.MustSym()))
	assert.Equal(t, xdr.ScValTypeScvAddress, entries[1].Val.Type)
	assert.Equal(t, "name", string(entries[2].Key.MustSym()))
	assert.Equal(t, "Improved Forest Management", string(entries[2].Val.MustStr()))
}

func TestExtractMintTokenIDFromEvents(t *testing.T) {
	mintTopic, err := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol("mint"))
	require.NoError(t, err)
	voidTopic, err := xdr.NewScVal(xdr.ScValTypeScvVoid, nil)
	require.NoError(t, err)

	tokenID, err := extractMintTokenIDFromEvents([]xdr.ContractEvent{
		{
			Type: xdr.ContractEventTypeContract,
			Body: xdr.ContractEventBody{
				V: 0,
				V0: &xdr.ContractEventV0{
					Topics: []xdr.ScVal{mintTopic, u32Val(17)},
					Data:   voidTopic,
				},
			},
		},
	})

	require.NoError(t, err)
	assert.Equal(t, 17, tokenID)
}
