package requests

import (
	"fmt"
	"time"
)

// Verifier handles identity verification for privacy requests.
type Verifier struct{}

// NewVerifier creates a new request verifier.
func NewVerifier() *Verifier {
	return &Verifier{}
}

// VerificationResult captures the outcome of an identity verification.
type VerificationResult struct {
	Verified   bool      `json:"verified"`
	Method     string    `json:"method"`
	VerifiedAt time.Time `json:"verified_at"`
	VerifiedBy string    `json:"verified_by,omitempty"`
	Reason     string    `json:"reason,omitempty"`
}

// VerifyByEmail verifies a request by checking email ownership.
func (v *Verifier) VerifyByEmail(requestUserID, authenticatedUserID string) (*VerificationResult, error) {
	if requestUserID != authenticatedUserID {
		return &VerificationResult{
			Verified: false,
			Method:   "email",
			Reason:   "authenticated user does not match request user",
		}, fmt.Errorf("user identity mismatch")
	}

	return &VerificationResult{
		Verified:   true,
		Method:     "email",
		VerifiedAt: time.Now(),
		VerifiedBy: authenticatedUserID,
	}, nil
}

// VerifyByAdmin allows an admin to verify a request on behalf of a user.
func (v *Verifier) VerifyByAdmin(adminUserID string) (*VerificationResult, error) {
	if adminUserID == "" {
		return nil, fmt.Errorf("admin user ID required")
	}

	return &VerificationResult{
		Verified:   true,
		Method:     "admin_override",
		VerifiedAt: time.Now(),
		VerifiedBy: adminUserID,
	}, nil
}

// ValidateRequestType checks that the request type is valid.
func (v *Verifier) ValidateRequestType(requestType string) error {
	validTypes := map[string]bool{
		"export": true, "deletion": true,
		"correction": true, "restriction": true,
	}
	if !validTypes[requestType] {
		return fmt.Errorf("invalid request type: %s", requestType)
	}
	return nil
}
