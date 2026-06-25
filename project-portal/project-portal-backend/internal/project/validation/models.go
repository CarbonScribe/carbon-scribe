package validation

import "time"

// Validation response for a single methodology
// Used for both API and internal service

type MethodologyValidationResult struct {
	TokenID          int       `json:"token_id"`
	ContractID       string    `json:"contract_id"`
	Name             string    `json:"name"`
	Version          string    `json:"version"`
	Registry         string    `json:"registry"`
	IssuingAuthority string    `json:"issuing_authority"`
	OwnerAddress     string    `json:"owner_address"`
	Valid            bool      `json:"valid"`
	Reason           string    `json:"reason,omitempty"`
	EffectiveFrom    time.Time `json:"effective_from,omitempty"`
	EffectiveTo      *time.Time `json:"effective_to,omitempty"`
}

type BatchMethodologyValidationRequest struct {
	TokenIDs []int `json:"token_ids" binding:"required"`
}

type BatchMethodologyValidationResponse struct {
	Results []MethodologyValidationResult `json:"results"`
}
