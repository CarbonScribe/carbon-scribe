package quality

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Example implementation of Repository (stub)
type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetScore(ctx context.Context, projectID string) (*ProjectQualityScore, error) {
	var score ProjectQualityScore
	err := r.db.WithContext(ctx).Table("project_quality_scores").
		Where("project_id = ?", projectID).
		Order("calculated_at DESC").
		First(&score).Error
	if err != nil {
		return nil, err
	}
	return &score, nil
}

func (r *repository) GetScoreHistory(ctx context.Context, projectID string) ([]QualityScoreHistory, error) {
	var history []QualityScoreHistory
	err := r.db.WithContext(ctx).Table("quality_score_history").
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&history).Error
	if err != nil {
		return nil, err
	}
	return history, nil
}

func (r *repository) SaveScore(ctx context.Context, score *ProjectQualityScore) error {
	if score.ID == "" {
		score.ID = uuid.New().String()
	}
	// Upsert by project_id + methodology_token_id
	return r.db.WithContext(ctx).Table("project_quality_scores").
		Where("project_id = ? AND methodology_token_id = ?", score.ProjectID, score.MethodologyTokenID).
		Assign(score).
		FirstOrCreate(score).Error
}

func (r *repository) AddScoreHistory(ctx context.Context, history *QualityScoreHistory) error {
	if history.ID == "" {
		history.ID = uuid.New().String()
	}
	return r.db.WithContext(ctx).Table("quality_score_history").Create(history).Error
}

func (r *repository) ListTopScores(ctx context.Context, limit int) ([]ProjectQualityScore, error) {
	var scores []ProjectQualityScore
	err := r.db.WithContext(ctx).Table("project_quality_scores").
		Order("overall_score DESC").
		Limit(limit).
		Find(&scores).Error
	if err != nil {
		return nil, err
	}
	return scores, nil
}

func (r *repository) GetScoringRules(ctx context.Context) ([]ScoringRule, error) {
	var rules []ScoringRule
	err := r.db.WithContext(ctx).Table("scoring_rules").
		Where("is_active = ?", true).
		Order("priority DESC, created_at DESC").
		Find(&rules).Error
	if err != nil {
		return nil, err
	}
	return rules, nil
}

func (r *repository) UpdateScoringRule(ctx context.Context, rule *ScoringRule) error {
	return r.db.WithContext(ctx).Table("scoring_rules").
		Where("id = ?", rule.ID).
		Updates(rule).Error
}
