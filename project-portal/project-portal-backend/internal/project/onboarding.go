package project

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
	"carbon-scribe/project-portal/project-portal-backend/internal/integration/stellar"

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

// ========== METHODOLOGY VALIDATION FUNCTIONS (Issue #180) ==========

// ValidateMethodologyBeforeOnboarding validates methodology before project creation
func (s *service) ValidateMethodologyBeforeOnboarding(ctx context.Context, methodologyTokenID uint32, expectedName, expectedVersion string) error {
	client := stellar.NewMethodologyClientFromEnv()
	return client.ValidateMethodology(ctx, methodologyTokenID, expectedName, expectedVersion)
}

// ValidateMethodologyToken validates a single methodology token ID
func (s *service) ValidateMethodologyToken(ctx context.Context, tokenID uint32) error {
	client := stellar.NewMethodologyClientFromEnv()
	
	// Check if methodology exists and is valid
	_, err := client.GetMethodologyMeta(ctx, tokenID)
	if err != nil {
		return fmt.Errorf("methodology token %d not found: %w", tokenID, err)
	}
	
	valid, err := client.IsValidMethodology(ctx, tokenID)
	if err != nil {
		return fmt.Errorf("failed to validate methodology authority: %w", err)
	}
	if !valid {
		return fmt.Errorf("methodology token %d is not from a recognized authority", tokenID)
	}
	
	return nil
}

// BatchValidateMethodologyTokens validates multiple methodology tokens
func (s *service) BatchValidateMethodologyTokens(ctx context.Context, tokenIDs []uint32) (map[uint32]error, error) {
	results := make(map[uint32]error)
	client := stellar.NewMethodologyClientFromEnv()
	
	for _, tokenID := range tokenIDs {
		err := client.ValidateMethodology(ctx, tokenID, "", "")
		results[tokenID] = err
	}
	
	return results, nil
}