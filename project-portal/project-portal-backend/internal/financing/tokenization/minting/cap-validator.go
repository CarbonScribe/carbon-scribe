package minting

import (
	"context"

	"github.com/google/uuid"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
)

type CapValidator struct {
	service methodology.CapEnforcementService
}

type CapValidationInput struct {
	MethodologyTokenID int
	ProjectID          uuid.UUID
	VintageYear        *int
	RequestedAmount    int64
}

func NewCapValidator(service methodology.CapEnforcementService) *CapValidator {
	return &CapValidator{service: service}
}

func (v *CapValidator) ValidateAndExecute(ctx context.Context, input CapValidationInput, executeMint func(context.Context) error) error {
	if v == nil || v.service == nil {
		return executeMint(ctx)
	}
	_, err := v.service.ValidateAndExecuteMint(ctx, methodology.MintValidationInput{
		MethodologyTokenID: input.MethodologyTokenID,
		ProjectID:          input.ProjectID,
		VintageYear:        input.VintageYear,
		RequestedAmount:    input.RequestedAmount,
	}, executeMint)
	return err
}
