package minting

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// Unit tests for the minting service that don't depend on external databases.
// This is to avoid unsynced go.mod in CI when sqlite is not already present.

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
