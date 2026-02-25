package calculation

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Validator handles validation of calculation requests and methodology data
type Validator struct {
	// Can add validation rules and configurations here
}

// NewValidator creates a new validator instance
func NewValidator() *Validator {
	return &Validator{}
}

// ValidateCalculationRequest performs basic validation of calculation requests
func (v *Validator) ValidateCalculationRequest(req *CalculationRequest) error {
	// Validate required fields
	if req.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}

	if req.VintageYear <= 0 || req.VintageYear > time.Now().Year()+1 {
		return fmt.Errorf("invalid vintage_year: must be between 1 and %d", time.Now().Year()+1)
	}

	if req.MethodologyCode == "" {
		return fmt.Errorf("methodology_code is required")
	}

	// Validate calculation period
	if req.CalculationPeriod.Start.IsZero() || req.CalculationPeriod.End.IsZero() {
		return fmt.Errorf("calculation_period start and end dates are required")
	}

	if req.CalculationPeriod.End.Before(req.CalculationPeriod.Start) {
		return fmt.Errorf("calculation_period end date must be after start date")
	}

	// Validate data quality score if provided
	if req.DataQualityScore != nil {
		if *req.DataQualityScore < 0 || *req.DataQualityScore > 1 {
			return fmt.Errorf("data_quality_score must be between 0 and 1")
		}
	}

	// Validate that monitoring data is provided
	if len(req.MonitoringData) == 0 {
		return fmt.Errorf("monitoring_data is required")
	}

	return nil
}

// ValidateMethodologyData validates methodology-specific data requirements
func (v *Validator) ValidateMethodologyData(methodologyCode string, data map[string]interface{}) error {
	switch methodologyCode {
	case "VM0007":
		return v.validateVM0007Data(data)
	case "VM0015":
		return v.validateVM0015Data(data)
	case "VM0033":
		return v.validateVM0033Data(data)
	default:
		return fmt.Errorf("unsupported methodology: %s", methodologyCode)
	}
}

// validateVM0007Data validates VM0007 (Improved Forest Management) specific data
func (v *Validator) validateVM0007Data(data map[string]interface{}) error {
	// Check for required forest inventory data
	if inventory, ok := data["forest_inventory"].(map[string]interface{}); ok {
		if _, hasStrata := inventory["strata"]; !hasStrata {
			return fmt.Errorf("forest_inventory.strata is required for VM0007")
		}

		// Validate strata data if present
		if strata, ok := inventory["strata"].([]interface{}); ok {
			for i, stratum := range strata {
				stratumData, ok := stratum.(map[string]interface{})
				if !ok {
					return fmt.Errorf("invalid stratum data at index %d", i)
				}

				// Check for required stratum fields
				requiredFields := []string{"area"}
				for _, field := range requiredFields {
					if _, exists := stratumData[field]; !exists {
						return fmt.Errorf("stratum[%d].%s is required", i, field)
					}
				}

				// Validate area is positive
				if area, ok := stratumData["area"].(float64); ok {
					if area <= 0 {
						return fmt.Errorf("stratum[%d].area must be positive", i)
					}
				}
			}
		}
	} else {
		return fmt.Errorf("forest_inventory is required for VM0007")
	}

	// Validate management activities
	if _, ok := data["management_activities"]; !ok {
		return fmt.Errorf("management_activities is required for VM0007")
	}

	return nil
}

// validateVM0015Data validates VM0015 (Avoided Grassland Conversion) specific data
func (v *Validator) validateVM0015Data(data map[string]interface{}) error {
	// Check for grassland area
	if area, ok := data["grassland_area"].(float64); !ok || area <= 0 {
		return fmt.Errorf("grassland_area must be a positive number for VM0015")
	}

	// Check for carbon stock density
	if carbonStock, ok := data["carbon_stock_density"].(float64); !ok || carbonStock <= 0 {
		return fmt.Errorf("carbon_stock_density must be a positive number for VM0015")
	}

	// Validate project activities
	if _, ok := data["project_activities"]; !ok {
		return fmt.Errorf("project_activities is required for VM0015")
	}

	return nil
}

// validateVM0033Data validates VM0033 (Soil Carbon Sequestration) specific data
func (v *Validator) validateVM0033Data(data map[string]interface{}) error {
	// Check for soil carbon measurements
	if measurements, ok := data["soil_carbon_measurements"].([]interface{}); ok {
		if len(measurements) == 0 {
			return fmt.Errorf("soil_carbon_measurements cannot be empty for VM0033")
		}

		for i, measurement := range measurements {
			measurementData, ok := measurement.(map[string]interface{})
			if !ok {
				return fmt.Errorf("invalid soil carbon measurement at index %d", i)
			}

			// Check for required measurement fields
			requiredFields := []string{"area", "bulk_density", "soc_concentration", "depth"}
			for _, field := range requiredFields {
				if _, exists := measurementData[field]; !exists {
					return fmt.Errorf("soil_carbon_measurements[%d].%s is required", i, field)
				}
			}

			// Validate numeric values are positive
			if area, ok := measurementData["area"].(float64); ok && area <= 0 {
				return fmt.Errorf("soil_carbon_measurements[%d].area must be positive", i)
			}
			if bulkDensity, ok := measurementData["bulk_density"].(float64); ok && bulkDensity <= 0 {
				return fmt.Errorf("soil_carbon_measurements[%d].bulk_density must be positive", i)
			}
			if soc, ok := measurementData["soc_concentration"].(float64); ok && soc <= 0 {
				return fmt.Errorf("soil_carbon_measurements[%d].soc_concentration must be positive", i)
			}
			if depth, ok := measurementData["depth"].(float64); ok && depth <= 0 {
				return fmt.Errorf("soil_carbon_measurements[%d].depth must be positive", i)
			}
		}
	} else {
		return fmt.Errorf("soil_carbon_measurements is required for VM0033")
	}

	// Validate land management practices
	if _, ok := data["land_management_practices"]; !ok {
		return fmt.Errorf("land_management_practices is required for VM0033")
	}

	return nil
}

