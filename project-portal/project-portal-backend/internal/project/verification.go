package project

// VerificationStatus represents the verification status of a project
type VerificationStatus string

const (
	VerificationStatusPending   VerificationStatus = "pending"
	VerificationStatusInReview  VerificationStatus = "in_review"
	VerificationStatusApproved  VerificationStatus = "approved"
	VerificationStatusRejected  VerificationStatus = "rejected"
)

// VerificationRequest represents a project verification request
type VerificationRequest struct {
	ProjectID     string            `json:"project_id"`
	VerifierID    string            `json:"verifier_id"`
	Documents     []string          `json:"documents"`
	Notes         string            `json:"notes"`
	RequestedDate string            `json:"requested_date"`
}

// VerificationResult represents the result of a verification
type VerificationResult struct {
	RequestID    string             `json:"request_id"`
	ProjectID    string             `json:"project_id"`
	Status       VerificationStatus `json:"status"`
	VerifierID   string             `json:"verifier_id"`
	Findings     []string           `json:"findings"`
	CompletedAt  string             `json:"completed_at"`
}
