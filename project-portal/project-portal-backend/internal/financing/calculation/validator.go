package calculation

import (
	"fmt"
	"time"
)

type ValidationInput struct {
	MethodologyCode string
	PeriodStart     time.Time
	PeriodEnd       time.Time
	AreaHectares    float64
	DataQuality     float64
}

type Validator struct{}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) Validate(input ValidationInput) error {
	if !SupportedMethodology(input.MethodologyCode) {
		return fmt.Errorf("unsupported methodology_code: %s", input.MethodologyCode)
	}
	if input.AreaHectares <= 0 {
		return fmt.Errorf("area_hectares must be greater than zero")
	}
	if input.DataQuality < 0 || input.DataQuality > 1 {
		return fmt.Errorf("data_quality must be between 0 and 1")
	}
	if !input.PeriodEnd.After(input.PeriodStart) {
		return fmt.Errorf("period_end must be after period_start")
	}
	periodDays := input.PeriodEnd.Sub(input.PeriodStart).Hours() / 24
	if periodDays < 30 {
		return fmt.Errorf("minimum monitoring period is 30 days")
	}
	if periodDays > 3650 {
		return fmt.Errorf("monitoring period is too large")
	}
	return nil
}
