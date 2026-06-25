package validation

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
	"context"
)

// Validator defines the interface for methodology compliance validation
// Used by onboarding and service layers
// Returns a MethodologyValidationResult
//
type Validator interface {
	Validate(ctx context.Context, tokenID int, providedMeta *methodology.MethodologyMeta) MethodologyValidationResult
}
