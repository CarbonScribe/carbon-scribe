package validation

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/integration/stellar"
	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
	"context"
)

type MethodologyValidator struct {
	Client stellar.MethodologyClient
	// Add cache here if needed
}

func NewMethodologyValidator(client stellar.MethodologyClient) *MethodologyValidator {
	return &MethodologyValidator{Client: client}
}

// Validate a single methodology token ID
func (v *MethodologyValidator) Validate(ctx context.Context, tokenID int, providedMeta *methodology.MethodologyMeta) (result MethodologyValidationResult) {
	result.TokenID = tokenID
	result.Valid = false
	result.ContractID = methodology.DefaultMethodologyContractID

	meta, err := v.Client.GetMethodologyMeta(ctx, tokenID)
	if err != nil {
		result.Reason = "Methodology not found in contract"
		return
	}
	       result.Name = meta.Name
	       result.Version = meta.Version
	       result.Registry = meta.Registry
	       result.IssuingAuthority = meta.IssuingAuthority
	       // Check recognized authority
	       if !v.Client.IsValidMethodology(ctx, tokenID) {
		       result.Reason = "Unrecognized issuing authority"
		       return
	       }
	       // Compare provided metadata if present
	       if providedMeta != nil {
		       if meta.Name != providedMeta.Name || meta.Version != providedMeta.Version || meta.Registry != providedMeta.Registry {
			       result.Reason = "Metadata mismatch"
			       return
		       }
	       }
	       // (Optional) Add date checks if you add those fields to MethodologyMeta in the future
	       result.Valid = true
	       return
}
