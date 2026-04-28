package validation

type ValidationResponse struct {
	TokenID   uint32 `json:"tokenId"`
	Valid     bool   `json:"valid"`
	Message   string `json:"message"`
	Authority string `json:"authority,omitempty"`
}

type BatchValidationRequest struct {
	TokenIDs []uint32 `json:"tokenIds"`
}

type BatchValidationResponse struct {
	Results map[uint32]ValidationResponse `json:"results"`
	Total   int                            `json:"total"`
	Valid   int                            `json:"valid"`
	Invalid int                            `json:"invalid"`
} 