package stellar

import (
	"testing"

	"github.com/stellar/go/xdr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractCapsFromFlatPayload(t *testing.T) {
	payload := map[string]any{
		"max_supply":      1000,
		"cap_per_project": 300,
		"cap_per_vintage": 120,
	}

	maxSupply, perProject, perVintage, ok := extractCaps(payload)
	require.True(t, ok)
	assert.Equal(t, int64(1000), maxSupply)
	require.NotNil(t, perProject)
	require.NotNil(t, perVintage)
	assert.Equal(t, int64(300), *perProject)
	assert.Equal(t, int64(120), *perVintage)
}

func TestExtractCapsFromNestedPayload(t *testing.T) {
	payload := map[string]any{
		"limits": map[string]any{
			"supplyCap":  "5000",
			"projectCap": 250,
		},
	}

	maxSupply, perProject, perVintage, ok := extractCaps(payload)
	require.True(t, ok)
	assert.Equal(t, int64(5000), maxSupply)
	require.NotNil(t, perProject)
	assert.Equal(t, int64(250), *perProject)
	assert.Nil(t, perVintage)
}

func TestParseInt64Variants(t *testing.T) {
	v, ok := parseInt64("42")
	require.True(t, ok)
	assert.Equal(t, int64(42), v)

	v, ok = parseInt64(float64(19))
	require.True(t, ok)
	assert.Equal(t, int64(19), v)

	_, ok = parseInt64(struct{}{})
	assert.False(t, ok)
}

func TestScValToAnyMapRoundTrip(t *testing.T) {
	key, err := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol("max_supply"))
	require.NoError(t, err)
	val, err := xdr.NewScVal(xdr.ScValTypeScvU32, xdr.Uint32(123))
	require.NoError(t, err)
	entries := xdr.ScMap{{Key: key, Val: val}}
	mapVal, err := xdr.NewScVal(xdr.ScValTypeScvMap, &entries)
	require.NoError(t, err)

	out := scValToAny(mapVal)
	m, ok := out.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, int64(123), m["max_supply"])
}
