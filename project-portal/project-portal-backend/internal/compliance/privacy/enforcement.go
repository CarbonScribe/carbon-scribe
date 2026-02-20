package privacy

// Manager coordinates all privacy operations.
type Manager struct {
	repo          interface{}
	preferences   *PreferenceManager
	consent       *ConsentManager
	jurisdiction  *JurisdictionManager
	enforcement   *EnforcementEngine
}

// NewManager creates a privacy manager with all sub-components.
func NewManager(repo interface{}) *Manager {
	jm := NewJurisdictionManager()
	return &Manager{
		repo:         repo,
		preferences:  NewPreferenceManager(jm),
		consent:      NewConsentManager(),
		jurisdiction: jm,
		enforcement:  NewEnforcementEngine(),
	}
}

// EnforcementEngine checks and enforces privacy preferences across services.
type EnforcementEngine struct{}

// NewEnforcementEngine creates a new enforcement engine.
func NewEnforcementEngine() *EnforcementEngine {
	return &EnforcementEngine{}
}

// EnforcementCheck represents the result of checking whether an action is permitted.
type EnforcementCheck struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
	Rule    string `json:"rule,omitempty"`
}

// CheckMarketingAllowed verifies whether marketing communications are permitted.
func (ee *EnforcementEngine) CheckMarketingAllowed(marketingEmails, promotionalEmails bool) EnforcementCheck {
	if !marketingEmails && !promotionalEmails {
		return EnforcementCheck{Allowed: false, Reason: "user has opted out of marketing", Rule: "marketing_preference"}
	}
	return EnforcementCheck{Allowed: true}
}

// CheckAnalyticsAllowed verifies whether analytics tracking is permitted.
func (ee *EnforcementEngine) CheckAnalyticsAllowed(analyticsTracking bool) EnforcementCheck {
	if !analyticsTracking {
		return EnforcementCheck{Allowed: false, Reason: "user has opted out of analytics", Rule: "analytics_preference"}
	}
	return EnforcementCheck{Allowed: true}
}

// CheckThirdPartySharingAllowed verifies whether third-party data sharing is permitted.
func (ee *EnforcementEngine) CheckThirdPartySharingAllowed(thirdPartySharing bool) EnforcementCheck {
	if !thirdPartySharing {
		return EnforcementCheck{Allowed: false, Reason: "user has opted out of third-party sharing", Rule: "sharing_preference"}
	}
	return EnforcementCheck{Allowed: true}
}
