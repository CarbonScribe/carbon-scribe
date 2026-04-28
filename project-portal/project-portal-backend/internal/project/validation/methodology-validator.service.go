package validation

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/integration/stellar"
)

type MethodologyValidatorService struct {
	client stellar.Methodologies
}

func NewMethodologyValidatorService(client stellar.Methodologies) *MethodologyValidatorService {
	return &MethodologyValidatorService{client: client}
}

type ValidationResult struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
}

func (s *MethodologyValidatorService) ValidateMethodologyToken(ctx context.Context, tokenID uint32) (*ValidationResult, error) {
	meta, err := s.client.GetMethodologyMeta(ctx, tokenID)
	if err != nil {
		return &ValidationResult{Valid: false, Message: fmt.Sprintf("Methodology token %d not found", tokenID)}, nil
	}

	valid, err := s.client.IsValidMethodology(ctx, tokenID)
	if err != nil {
		return &ValidationResult{Valid: false, Message: "Authority validation failed"}, nil
	}
	if !valid {
		return &ValidationResult{Valid: false, Message: fmt.Sprintf("Methodology token %d is not from a recognized authority", tokenID)}, nil
	}

	return &ValidationResult{Valid: true, Message: "Methodology is valid", Meta: meta}, nil
} 