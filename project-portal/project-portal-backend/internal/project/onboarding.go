package project

// OnboardingStep represents a step in the project onboarding process
type OnboardingStep struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Order       int    `json:"order"`
	Required    bool   `json:"required"`
	Completed   bool   `json:"completed"`
}

// OnboardingProgress represents the overall onboarding progress
type OnboardingProgress struct {
	ProjectID       string           `json:"project_id"`
	CurrentStep     int              `json:"current_step"`
	TotalSteps      int              `json:"total_steps"`
	PercentComplete float64          `json:"percent_complete"`
	Steps           []OnboardingStep `json:"steps"`
}

// OnboardingService handles project onboarding
type OnboardingService struct {
	// Add dependencies as needed
}

// NewOnboardingService creates a new onboarding service
func NewOnboardingService() *OnboardingService {
	return &OnboardingService{}
}
