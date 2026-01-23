package financing

// TokenizationStatus represents the status of a tokenization process
type TokenizationStatus string

const (
	TokenizationStatusPending    TokenizationStatus = "pending"
	TokenizationStatusProcessing TokenizationStatus = "processing"
	TokenizationStatusCompleted  TokenizationStatus = "completed"
	TokenizationStatusFailed     TokenizationStatus = "failed"
)

// TokenizationRequest represents a request to tokenize carbon credits
type TokenizationRequest struct {
	ProjectID     string  `json:"project_id"`
	CreditID      string  `json:"credit_id"`
	Amount        float64 `json:"amount"`
	RecipientAddr string  `json:"recipient_addr"`
}

// TokenizationResult represents the result of a tokenization operation
type TokenizationResult struct {
	TransactionID string             `json:"transaction_id"`
	Status        TokenizationStatus `json:"status"`
	TokenID       string             `json:"token_id,omitempty"`
	Error         string             `json:"error,omitempty"`
}
