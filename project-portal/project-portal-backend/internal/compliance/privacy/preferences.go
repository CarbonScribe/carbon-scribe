package privacy

import (
	"context"
	"fmt"
)

// PreferenceRepository defines the data access interface for privacy preferences.
type PreferenceRepository interface {
	GetPrivacyPreference(ctx context.Context, userID string) (interface{}, error)
	UpsertPrivacyPreference(ctx context.Context, pref interface{}) error
}

// PreferenceManager handles privacy preference operations with validation.
type PreferenceManager struct {
	jurisdictionRules *JurisdictionManager
}

// NewPreferenceManager creates a new preference manager.
func NewPreferenceManager(jm *JurisdictionManager) *PreferenceManager {
	return &PreferenceManager{jurisdictionRules: jm}
}

// PreferenceDefaults returns default privacy preferences for a given jurisdiction.
func (pm *PreferenceManager) PreferenceDefaults(jurisdiction string) map[string]bool {
	defaults := map[string]bool{
		"marketing_emails":         false,
		"promotional_emails":       false,
		"system_notifications":     true,
		"third_party_sharing":      false,
		"analytics_tracking":       true,
		"data_retention_consent":   true,
		"research_participation":   false,
		"automated_decision_making": false,
	}

	// GDPR is more restrictive by default
	if jurisdiction == "GDPR" {
		defaults["analytics_tracking"] = false
	}

	return defaults
}

// ValidatePreferenceUpdate checks that a preference update is valid for the user's jurisdiction.
func (pm *PreferenceManager) ValidatePreferenceUpdate(jurisdiction string, field string, value bool) error {
	// Some jurisdictions require explicit consent for certain fields
	restrictions := pm.jurisdictionRules.GetRestrictions(jurisdiction)
	if req, ok := restrictions[field]; ok && req == "explicit_consent" && value {
		return fmt.Errorf("field %q requires explicit consent under %s", field, jurisdiction)
	}
	return nil
}
