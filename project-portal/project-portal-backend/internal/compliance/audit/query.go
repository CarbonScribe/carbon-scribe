package audit

// QueryEngine provides advanced audit log querying capabilities.
// The actual querying is delegated to the repository via the service layer;
// this provides query building and filtering utilities.
type QueryEngine struct{}

// NewQueryEngine creates a new audit log query engine.
func NewQueryEngine() *QueryEngine {
	return &QueryEngine{}
}

// QueryFilter defines parameters for filtering audit logs.
type QueryFilter struct {
	ActorID          string
	TargetType       string
	TargetID         string
	TargetOwnerID    string
	EventType        string
	EventAction      string
	SensitivityLevel string
	ServiceName      string
	Limit            int
	Offset           int
}

// ValidateFilter checks that a query filter has valid parameters.
func (qe *QueryEngine) ValidateFilter(filter QueryFilter) QueryFilter {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Limit > 1000 {
		filter.Limit = 1000
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	return filter
}
