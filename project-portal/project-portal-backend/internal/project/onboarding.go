package project

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
)

// registerMethodologyDuringOnboarding validates methodology compliance before registration.
func (s *service) registerMethodologyDuringOnboarding(ctx context.Context, projectID uuid.UUID, req *methodology.RegisterMethodologyRequest) error {
       if req == nil {
	       return nil
       }

	       // Validate methodology compliance before registration
	       if s.validator != nil {
		       // Use OwnerAddress as a proxy for token ID if needed, or require it in the request
		       tokenID := 0
		       if req != nil {
			       // If token ID is part of the request, use it; otherwise, skip validation
			       // (You may want to enforce this in your API contract)
			       // tokenID = req.MethodologyTokenID // Uncomment if present in request struct
		       }
		       validationResult := s.validator.Validate(ctx, tokenID, &methodology.MethodologyMeta{
			       Name:             req.Name,
			       Version:          req.Version,
			       Registry:         req.Registry,
			       IssuingAuthority: req.IssuingAuthority,
		       })
		       if !validationResult.Valid {
			       return fmt.Errorf("methodology compliance validation failed: %s", validationResult.Reason)
		       }
	       }

       _, err := s.methService.RegisterMethodology(ctx, projectID, *req)
       if err != nil {
	       return fmt.Errorf("failed methodology registration during onboarding: %w", err)
       }

       return nil
}
