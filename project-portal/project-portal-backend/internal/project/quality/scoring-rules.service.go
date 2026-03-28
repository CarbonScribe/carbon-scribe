package quality

import (
	"context"
	"fmt"
)

// ScoringRulesService loads and evaluates configurable scoring rules.
// Rules are stored in the scoring_rules table so they can be tuned without
// code deployments.
type ScoringRulesService struct {
	repo ScoreRepository
}

func NewScoringRulesService(repo ScoreRepository) *ScoringRulesService {
	return &ScoringRulesService{repo: repo}
}

// EvaluateRegistry returns points for the given registry name using active
// REGISTRY rules from the database. Falls back to hard-coded defaults when
// no matching rule exists.
func (s *ScoringRulesService) EvaluateRegistry(ctx context.Context, registry string) (int, error) {
	rules, err := s.repo.GetActiveRulesByType(ctx, RuleTypeRegistry)
	if err != nil {
		return 0, fmt.Errorf("fetch registry rules: %w", err)
	}

	for _, rule := range rules {
		if val, ok := rule.Condition["registry"]; ok && val == registry {
			return rule.Points, nil
		}
	}

	// Hard-coded fallback table (issue spec §Scoring Components)
	return defaultRegistryPoints(registry), nil
}

// EvaluateAuthority returns authority score for the given on-chain issuer.
func (s *ScoringRulesService) EvaluateAuthority(ctx context.Context, issuerAddress string, verified bool) (int, error) {
	rules, err := s.repo.GetActiveRulesByType(ctx, RuleTypeAuthority)
	if err != nil {
		return 0, fmt.Errorf("fetch authority rules: %w", err)
	}

	for _, rule := range rules {
		if val, ok := rule.Condition["verified"]; ok {
			if bv, _ := val.(bool); bv == verified {
				return rule.Points, nil
			}
		}
	}

	if verified {
		return 20, nil
	}
	return 0, nil
}

// EvaluateMethodology returns points for the given methodology type string.
func (s *ScoringRulesService) EvaluateMethodology(ctx context.Context, methodologyType string) (int, error) {
	rules, err := s.repo.GetActiveRulesByType(ctx, RuleTypeMethodology)
	if err != nil {
		return 0, fmt.Errorf("fetch methodology rules: %w", err)
	}

	for _, rule := range rules {
		if val, ok := rule.Condition["methodology_type"]; ok && val == methodologyType {
			return rule.Points, nil
		}
	}

	return defaultMethodologyPoints(methodologyType), nil
}

// EvaluateVersion returns points for a methodology version string.
func (s *ScoringRulesService) EvaluateVersion(ctx context.Context, version string) (int, error) {
	rules, err := s.repo.GetActiveRulesByType(ctx, RuleTypeVersion)
	if err != nil {
		return 0, fmt.Errorf("fetch version rules: %w", err)
	}

	for _, rule := range rules {
		if val, ok := rule.Condition["version"]; ok && val == version {
			return rule.Points, nil
		}
	}

	return defaultVersionPoints(version), nil
}

// EvaluateDocumentation returns 15 when an IPFS CID is present, 0 otherwise.
func (s *ScoringRulesService) EvaluateDocumentation(ctx context.Context, ipfsCID string) (int, error) {
	rules, err := s.repo.GetActiveRulesByType(ctx, RuleTypeDocumentation)
	if err != nil {
		return 0, fmt.Errorf("fetch documentation rules: %w", err)
	}

	hasCID := ipfsCID != ""
	for _, rule := range rules {
		if val, ok := rule.Condition["has_cid"]; ok {
			if bv, _ := val.(bool); bv == hasCID {
				return rule.Points, nil
			}
		}
	}

	if hasCID {
		return 15, nil
	}
	return 0, nil
}

// --- static fallback tables (mirrors issue spec) ---

func defaultRegistryPoints(registry string) int {
	switch registry {
	case "Verra", "Gold Standard":
		return 30
	case "CAR", "Plan Vivo":
		return 20
	case "Regional":
		return 10
	default:
		return 5
	}
}

func defaultMethodologyPoints(t string) int {
	switch t {
	case "Afforestation", "Reforestation":
		return 20
	case "IFM":
		return 18
	case "Agroforestry":
		return 15
	case "Soil Carbon":
		return 12
	default:
		return 8
	}
}

func defaultVersionPoints(version string) int {
	switch version {
	case "":
		return 10 // unknown
	case "v1":
		return 8
	default:
		// v2 and above
		return 15
	}
}