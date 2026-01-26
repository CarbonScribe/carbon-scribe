package workflows

// StateMachine holds allowed transitions
type StateMachine struct {
	allowedTransitions map[string][]string
}

// NewStateMachine initializes default transitions
func NewStateMachine() *StateMachine {
	return &StateMachine{
		allowedTransitions: map[string][]string{
			"draft":     {"submitted"},
			"submitted": {"approved", "rejected"},
			"approved":  {"archived"},
		},
	}
}

// CanTransition returns true only if the transition is explicitly allowed
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
