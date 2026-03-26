package tokenization

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockMethodologyService struct {
	mock.Mock
}

func (m *MockMethodologyService) GetMethodologyTokenID(ctx context.Context, projectID uuid.UUID) (int, error) {
	args := m.Called(ctx, projectID)
	return args.Int(0), args.Error(1)
}

func TestWorkflow_Mint(t *testing.T) {
	client := NewMockStellarClient()
	monitor := NewMonitor()
	methService := new(MockMethodologyService)
	workflow := NewWorkflow(client, monitor, methService)

	projectID := uuid.New()
	methID := 123
	input := MintInput{
		ProjectID:   projectID,
		AssetCode:   "CRB2026",
		AssetIssuer: "ISSUER",
		Amount:      100,
		BatchSize:   1,
	}

	methService.On("GetMethodologyTokenID", mock.Anything, projectID).Return(methID, nil)

	outcome, err := workflow.Mint(context.Background(), input)

	assert.NoError(t, err)
	assert.NotNil(t, outcome)
	assert.Equal(t, methID, outcome.MethodologyTokenID)
	assert.Equal(t, "CRB2026", outcome.AssetCode)
	methService.AssertExpectations(t)
}

func TestWorkflow_Mint_InvalidMethodology(t *testing.T) {
	client := NewMockStellarClient()
	monitor := NewMonitor()
	methService := new(MockMethodologyService)
	workflow := NewWorkflow(client, monitor, methService)

	projectID := uuid.New()
	input := MintInput{
		ProjectID: projectID,
	}

	methService.On("GetMethodologyTokenID", mock.Anything, projectID).Return(0, nil)

	outcome, err := workflow.Mint(context.Background(), input)

	assert.Error(t, err)
	assert.Nil(t, outcome)
	assert.Contains(t, err.Error(), "no valid methodology token ID linked")
}
