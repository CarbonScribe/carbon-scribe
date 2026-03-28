package quality

import (
	"time"

	"github.com/google/uuid"
)

// ScoreComponents holds the breakdown of individual score dimensions.
type ScoreComponents struct {
	Registry      int `json:"registry"`
	Authority     int `json:"authority"`
	Methodology   int `json:"methodology"`
	Version       int `json:"version"`
	Documentation int `json:"documentation"`
}

// ProjectQualityScore is the primary domain model stored in project_quality_scores.
type ProjectQualityScore struct {
	ID                  uuid.UUID       `json:"id" db:"id"`
	ProjectID           uuid.UUID       `json:"project_id" db:"project_id"`
	MethodologyTokenID  int             `json:"methodology_token_id" db:"methodology_token_id"`
	OverallScore        int             `json:"overall_score" db:"overall_score"`
	Components          ScoreComponents `json:"components" db:"components"`
	MethodologyScore    int             `json:"methodology_score" db:"methodology_score"`
	AuthorityScore      int             `json:"authority_score" db:"authority_score"`
	RegistryScore       int             `json:"registry_score" db:"registry_score"`
	VersionScore        int             `json:"version_score" db:"version_score"`
	DocumentationScore  int             `json:"documentation_score" db:"documentation_score"`
	CalculatedAt        time.Time       `json:"calculated_at" db:"calculated_at"`
	ValidUntil          *time.Time      `json:"valid_until,omitempty" db:"valid_until"`
}

// QualityScoreHistory tracks every change to a project's score over time.
type QualityScoreHistory struct {
	ID        uuid.UUID       `json:"id" db:"id"`
	ProjectID uuid.UUID       `json:"project_id" db:"project_id"`
	Score     int             `json:"score" db:"score"`
	Components ScoreComponents `json:"components" db:"components"`
	Reason    string          `json:"reason" db:"reason"`
	ChangedBy string          `json:"changed_by" db:"changed_by"`
	CreatedAt time.Time       `json:"created_at" db:"created_at"`
}

// ScoringRule is a configurable rule loaded from the scoring_rules table.
type ScoringRule struct {
	ID        uuid.UUID              `json:"id" db:"id"`
	RuleType  string                 `json:"rule_type" db:"rule_type"`
	Condition map[string]interface{} `json:"condition" db:"condition"`
	Points    int                    `json:"points" db:"points"`
	Priority  int                    `json:"priority" db:"priority"`
	IsActive  bool                   `json:"is_active" db:"is_active"`
	CreatedAt time.Time              `json:"created_at" db:"created_at"`
}

// RuleType constants mirror the CHECK constraint on scoring_rules.rule_type.
const (
	RuleTypeRegistry      = "REGISTRY"
	RuleTypeAuthority     = "AUTHORITY"
	RuleTypeVersion       = "VERSION"
	RuleTypeDocumentation = "DOCUMENTATION"
	RuleTypeMethodology   = "METHODOLOGY"
)

// --- Request / Response DTOs ---

// QualityScoreResponse is the HTTP response for GET /quality-score.
type QualityScoreResponse struct {
	ProjectQualityScore
	ScoreLabel string `json:"score_label"` // e.g. "High", "Medium", "Low"
}

// RecalculateRequest is the body for POST /quality-score/recalculate.
type RecalculateRequest struct {
	Reason    string `json:"reason"`
	ChangedBy string `json:"changed_by"`
}

// RankingEntry is a single row in the quality ranking response.
type RankingEntry struct {
	ProjectID    uuid.UUID `json:"project_id"`
	ProjectName  string    `json:"project_name"`
	OverallScore int       `json:"overall_score"`
	ScoreLabel   string    `json:"score_label"`
	CalculatedAt time.Time `json:"calculated_at"`
}

// ScoreLabel returns a human-readable tier label for a score 0-100.
func ScoreLabel(score int) string {
	switch {
	case score >= 80:
		return "High"
	case score >= 50:
		return "Medium"
	default:
		return "Low"
	}
}