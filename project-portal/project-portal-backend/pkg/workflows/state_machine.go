package workflows

// StateMachine enforces project status transitions
type StateMachine struct {
	allowedTransitions map[string][]string
}

// NewStateMachine creates a new state machine with allowed transitions
func NewStateMachine() *StateMachine {
	return &StateMachine{
		allowedTransitions: map[string][]string{
			"DRAFT":        {"SUBMITTED"},
			"SUBMITTED":    {"UNDER_REVIEW"},
			"UNDER_REVIEW": {"VERIFIED", "SUSPENDED"},
			"VERIFIED":     {"ACTIVE"},
			"ACTIVE":       {"COMPLETED", "SUSPENDED"},
			"COMPLETED":    {},
			"SUSPENDED":    {"ACTIVE"}, // Allow resuming suspended projects
		},
	}
}

// CanTransition checks if a status transition is allowed
func (sm *StateMachine) CanTransition(from, to string) bool {
	allowed, exists := sm.allowedTransitions[from]
	if !exists {
		return false
	}
	for _, allowedTo := range allowed {
		if allowedTo == to {
			return true
		}
	}
	return false
}

// GetAllowedTransitions returns the allowed next statuses for a given status
func (sm *StateMachine) GetAllowedTransitions(from string) []string {
	allowed, exists := sm.allowedTransitions[from]
	if !exists {
		return []string{}
	}
	return allowed
}