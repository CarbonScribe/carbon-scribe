package privacy

import (
	"fmt"
	"time"
)

// ConsentValidator provides reusable consent validation logic.
type ConsentValidator struct{}

// NewConsentValidator creates a new consent validator.
func NewConsentValidator() *ConsentValidator {
	return &ConsentValidator{}
}

// ValidateConsentType checks that a consent type is recognized.
func (cv *ConsentValidator) ValidateConsentType(consentType string) error {
	valid := map[string]bool{
		"marketing": true, "privacy_policy": true,
		"terms_of_service": true, "cookies": true,
		"analytics": true, "third_party": true,
		"research": true,
	}
	if !valid[consentType] {
		return fmt.Errorf("unrecognized consent type: %s", consentType)
	}
	return nil
}

// IsExpired checks whether a consent record has expired.
func (cv *ConsentValidator) IsExpired(expiresAt *time.Time) bool {
	if expiresAt == nil {
		return false
	}
	return time.Now().After(*expiresAt)
}

// IsActive checks whether consent is currently valid and active.
func (cv *ConsentValidator) IsActive(given bool, expiresAt, withdrawnAt *time.Time) bool {
	if !given {
		return false
	}
	if cv.IsExpired(expiresAt) {
		return false
	}
	if withdrawnAt != nil {
		return false
	}
	return true
}
