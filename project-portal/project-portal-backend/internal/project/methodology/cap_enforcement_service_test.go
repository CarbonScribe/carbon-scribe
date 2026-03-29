package methodology

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type fakeCapRepo struct {
	caps                map[int]*MethodologyCap
	lastSource          *CapConfigurationSource
	lastValidationInput *MintValidationInput
	attempts            []MintingAttempt
}

func newFakeCapRepo() *fakeCapRepo {
	return &fakeCapRepo{caps: map[int]*MethodologyCap{}}
}

func (f *fakeCapRepo) GetMethodologyCap(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error) {
	cap, ok := f.caps[methodologyTokenID]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	copyCap := *cap
	return &copyCap, nil
}

func (f *fakeCapRepo) UpsertMethodologyCap(ctx context.Context, cap *MethodologyCap) error {
	copied := *cap
	if copied.ID == uuid.Nil {
		copied.ID = uuid.New()
	}
	f.caps[cap.MethodologyTokenID] = &copied
	return nil
}

func (f *fakeCapRepo) RecordCapConfigurationSource(ctx context.Context, source *CapConfigurationSource) error {
	copied := *source
	f.lastSource = &copied
	return nil
}

func (f *fakeCapRepo) ListMintingAttemptsByMethodology(ctx context.Context, methodologyTokenID int, limit int) ([]MintingAttempt, error) {
	return f.attempts, nil
}

func (f *fakeCapRepo) ListMintingAttemptsByProject(ctx context.Context, projectID uuid.UUID, limit int) ([]MintingAttempt, error) {
	return f.attempts, nil
}

func (f *fakeCapRepo) ListCapsNearLimit(ctx context.Context, thresholdRatio float64) ([]MethodologyCap, error) {
	out := make([]MethodologyCap, 0, len(f.caps))
	for _, cap := range f.caps {
		if cap.MaxSupply == 0 {
			continue
		}
		if float64(cap.CurrentSupply)/float64(cap.MaxSupply) >= thresholdRatio {
			out = append(out, *cap)
		}
	}
	return out, nil
}

func (f *fakeCapRepo) ValidateAndExecuteMint(ctx context.Context, input MintValidationInput, executeMint func(context.Context) error) (*MintingAttempt, error) {
	f.lastValidationInput = &input
	if err := executeMint(ctx); err != nil {
		return nil, err
	}
	attempt := &MintingAttempt{ID: uuid.New(), MethodologyTokenID: input.MethodologyTokenID, ProjectID: input.ProjectID, RequestedAmount: input.RequestedAmount, Approved: true, AttemptedAt: time.Now().UTC()}
	f.attempts = append(f.attempts, *attempt)
	return attempt, nil
}

type fakeBaseRepo struct{}

func (f *fakeBaseRepo) GetMethodologyIDForProject(ctx context.Context, projectID uuid.UUID) (int, error) {
	return 0, nil
}
func (f *fakeBaseRepo) GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*MethodologyRegistration, error) {
	return nil, gorm.ErrRecordNotFound
}
func (f *fakeBaseRepo) GetRegistrationByTokenID(ctx context.Context, tokenID int) (*MethodologyRegistration, error) {
	return &MethodologyRegistration{MethodologyTokenID: tokenID}, nil
}
func (f *fakeBaseRepo) CreateRegistration(ctx context.Context, registration *MethodologyRegistration) error {
	return nil
}
func (f *fakeBaseRepo) UpdateProjectMethodology(ctx context.Context, projectID uuid.UUID, tokenID int, contractID string) error {
	return nil
}

type fakeCapClient struct{}

func (f *fakeCapClient) GetSupplyCapConfiguration(ctx context.Context, methodologyTokenID int) (*CapConfigEnvelope, error) {
	projectCap := int64(200)
	vintageCap := int64(150)
	return &CapConfigEnvelope{
		MethodologyTokenID: methodologyTokenID,
		MaxSupply:          1000,
		CapPerProject:      &projectCap,
		CapPerVintage:      &vintageCap,
		RawConfiguration:   map[string]any{"max_supply": 1000},
		SourceType:         CapSourceContract,
		SourceReference:    "mock-contract",
	}, nil
}

func TestEnsureCapConfiguredLoadsFromClient(t *testing.T) {
	repo := newFakeCapRepo()
	svc := NewCapEnforcementService(repo, &fakeBaseRepo{}, &fakeCapClient{})

	cap, err := svc.EnsureCapConfigured(context.Background(), 42)
	require.NoError(t, err)
	require.NotNil(t, cap)
	assert.Equal(t, 42, cap.MethodologyTokenID)
	assert.Equal(t, int64(1000), cap.MaxSupply)
	assert.NotNil(t, repo.lastSource)
	assert.Equal(t, CapSourceContract, repo.lastSource.SourceType)
}

func TestValidateAndExecuteMintCallsExecution(t *testing.T) {
	repo := newFakeCapRepo()
	repo.caps[77] = &MethodologyCap{MethodologyTokenID: 77, MaxSupply: 1000, CurrentSupply: 100, EffectiveFrom: time.Now().UTC()}
	svc := NewCapEnforcementService(repo, &fakeBaseRepo{}, nil)

	executed := false
	attempt, err := svc.ValidateAndExecuteMint(context.Background(), MintValidationInput{
		MethodologyTokenID: 77,
		ProjectID:          uuid.New(),
		RequestedAmount:    10,
	}, func(ctx context.Context) error {
		executed = true
		return nil
	})

	require.NoError(t, err)
	assert.True(t, executed)
	require.NotNil(t, attempt)
	assert.True(t, attempt.Approved)
}

func TestGetMethodologySupplyCalculatesNearLimit(t *testing.T) {
	repo := newFakeCapRepo()
	repo.caps[9] = &MethodologyCap{MethodologyTokenID: 9, MaxSupply: 1000, CurrentSupply: 920, EffectiveFrom: time.Now().UTC()}
	svc := NewCapEnforcementService(repo, &fakeBaseRepo{}, nil)

	supply, err := svc.GetMethodologySupply(context.Background(), 9)
	require.NoError(t, err)
	assert.Equal(t, int64(80), supply.RemainingSupply)
	assert.True(t, supply.NearLimit)
}

func TestCreditsToCapUnitsRoundsUp(t *testing.T) {
	assert.Equal(t, int64(1), CreditsToCapUnits(0.1))
	assert.Equal(t, int64(2), CreditsToCapUnits(1.1))
	assert.Equal(t, int64(0), CreditsToCapUnits(0))
}
