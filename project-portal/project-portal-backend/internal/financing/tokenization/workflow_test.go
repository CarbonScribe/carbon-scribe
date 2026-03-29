package tokenization

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
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

func (m *MockMethodologyService) ValidateProjectMethodology(ctx context.Context, projectID uuid.UUID) (int, error) {
	args := m.Called(ctx, projectID)
	return args.Int(0), args.Error(1)
}

func (m *MockMethodologyService) RegisterMethodology(ctx context.Context, projectID uuid.UUID, req methodology.RegisterMethodologyRequest) (*methodology.MethodologyRegistrationResponse, error) {
	args := m.Called(ctx, projectID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*methodology.MethodologyRegistrationResponse), args.Error(1)
}

func (m *MockMethodologyService) GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*methodology.MethodologyRegistrationResponse, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*methodology.MethodologyRegistrationResponse), args.Error(1)
}

func (m *MockMethodologyService) ValidateMethodology(ctx context.Context, tokenID int) (bool, error) {
	args := m.Called(ctx, tokenID)
	return args.Bool(0), args.Error(1)
}

func (m *MockMethodologyService) ContractID() string {
	args := m.Called()
	return args.String(0)
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

	methService.On("ValidateProjectMethodology", mock.Anything, projectID).Return(methID, nil)

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

	methService.On("ValidateProjectMethodology", mock.Anything, projectID).Return(0, nil)

	outcome, err := workflow.Mint(context.Background(), input)

	assert.Error(t, err)
	assert.Nil(t, outcome)
	assert.Contains(t, err.Error(), "no valid methodology token ID linked")
}
