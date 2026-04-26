package quality

// Models for project quality scoring
import (
	"time"
)

type ProjectQualityScore struct {
	ID                  string    `json:"id"`
	ProjectID           string    `json:"project_id"`
	MethodologyTokenID  int       `json:"methodology_token_id"`
	OverallScore        int       `json:"overall_score"`
	Components          map[string]int `json:"components"`
	MethodologyScore    int       `json:"methodology_score"`
	AuthorityScore      int       `json:"authority_score"`
	RegistryScore       int       `json:"registry_score"`
	VersionScore        int       `json:"version_score"`
	DocumentationScore  int       `json:"documentation_score"`
	CalculatedAt        time.Time `json:"calculated_at"`
	ValidUntil          *time.Time `json:"valid_until,omitempty"`
}

type QualityScoreHistory struct {
	ID         string         `json:"id"`
	ProjectID  string         `json:"project_id"`
	Score      int            `json:"score"`
	Components map[string]int `json:"components"`
	Reason     string         `json:"reason"`
	ChangedBy  string         `json:"changed_by"`
	CreatedAt  time.Time      `json:"created_at"`
}

type ScoringRule struct {
	ID        string      `json:"id"`
	RuleType  string      `json:"rule_type"`
	Condition interface{} `json:"condition"`
	Points    int         `json:"points"`
	Priority  int         `json:"priority"`
	IsActive  bool        `json:"is_active"`
	CreatedAt time.Time   `json:"created_at"`
}
