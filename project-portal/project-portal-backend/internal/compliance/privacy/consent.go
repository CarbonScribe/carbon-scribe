package privacy

import (
	"fmt"
	"time"
)

// ConsentManager handles consent lifecycle including validation, expiry, and analytics.
type ConsentManager struct{}

// NewConsentManager creates a new consent manager.
func NewConsentManager() *ConsentManager {
	return &ConsentManager{}
}

// ValidateConsent checks that a consent record is valid.
func (cm *ConsentManager) ValidateConsent(consentType, consentVersion, purpose string) error {
	if consentType == "" {
		return fmt.Errorf("consent type is required")
	}
	if consentVersion == "" {
		return fmt.Errorf("consent version is required")
	}

	validTypes := map[string]bool{
		"marketing": true, "privacy_policy": true,
		"terms_of_service": true, "cookies": true,
		"analytics": true, "third_party": true,
		"research": true,
	}
	if !validTypes[consentType] {
		return fmt.Errorf("invalid consent type: %s", consentType)
	}

	return nil
}

// IsConsentExpired checks whether a consent has passed its expiry date.
func (cm *ConsentManager) IsConsentExpired(expiresAt *time.Time) bool {
	if expiresAt == nil {
		return false
	}
	return time.Now().After(*expiresAt)
}

// IsConsentWithdrawn checks whether consent has been withdrawn.
func (cm *ConsentManager) IsConsentWithdrawn(withdrawnAt *time.Time) bool {
	return withdrawnAt != nil
}

// IsConsentActive checks whether consent is currently active (given, not expired, not withdrawn).
func (cm *ConsentManager) IsConsentActive(given bool, expiresAt, withdrawnAt *time.Time) bool {
	if !given {
		return false
	}
	if cm.IsConsentExpired(expiresAt) {
		return false
	}
	if cm.IsConsentWithdrawn(withdrawnAt) {
		return false
	}
	return true
}

// ConsentSummary provides a summary of a user's consent status per type.
type ConsentSummary struct {
	ConsentType string    `json:"consent_type"`
	IsActive    bool      `json:"is_active"`
	Version     string    `json:"version"`
	GivenAt     time.Time `json:"given_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}
