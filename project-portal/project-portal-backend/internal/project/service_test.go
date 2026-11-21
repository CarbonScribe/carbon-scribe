package project

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stellar/go/keypair"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	created *Project
	stored  map[uuid.UUID]*Project
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{stored: map[uuid.UUID]*Project{}}
}

func (r *fakeRepository) Create(ctx context.Context, project *Project) error {
	project.ID = uuid.New()
	r.created = project
	r.stored[project.ID] = project
	return nil
}

func (r *fakeRepository) GetByID(ctx context.Context, id uuid.UUID) (*Project, error) {
	p, ok := r.stored[id]
	if !ok {
		return nil, assert.AnError
	}
	return p, nil
}

func (r *fakeRepository) List(ctx context.Context, limit, offset int) ([]Project, error) {
	return nil, nil
}

func (r *fakeRepository) Update(ctx context.Context, project *Project) error {
	r.stored[project.ID] = project
	return nil
}

func (r *fakeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.stored, id)
	return nil
}

// #793: a project can be created with a validated Stellar wallet address.
func TestCreateProject_ValidWalletAddressIsStored(t *testing.T) {
	repo := newFakeRepository()
	svc := NewService(repo, nil, nil, nil)
	kp, err := keypair.Random()
	assert.NoError(t, err)

	created, err := svc.CreateProject(context.Background(), &ProjectCreateRequest{
		Name:                 "Test Project",
		Type:                 "Reforestation",
		Location:             "Somewhere",
		Area:                 10,
		StellarWalletAddress: kp.Address(),
	})

	assert.NoError(t, err)
	assert.NotNil(t, created.StellarWalletAddress)
	assert.Equal(t, kp.Address(), *created.StellarWalletAddress)
}

func TestCreateProject_InvalidWalletAddressIsRejected(t *testing.T) {
	repo := newFakeRepository()
	svc := NewService(repo, nil, nil, nil)

	_, err := svc.CreateProject(context.Background(), &ProjectCreateRequest{
		Name:                 "Test Project",
		Type:                 "Reforestation",
		Location:             "Somewhere",
		Area:                 10,
		StellarWalletAddress: "not-a-valid-address",
	})

	assert.Error(t, err)
	assert.Nil(t, repo.created)
}

func TestCreateProject_NoWalletAddressLeavesItUnset(t *testing.T) {
	repo := newFakeRepository()
	svc := NewService(repo, nil, nil, nil)

	created, err := svc.CreateProject(context.Background(), &ProjectCreateRequest{
		Name:     "Test Project",
		Type:     "Reforestation",
		Location: "Somewhere",
		Area:     10,
	})

	assert.NoError(t, err)
	assert.Nil(t, created.StellarWalletAddress)
}

func TestUpdateProject_SetsValidWalletAddress(t *testing.T) {
	repo := newFakeRepository()
	svc := NewService(repo, nil, nil, nil)
	created, err := svc.CreateProject(context.Background(), &ProjectCreateRequest{
		Name: "Test Project", Type: "Reforestation", Location: "Somewhere", Area: 10,
	})
	assert.NoError(t, err)

	kp, err := keypair.Random()
	assert.NoError(t, err)
	addr := kp.Address()

	updated, err := svc.UpdateProject(context.Background(), created.ID, &ProjectUpdateRequest{
		StellarWalletAddress: &addr,
	})

	assert.NoError(t, err)
	assert.NotNil(t, updated.StellarWalletAddress)
	assert.Equal(t, addr, *updated.StellarWalletAddress)
}

func TestUpdateProject_RejectsInvalidWalletAddress(t *testing.T) {
	repo := newFakeRepository()
	svc := NewService(repo, nil, nil, nil)
	created, err := svc.CreateProject(context.Background(), &ProjectCreateRequest{
		Name: "Test Project", Type: "Reforestation", Location: "Somewhere", Area: 10,
	})
	assert.NoError(t, err)

	bad := "not-a-valid-address"
	_, err = svc.UpdateProject(context.Background(), created.ID, &ProjectUpdateRequest{
		StellarWalletAddress: &bad,
	})

	assert.Error(t, err)
}

func TestUpdateProject_EmptyStringClearsWalletAddress(t *testing.T) {
	repo := newFakeRepository()
	svc := NewService(repo, nil, nil, nil)
	kp, _ := keypair.Random()
	addr := kp.Address()
	created, err := svc.CreateProject(context.Background(), &ProjectCreateRequest{
		Name: "Test Project", Type: "Reforestation", Location: "Somewhere", Area: 10,
		StellarWalletAddress: addr,
	})
	assert.NoError(t, err)

	empty := ""
	updated, err := svc.UpdateProject(context.Background(), created.ID, &ProjectUpdateRequest{
		StellarWalletAddress: &empty,
	})

	assert.NoError(t, err)
	assert.Nil(t, updated.StellarWalletAddress)
}
