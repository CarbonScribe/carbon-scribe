package methodology

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	projectToken map[uuid.UUID]int
	projectReg   map[uuid.UUID]*MethodologyRegistration
	tokenReg     map[int]*MethodologyRegistration
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{
		projectToken: make(map[uuid.UUID]int),
		projectReg:   make(map[uuid.UUID]*MethodologyRegistration),
		tokenReg:     make(map[int]*MethodologyRegistration),
	}
}

func (r *fakeRepository) GetMethodologyIDForProject(ctx context.Context, projectID uuid.UUID) (int, error) {
	return r.projectToken[projectID], nil
}

func (r *fakeRepository) GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*MethodologyRegistration, error) {
	registration, ok := r.projectReg[projectID]
	if !ok {
		return nil, errors.New("not found")
	}
	return registration, nil
}

func (r *fakeRepository) GetRegistrationByTokenID(ctx context.Context, tokenID int) (*MethodologyRegistration, error) {
	registration, ok := r.tokenReg[tokenID]
	if !ok {
		return nil, errors.New("not found")
	}
	return registration, nil
}

func (r *fakeRepository) CreateRegistration(ctx context.Context, registration *MethodologyRegistration) error {
	r.projectReg[registration.ProjectID] = registration
	r.tokenReg[registration.MethodologyTokenID] = registration
	return nil
}

func (r *fakeRepository) UpdateProjectMethodology(ctx context.Context, projectID uuid.UUID, tokenID int, contractID string) error {
	r.projectToken[projectID] = tokenID
	return nil
}

type fakeContractClient struct {
	contractID string
	tokenID    int
	valid      bool
	err        error
}

func (c *fakeContractClient) MintMethodology(ctx context.Context, owner string, meta MethodologyMeta) (int, string, error) {
	if c.err != nil {
		return 0, "", c.err
	}
	return c.tokenID, "test_tx", nil
}

func (c *fakeContractClient) IsValidMethodology(ctx context.Context, tokenID int) (bool, error) {
	if c.err != nil {
		return false, c.err
	}
	return c.valid && tokenID == c.tokenID, nil
}

func (c *fakeContractClient) ContractID() string {
	return c.contractID
}

func TestServiceRegisterMethodology(t *testing.T) {
	repo := newFakeRepository()
	chain := &fakeContractClient{contractID: DefaultMethodologyContractID, tokenID: 42, valid: true}
	svc := NewService(repo, chain)
	projectID := uuid.New()

	resp, err := svc.RegisterMethodology(context.Background(), projectID, RegisterMethodologyRequest{
		Name:             "Improved Forest Management",
		Version:          "VM0042 v2.1",
		Registry:         "VERRA",
		RegistryLink:     "https://registry.example/VM0042",
		IssuingAuthority: "GAUTHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		OwnerAddress:     "GOWNRXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		IPFSCID:          "bafyabc123",
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, 42, resp.MethodologyTokenID)
	assert.Equal(t, DefaultMethodologyContractID, resp.ContractID)
}

func TestServiceValidateProjectMethodology(t *testing.T) {
	repo := newFakeRepository()
	projectID := uuid.New()
	repo.projectToken[projectID] = 77
	chain := &fakeContractClient{contractID: DefaultMethodologyContractID, tokenID: 77, valid: true}
	svc := NewService(repo, chain)

	tokenID, err := svc.ValidateProjectMethodology(context.Background(), projectID)

	assert.NoError(t, err)
	assert.Equal(t, 77, tokenID)
}

func TestServiceValidateMethodologyFallbackToRepository(t *testing.T) {
	repo := newFakeRepository()
	repo.tokenReg[17] = &MethodologyRegistration{MethodologyTokenID: 17, ContractID: DefaultMethodologyContractID}
	chain := &fakeContractClient{contractID: DefaultMethodologyContractID, err: errors.New("rpc unavailable")}
	svc := NewService(repo, chain)

	valid, err := svc.ValidateMethodology(context.Background(), 17)

	assert.NoError(t, err)
	assert.True(t, valid)
}
