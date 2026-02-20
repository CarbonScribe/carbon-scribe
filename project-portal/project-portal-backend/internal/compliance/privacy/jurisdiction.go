package privacy

// JurisdictionManager holds jurisdiction-specific privacy rules and restrictions.
type JurisdictionManager struct {
	rules map[string]JurisdictionRules
}

// JurisdictionRules defines the privacy rules for a specific jurisdiction.
type JurisdictionRules struct {
	Name                string            `json:"name"`
	Code                string            `json:"code"`
	MaxResponseDays     int               `json:"max_response_days"`
	RequiresExplicitConsent bool          `json:"requires_explicit_consent"`
	RightToErasure      bool              `json:"right_to_erasure"`
	RightToPortability  bool              `json:"right_to_portability"`
	BreachNotificationHours int           `json:"breach_notification_hours"`
	FieldRestrictions   map[string]string `json:"field_restrictions"`
}

// NewJurisdictionManager creates a manager with preconfigured jurisdiction rules.
func NewJurisdictionManager() *JurisdictionManager {
	return &JurisdictionManager{
		rules: map[string]JurisdictionRules{
			"GDPR": {
				Name:                    "General Data Protection Regulation",
				Code:                    "GDPR",
				MaxResponseDays:         30,
				RequiresExplicitConsent:  true,
				RightToErasure:          true,
				RightToPortability:      true,
				BreachNotificationHours: 72,
				FieldRestrictions: map[string]string{
					"analytics_tracking":  "explicit_consent",
					"third_party_sharing": "explicit_consent",
					"marketing_emails":    "explicit_consent",
				},
			},
			"CCPA": {
				Name:                    "California Consumer Privacy Act",
				Code:                    "CCPA",
				MaxResponseDays:         45,
				RequiresExplicitConsent:  false,
				RightToErasure:          true,
				RightToPortability:      true,
				BreachNotificationHours: 0, // no specific requirement
				FieldRestrictions: map[string]string{
					"third_party_sharing": "opt_out",
				},
			},
			"LGPD": {
				Name:                    "Lei Geral de Protecao de Dados",
				Code:                    "LGPD",
				MaxResponseDays:         15,
				RequiresExplicitConsent:  true,
				RightToErasure:          true,
				RightToPortability:      true,
				BreachNotificationHours: 48,
				FieldRestrictions: map[string]string{
					"analytics_tracking":  "explicit_consent",
					"third_party_sharing": "explicit_consent",
				},
			},
			"global": {
				Name:                    "Global Default",
				Code:                    "global",
				MaxResponseDays:         30,
				RequiresExplicitConsent:  false,
				RightToErasure:          true,
				RightToPortability:      true,
				BreachNotificationHours: 72,
				FieldRestrictions:       map[string]string{},
			},
		},
	}
}

// GetRules returns the rules for a jurisdiction, falling back to global defaults.
func (jm *JurisdictionManager) GetRules(jurisdiction string) JurisdictionRules {
	if rules, ok := jm.rules[jurisdiction]; ok {
		return rules
	}
	return jm.rules["global"]
}

// GetRestrictions returns the field-level restrictions for a jurisdiction.
func (jm *JurisdictionManager) GetRestrictions(jurisdiction string) map[string]string {
	rules := jm.GetRules(jurisdiction)
	return rules.FieldRestrictions
}

// GetMaxResponseDays returns the maximum allowed response time for a jurisdiction.
func (jm *JurisdictionManager) GetMaxResponseDays(jurisdiction string) int {
	return jm.GetRules(jurisdiction).MaxResponseDays
}

// ListJurisdictions returns all supported jurisdictions.
func (jm *JurisdictionManager) ListJurisdictions() []JurisdictionRules {
	var list []JurisdictionRules
	for _, r := range jm.rules {
		list = append(list, r)
	}
	return list
}