// ValidateMonitoringPeriod validates that monitoring period meets methodology requirements
func (v *Validator) ValidateMonitoringPeriod(methodologyCode string, period map[string]interface{}) error {
	startStr, hasStart := period["start"].(string)
	endStr, hasEnd := period["end"].(string)

	if !hasStart || !hasEnd {
		return fmt.Errorf("monitoring_period must include start and end dates")
	}

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		return fmt.Errorf("invalid start date format in monitoring_period: %w", err)
	}

	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		return fmt.Errorf("invalid end date format in monitoring_period: %w", err)
	}

	if end.Before(start) {
		return fmt.Errorf("monitoring_period end date must be after start date")
	}

	duration := end.Sub(start)

	// Check minimum monitoring periods by methodology
	switch methodologyCode {
	case "VM0007":
		if duration.Hours() < 24*365 { // Less than 1 year
			return fmt.Errorf("VM0007 requires minimum 1 year monitoring period")
		}
	case "VM0015":
		if duration.Hours() < 24*365 { // Less than 1 year
			return fmt.Errorf("VM0015 requires minimum 1 year monitoring period")
		}
	case "VM0033":
		if duration.Hours() < 24*730 { // Less than 2 years
			return fmt.Errorf("VM0033 requires minimum 2 years monitoring period")
		}
	}

	return nil
}

// ValidateDataQuality performs comprehensive data quality assessment
func (v *Validator) ValidateDataQuality(monitoringData datatypes.JSON) (*ValidationResults, error) {
	var data map[string]interface{}
	if err := json.Unmarshal(monitoringData, &data); err != nil {
		return nil, fmt.Errorf("failed to parse monitoring data: %w", err)
	}

	results := &ValidationResults{
		IsValid:  true,
		Errors:   []ValidationError{},
		Warnings: []ValidationWarning{},
	}

	// Check for data completeness
	completenessScore := v.assessDataCompleteness(data)

	// Check for data consistency
	consistencyScore := v.assessDataConsistency(data)

	// Check for temporal coverage
	temporalScore := v.assessTemporalCoverage(data)

	// Calculate overall quality score
	qualityScore := (completenessScore + consistencyScore + temporalScore) / 3.0
	results.QualityScore = qualityScore

	// Add warnings for quality issues
	if completenessScore < 0.7 {
		results.Warnings = append(results.Warnings, ValidationWarning{
			Field:   "data_completeness",
			Message: "Data completeness is below recommended threshold",
			Code:    "LOW_COMPLETENESS",
		})
	}

	if consistencyScore < 0.7 {
		results.Warnings = append(results.Warnings, ValidationWarning{
			Field:   "data_consistency",
			Message: "Data consistency issues detected",
			Code:    "LOW_CONSISTENCY",
		})
	}

	if temporalScore < 0.7 {
		results.Warnings = append(results.Warnings, ValidationWarning{
			Field:   "temporal_coverage",
			Message: "Temporal coverage is insufficient",
			Code:    "LOW_TEMPORAL_COVERAGE",
		})
	}

	// Mark as invalid if quality is too low
	if qualityScore < 0.5 {
		results.IsValid = false
		results.Errors = append(results.Errors, ValidationError{
			Field:   "overall_quality",
			Message: "Data quality is too low for reliable calculations",
			Code:    "LOW_QUALITY",
		})
	}

	return results, nil
}

// assessDataCompleteness evaluates the completeness of monitoring data
func (v *Validator) assessDataCompleteness(data map[string]interface{}) float64 {
	// Define key data sources and their weights
	dataSources := map[string]float64{
		"satellite_data":           0.25,
		"ground_measurements":      0.25,
		"iot_sensor_data":          0.20,
		"third_party_verification": 0.15,
		"historical_baseline":      0.15,
	}

	var totalScore float64
	var totalWeight float64

	for source, weight := range dataSources {
		if _, exists := data[source]; exists {
			// Check data quality within each source
			if sourceData, ok := data[source].(map[string]interface{}); ok {
				if completeness, ok := sourceData["completeness"].(float64); ok {
					totalScore += completeness * weight
				} else {
					// Assume 80% completeness if not specified
					totalScore += 0.8 * weight
				}
			} else {
				// Simple presence check
				totalScore += 0.7 * weight
			}
			totalWeight += weight
		}
	}

	if totalWeight == 0 {
		return 0.3 // Very low score if no data sources
	}

	return totalScore / totalWeight
}

