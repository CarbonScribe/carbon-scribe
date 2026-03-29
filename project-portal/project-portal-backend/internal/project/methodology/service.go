package methodology

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service interface {
	GetMethodologyTokenID(ctx context.Context, projectID uuid.UUID) (int, error)
	ValidateProjectMethodology(ctx context.Context, projectID uuid.UUID) (int, error)
	RegisterMethodology(ctx context.Context, projectID uuid.UUID, req RegisterMethodologyRequest) (*MethodologyRegistrationResponse, error)
	GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*MethodologyRegistrationResponse, error)
	ValidateMethodology(ctx context.Context, tokenID int) (bool, error)
	ContractID() string
}

type service struct {
	repo  Repository
	chain MethodologyContractClient
}

func NewService(repo Repository, chain MethodologyContractClient) Service {
	return &service{repo: repo, chain: chain}
}

func (s *service) GetMethodologyTokenID(ctx context.Context, projectID uuid.UUID) (int, error) {
	return s.repo.GetMethodologyIDForProject(ctx, projectID)
}

func (s *service) ContractID() string {
	return s.chain.ContractID()
}

func (s *service) ValidateProjectMethodology(ctx context.Context, projectID uuid.UUID) (int, error) {
	tokenID, err := s.repo.GetMethodologyIDForProject(ctx, projectID)
	if err != nil {
		return 0, err
	}
	if tokenID <= 0 {
		return 0, fmt.Errorf("project %s has no valid methodology token ID linked", projectID)
	}
	valid, err := s.chain.IsValidMethodology(ctx, tokenID)
	if err != nil {
		return 0, err
	}
	if !valid {
		return 0, fmt.Errorf("methodology token %d is not valid on-chain", tokenID)
	}
	return tokenID, nil
}

func (s *service) RegisterMethodology(ctx context.Context, projectID uuid.UUID, req RegisterMethodologyRequest) (*MethodologyRegistrationResponse, error) {
	if req.Name == "" || req.Registry == "" {
		return nil, errors.New("name and registry are required")
	}

	tokenID, txHash, err := s.chain.MintMethodology(ctx, req.OwnerAddress, MethodologyMeta{
		Name:             req.Name,
		Version:          req.Version,
		Registry:         req.Registry,
		RegistryLink:     req.RegistryLink,
		IssuingAuthority: req.IssuingAuthority,
		IPFSCID:          req.IPFSCID,
	})
	if err != nil {
		return nil, err
	}

	registration := &MethodologyRegistration{
		ProjectID:            projectID,
		MethodologyTokenID:   tokenID,
		ContractID:           s.chain.ContractID(),
		Name:                 req.Name,
		Version:              req.Version,
		Registry:             req.Registry,
		RegistryLink:         req.RegistryLink,
		IssuingAuthority:     req.IssuingAuthority,
		OwnerAddress:         req.OwnerAddress,
		IPFSCID:              req.IPFSCID,
		TransactionHash:      txHash,
		MethodologyValidated: true,
	}

	if err := s.repo.CreateRegistration(ctx, registration); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateProjectMethodology(ctx, projectID, tokenID, s.chain.ContractID()); err != nil {
		return nil, err
	}

	return mapRegistrationResponse(registration), nil
}

func (s *service) GetProjectMethodology(ctx context.Context, projectID uuid.UUID) (*MethodologyRegistrationResponse, error) {
	registration, err := s.repo.GetProjectMethodology(ctx, projectID)
	if err != nil {
		return nil, err
	}

	valid, validErr := s.chain.IsValidMethodology(ctx, registration.MethodologyTokenID)
	if validErr == nil {
		registration.MethodologyValidated = valid
	}

	return mapRegistrationResponse(registration), nil
}

func (s *service) ValidateMethodology(ctx context.Context, tokenID int) (bool, error) {
	valid, err := s.chain.IsValidMethodology(ctx, tokenID)
	if err == nil {
		return valid, nil
	}

	registration, dbErr := s.repo.GetRegistrationByTokenID(ctx, tokenID)
	if dbErr != nil {
		if errors.Is(dbErr, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, dbErr
	}
	if registration.ContractID != s.chain.ContractID() {
		return false, nil
	}
	return true, nil
}

func mapRegistrationResponse(registration *MethodologyRegistration) *MethodologyRegistrationResponse {
	if registration == nil {
		return nil
	}
	return &MethodologyRegistrationResponse{
		ID:                  registration.ID,
		ProjectID:           registration.ProjectID,
		MethodologyTokenID:  registration.MethodologyTokenID,
		ContractID:          registration.ContractID,
		Name:                registration.Name,
		Version:             registration.Version,
		Registry:            registration.Registry,
		RegistryLink:        registration.RegistryLink,
		IssuingAuthority:    registration.IssuingAuthority,
		OwnerAddress:        registration.OwnerAddress,
		IPFSCID:             registration.IPFSCID,
		RegisteredAt:        registration.RegisteredAt,
		TransactionHash:     registration.TransactionHash,
		MethodologyVerified: registration.MethodologyValidated,
	}
}
