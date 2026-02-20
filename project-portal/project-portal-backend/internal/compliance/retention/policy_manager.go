package retention

import (
	"context"
	"fmt"
	"time"
)

// PolicyRepository defines the subset of repository operations needed by retention management.
type PolicyRepository interface {
	GetRetentionPolicy(ctx context.Context, id string) (interface{}, error)
	ListRetentionPolicies(ctx context.Context, dataCategory, jurisdiction string, activeOnly bool) (interface{}, error)
	GetDueSchedules(ctx context.Context, before time.Time) (interface{}, error)
	IsDataUnderLegalHold(ctx context.Context, userID, dataCategory string) (bool, error)
}

// PolicyManager handles retention policy evaluation and enforcement coordination.
type PolicyManager struct {
	repo interface{}
}

// NewPolicyManager creates a new PolicyManager.
func NewPolicyManager(repo interface{}) *PolicyManager {
	return &PolicyManager{repo: repo}
}

// EvaluatePolicy determines what action should be taken for data given a policy.
func (pm *PolicyManager) EvaluatePolicy(retentionDays int, dataAge time.Duration) string {
	ageDays := int(dataAge.Hours() / 24)
	if retentionDays < 0 {
		return "retain" // indefinite retention
	}
	if ageDays >= retentionDays {
		return "delete"
	}
	return "retain"
}

// CalculateNextReviewDate returns the next review date based on the policy review period.
func (pm *PolicyManager) CalculateNextReviewDate(reviewPeriodDays int) time.Time {
	if reviewPeriodDays <= 0 {
		reviewPeriodDays = 365
	}
	return time.Now().AddDate(0, 0, reviewPeriodDays)
}

// CalculateExpirationDate returns the expiration date for data based on creation and retention period.
func (pm *PolicyManager) CalculateExpirationDate(createdAt time.Time, retentionDays int) *time.Time {
	if retentionDays < 0 {
		return nil // indefinite
	}
	exp := createdAt.AddDate(0, 0, retentionDays)
	return &exp
}

// ValidatePolicy checks that a policy configuration is valid.
func (pm *PolicyManager) ValidatePolicy(name, dataCategory, deletionMethod string, retentionDays int) error {
	if name == "" {
		return fmt.Errorf("policy name is required")
	}
	if dataCategory == "" {
		return fmt.Errorf("data category is required")
	}

	validMethods := map[string]bool{
		"soft_delete": true, "hard_delete": true,
		"anonymize": true, "pseudonymize": true,
	}
	if deletionMethod != "" && !validMethods[deletionMethod] {
		return fmt.Errorf("invalid deletion method: %s", deletionMethod)
	}

	if retentionDays < -1 {
		return fmt.Errorf("retention_period_days must be >= -1")
	}

	return nil
}
