package methodology

import (
	"context"

	"github.com/google/uuid"
)

type Service interface {
	GetMethodologyTokenID(ctx context.Context, projectID uuid.UUID) (int, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) GetMethodologyTokenID(ctx context.Context, projectID uuid.UUID) (int, error) {
	return s.repo.GetMethodologyIDForProject(ctx, projectID)
}
