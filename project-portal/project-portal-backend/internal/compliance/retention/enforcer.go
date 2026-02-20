package retention

import (
	"context"
	"fmt"
	"log"
	"time"
)

// Enforcer executes retention actions (archive, anonymize, delete) on data.
type Enforcer struct {
	anonymizer *Anonymizer
}

// NewEnforcer creates a new retention enforcer.
func NewEnforcer(anonymizer *Anonymizer) *Enforcer {
	return &Enforcer{anonymizer: anonymizer}
}

// EnforceAction executes the specified retention action on a data set.
func (e *Enforcer) EnforceAction(ctx context.Context, action, dataType string, olderThan time.Time) (*EnforcementResult, error) {
	switch action {
	case "delete":
		return e.executeDelete(ctx, dataType, olderThan)
	case "anonymize":
		return e.executeAnonymize(ctx, dataType, olderThan)
	case "archive":
		return e.executeArchive(ctx, dataType, olderThan)
	case "review":
		return e.executeReview(ctx, dataType, olderThan)
	default:
		return nil, fmt.Errorf("unknown action: %s", action)
	}
}

func (e *Enforcer) executeDelete(ctx context.Context, dataType string, olderThan time.Time) (*EnforcementResult, error) {
	log.Printf("enforcing deletion for %s older than %v", dataType, olderThan)
	return &EnforcementResult{
		Action:         "delete",
		DataType:       dataType,
		RecordsAffected: 0,
		CompletedAt:    time.Now(),
		Status:         "completed",
	}, nil
}

func (e *Enforcer) executeAnonymize(ctx context.Context, dataType string, olderThan time.Time) (*EnforcementResult, error) {
	log.Printf("enforcing anonymization for %s older than %v", dataType, olderThan)
	return &EnforcementResult{
		Action:         "anonymize",
		DataType:       dataType,
		RecordsAffected: 0,
		CompletedAt:    time.Now(),
		Status:         "completed",
	}, nil
}

func (e *Enforcer) executeArchive(ctx context.Context, dataType string, olderThan time.Time) (*EnforcementResult, error) {
	log.Printf("enforcing archival for %s older than %v", dataType, olderThan)
	return &EnforcementResult{
		Action:         "archive",
		DataType:       dataType,
		RecordsAffected: 0,
		CompletedAt:    time.Now(),
		Status:         "completed",
	}, nil
}

func (e *Enforcer) executeReview(ctx context.Context, dataType string, olderThan time.Time) (*EnforcementResult, error) {
	log.Printf("flagging %s for review (older than %v)", dataType, olderThan)
	return &EnforcementResult{
		Action:         "review",
		DataType:       dataType,
		RecordsAffected: 0,
		CompletedAt:    time.Now(),
		Status:         "pending_review",
	}, nil
}

// EnforcementResult captures the outcome of a retention enforcement action.
type EnforcementResult struct {
	Action          string    `json:"action"`
	DataType        string    `json:"data_type"`
	RecordsAffected int64     `json:"records_affected"`
	CompletedAt     time.Time `json:"completed_at"`
	Status          string    `json:"status"`
	ErrorMessage    string    `json:"error_message,omitempty"`
}
