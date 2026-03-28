package quality

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ScoreRepository is the persistence contract for quality scores.
type ScoreRepository interface {
	UpsertScore(ctx context.Context, score *ProjectQualityScore) error
	GetScoreByProject(ctx context.Context, projectID uuid.UUID) (*ProjectQualityScore, error)
	GetScoreHistory(ctx context.Context, projectID uuid.UUID, limit int) ([]QualityScoreHistory, error)
	AppendHistory(ctx context.Context, h *QualityScoreHistory) error
	GetActiveRulesByType(ctx context.Context, ruleType string) ([]ScoringRule, error)
	GetAllScoresRanked(ctx context.Context) ([]RankingEntry, error)
	GetAllProjectScores(ctx context.Context) ([]ProjectQualityScore, error)
}

// PostgresScoreRepository is the sqlx-backed implementation.
type PostgresScoreRepository struct {
	db *sqlx.DB
}

func NewPostgresScoreRepository(db *sqlx.DB) *PostgresScoreRepository {
	return &PostgresScoreRepository{db: db}
}

// UpsertScore inserts or updates a project's current quality score.
func (r *PostgresScoreRepository) UpsertScore(ctx context.Context, s *ProjectQualityScore) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	s.CalculatedAt = time.Now().UTC()

	componentsJSON, err := json.Marshal(s.Components)
	if err != nil {
		return fmt.Errorf("marshal components: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO project_quality_scores (
			id, project_id, methodology_token_id, overall_score,
			components, methodology_score, authority_score, registry_score,
			version_score, documentation_score, calculated_at, valid_until
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (project_id, methodology_token_id) DO UPDATE SET
			overall_score        = EXCLUDED.overall_score,
			components           = EXCLUDED.components,
			methodology_score    = EXCLUDED.methodology_score,
			authority_score      = EXCLUDED.authority_score,
			registry_score       = EXCLUDED.registry_score,
			version_score        = EXCLUDED.version_score,
			documentation_score  = EXCLUDED.documentation_score,
			calculated_at        = EXCLUDED.calculated_at,
			valid_until          = EXCLUDED.valid_until`,
		s.ID, s.ProjectID, s.MethodologyTokenID, s.OverallScore,
		componentsJSON, s.MethodologyScore, s.AuthorityScore, s.RegistryScore,
		s.VersionScore, s.DocumentationScore, s.CalculatedAt, s.ValidUntil,
	)
	return err
}

// GetScoreByProject fetches the current score for a project.
func (r *PostgresScoreRepository) GetScoreByProject(ctx context.Context, projectID uuid.UUID) (*ProjectQualityScore, error) {
	row := r.db.QueryRowxContext(ctx, `
		SELECT id, project_id, methodology_token_id, overall_score,
		       components, methodology_score, authority_score, registry_score,
		       version_score, documentation_score, calculated_at, valid_until
		FROM project_quality_scores
		WHERE project_id = $1
		ORDER BY calculated_at DESC
		LIMIT 1`, projectID)

	var s ProjectQualityScore
	var componentsJSON []byte

	err := row.Scan(
		&s.ID, &s.ProjectID, &s.MethodologyTokenID, &s.OverallScore,
		&componentsJSON, &s.MethodologyScore, &s.AuthorityScore, &s.RegistryScore,
		&s.VersionScore, &s.DocumentationScore, &s.CalculatedAt, &s.ValidUntil,
	)
	if err != nil {
		return nil, fmt.Errorf("get score by project: %w", err)
	}

	if err := json.Unmarshal(componentsJSON, &s.Components); err != nil {
		return nil, fmt.Errorf("unmarshal components: %w", err)
	}
	return &s, nil
}

// GetScoreHistory returns up to limit historical score entries for a project.
func (r *PostgresScoreRepository) GetScoreHistory(ctx context.Context, projectID uuid.UUID, limit int) ([]QualityScoreHistory, error) {
	rows, err := r.db.QueryxContext(ctx, `
		SELECT id, project_id, score, components, reason, changed_by, created_at
		FROM quality_score_history
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT $2`, projectID, limit)
	if err != nil {
		return nil, fmt.Errorf("get score history: %w", err)
	}
	defer rows.Close()

	var history []QualityScoreHistory
	for rows.Next() {
		var h QualityScoreHistory
		var componentsJSON []byte
		if err := rows.Scan(&h.ID, &h.ProjectID, &h.Score, &componentsJSON, &h.Reason, &h.ChangedBy, &h.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(componentsJSON, &h.Components); err != nil {
			return nil, err
		}
		history = append(history, h)
	}
	return history, rows.Err()
}

// AppendHistory writes a new history record.
func (r *PostgresScoreRepository) AppendHistory(ctx context.Context, h *QualityScoreHistory) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	h.CreatedAt = time.Now().UTC()

	componentsJSON, err := json.Marshal(h.Components)
	if err != nil {
		return fmt.Errorf("marshal components: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO quality_score_history (id, project_id, score, components, reason, changed_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		h.ID, h.ProjectID, h.Score, componentsJSON, h.Reason, h.ChangedBy, h.CreatedAt,
	)
	return err
}

// GetActiveRulesByType returns all active rules for a given rule type, ordered by priority desc.
func (r *PostgresScoreRepository) GetActiveRulesByType(ctx context.Context, ruleType string) ([]ScoringRule, error) {
	rows, err := r.db.QueryxContext(ctx, `
		SELECT id, rule_type, condition, points, priority, is_active, created_at
		FROM scoring_rules
		WHERE rule_type = $1 AND is_active = TRUE
		ORDER BY priority DESC`, ruleType)
	if err != nil {
		return nil, fmt.Errorf("get rules by type: %w", err)
	}
	defer rows.Close()

	var rules []ScoringRule
	for rows.Next() {
		var rule ScoringRule
		var conditionJSON []byte
		if err := rows.Scan(&rule.ID, &rule.RuleType, &conditionJSON, &rule.Points, &rule.Priority, &rule.IsActive, &rule.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(conditionJSON, &rule.Condition); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return rules, rows.Err()
}

// GetAllScoresRanked returns all projects ordered by overall quality score descending.
func (r *PostgresScoreRepository) GetAllScoresRanked(ctx context.Context) ([]RankingEntry, error) {
	rows, err := r.db.QueryxContext(ctx, `
		SELECT pqs.project_id, p.name AS project_name, pqs.overall_score, pqs.calculated_at
		FROM project_quality_scores pqs
		JOIN projects p ON p.id = pqs.project_id
		ORDER BY pqs.overall_score DESC`)
	if err != nil {
		return nil, fmt.Errorf("get ranked scores: %w", err)
	}
	defer rows.Close()

	var entries []RankingEntry
	for rows.Next() {
		var e RankingEntry
		if err := rows.Scan(&e.ProjectID, &e.ProjectName, &e.OverallScore, &e.CalculatedAt); err != nil {
			return nil, err
		}
		e.ScoreLabel = ScoreLabel(e.OverallScore)
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// GetAllProjectScores returns all current quality scores (used for batch contract sync).
func (r *PostgresScoreRepository) GetAllProjectScores(ctx context.Context) ([]ProjectQualityScore, error) {
	rows, err := r.db.QueryxContext(ctx, `
		SELECT id, project_id, methodology_token_id, overall_score,
		       components, methodology_score, authority_score, registry_score,
		       version_score, documentation_score, calculated_at, valid_until
		FROM project_quality_scores
		ORDER BY calculated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("get all scores: %w", err)
	}
	defer rows.Close()

	var scores []ProjectQualityScore
	for rows.Next() {
		var s ProjectQualityScore
		var componentsJSON []byte
		if err := rows.Scan(
			&s.ID, &s.ProjectID, &s.MethodologyTokenID, &s.OverallScore,
			&componentsJSON, &s.MethodologyScore, &s.AuthorityScore, &s.RegistryScore,
			&s.VersionScore, &s.DocumentationScore, &s.CalculatedAt, &s.ValidUntil,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(componentsJSON, &s.Components); err != nil {
			return nil, err
		}
		scores = append(scores, s)
	}
	return scores, rows.Err()
}