// assessDataConsistency evaluates the consistency of monitoring data
func (v *Validator) assessDataConsistency(data map[string]interface{}) float64 {
	var consistencyScore float64 = 1.0

	// Check for logical consistency in measurements
	if measurements, ok := data["measurements"].([]interface{}); ok {
		for _, measurement := range measurements {
			if m, ok := measurement.(map[string]interface{}); ok {
				// Check for reasonable value ranges
				if value, ok := m["value"].(float64); ok {
					if value < 0 || value > 10000 { // Example range check
						consistencyScore -= 0.1
					}
				}

				// Check for timestamp consistency
				if timestamp, ok := m["timestamp"].(string); ok {
					if _, err := time.Parse(time.RFC3339, timestamp); err != nil {
						consistencyScore -= 0.05
					}
				}
			}
		}
	}

	// Ensure score doesn't go below 0
	if consistencyScore < 0 {
		consistencyScore = 0
	}

	return consistencyScore
}

// assessTemporalCoverage evaluates the temporal coverage of monitoring data
func (v *Validator) assessTemporalCoverage(data map[string]interface{}) float64 {
	var temporalScore float64

	// Check monitoring period
	if period, ok := data["monitoring_period"].(map[string]interface{}); ok {
		startStr, hasStart := period["start"].(string)
		endStr, hasEnd := period["end"].(string)

		if hasStart && hasEnd {
			start, err1 := time.Parse(time.RFC3339, startStr)
			end, err2 := time.Parse(time.RFC3339, endStr)

			if err1 == nil && err2 == nil {
				duration := end.Sub(start)

				// Score based on duration (higher for longer periods)
				if duration.Hours() >= 24*365*2 { // 2+ years
					temporalScore = 1.0
				} else if duration.Hours() >= 24*365 { // 1+ years
					temporalScore = 0.8
				} else if duration.Hours() >= 24*180 { // 6+ months
					temporalScore = 0.6
				} else if duration.Hours() >= 24*30 { // 1+ month
					temporalScore = 0.4
				} else {
					temporalScore = 0.2
				}
			}
		}
	}

	// Check measurement frequency
	if measurements, ok := data["measurements"].([]interface{}); ok {
		measurementCount := len(measurements)

		// Bonus points for more frequent measurements
		if measurementCount >= 12 {
			temporalScore += 0.1
		} else if measurementCount >= 6 {
			temporalScore += 0.05
		}
	}

	// Ensure score doesn't exceed 1.0
	if temporalScore > 1.0 {
		temporalScore = 1.0
	}

	return temporalScore
}

// ValidateBaselineData validates baseline scenario data
func (v *Validator) ValidateBaselineData(baselineData datatypes.JSON) error {
	var data map[string]interface{}
	if err := json.Unmarshal(baselineData, &data); err != nil {
		return fmt.Errorf("failed to parse baseline data: %w", err)
	}

	// Check for required baseline fields
	requiredFields := []string{"baseline_scenario", "reference_period"}
	for _, field := range requiredFields {
		if _, exists := data[field]; !exists {
			return fmt.Errorf("baseline_data.%s is required", field)
		}
	}

	// Validate reference period
	if refPeriod, ok := data["reference_period"].(map[string]interface{}); ok {
		startStr, hasStart := refPeriod["start"].(string)
		endStr, hasEnd := refPeriod["end"].(string)

		if !hasStart || !hasEnd {
			return fmt.Errorf("reference_period must include start and end dates")
		}

		start, err1 := time.Parse(time.RFC3339, startStr)
		end, err2 := time.Parse(time.RFC3339, endStr)

		if err1 != nil || err2 != nil {
			return fmt.Errorf("invalid reference period date format")
		}

		if end.Before(start) {
			return fmt.Errorf("reference_period end date must be after start date")
		}
	}

	return nil
}

// ValidateUncertaintyFactors validates uncertainty factor inputs
func (v *Validator) ValidateUncertaintyFactors(factors map[string]interface{}) error {
	// Check for valid uncertainty factor types
	validFactors := []string{
		"measurement_error",
		"spatial_variability",
		"temporal_variability",
		"model_uncertainty",
		"sampling_error",
	}

	for factor := range factors {
		isValid := false
		for _, valid := range validFactors {
			if factor == valid {
				isValid = true
				break
			}
		}

		if !isValid {
			return fmt.Errorf("unknown uncertainty factor: %s", factor)
		}
	}

	// Validate factor values are reasonable
	for factor, value := range factors {
		if val, ok := value.(float64); ok {
			if val < 0 || val > 1 {
				return fmt.Errorf("uncertainty factor %s must be between 0 and 1", factor)
			}
		} else {
			return fmt.Errorf("uncertainty factor %s must be a number", factor)
		}
	}

	return nil
}
