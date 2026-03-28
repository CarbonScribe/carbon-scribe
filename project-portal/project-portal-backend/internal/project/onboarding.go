package project

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
)

func (s *service) registerMethodologyDuringOnboarding(ctx context.Context, projectID uuid.UUID, req *methodology.RegisterMethodologyRequest) error {
	if req == nil {
		return nil
	}

	_, err := s.methService.RegisterMethodology(ctx, projectID, *req)
	if err != nil {
		return fmt.Errorf("failed methodology registration during onboarding: %w", err)
	}

	return nil
}
