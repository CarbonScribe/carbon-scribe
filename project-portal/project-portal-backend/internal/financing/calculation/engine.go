package calculation

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Engine handles carbon credit calculations using various methodologies
type Engine struct {
	db           *gorm.DB
	validator    *Validator
	methodologies map[string]Methodology
}

// Methodology defines the interface for carbon calculation methodologies
type Methodology interface {
	// Calculate performs the carbon credit calculation
	Calculate(ctx context.Context, req *CalculationRequest) (*CalculationResult, error)
	
	// Validate validates the input data for the methodology
	Validate(ctx context.Context, req *CalculationRequest) error
	
	// GetMetadata returns methodology metadata
	GetMetadata() *MethodologyMetadata
	
	// ApplyUncertaintyBuffer applies conservative uncertainty buffers
	ApplyUncertaintyBuffer(tons float64, dataQuality float64) float64
}

// CalculationRequest represents a credit calculation request
type CalculationRequest struct {
	ProjectID           uuid.UUID              `json:"project_id"`
	VintageYear         int                    `json:"vintage_year"`
	MethodologyCode     string                 `json:"methodology_code"`
	CalculationPeriod   CalculationPeriod      `json:"calculation_period"`
	MonitoringData      datatypes.JSON         `json:"monitoring_data"`
	BaselineData        datatypes.JSON         `json:"baseline_data"`
	ProjectParameters   datatypes.JSON         `json:"project_parameters"`
	DataQualityScore    *float64               `json:"data_quality_score"`
	UncertaintyFactors  map[string]interface{} `json:"uncertainty_factors"`
	CalculationContext   map[string]interface{} `json:"calculation_context"`
}

// CalculationPeriod defines the time period for calculation
type CalculationPeriod struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// CalculationResult represents the result of a credit calculation
type CalculationResult struct {
	MethodologyCode     string                 `json:"methodology_code"`
	CalculatedTons      float64                `json:"calculated_tons"`
	BufferedTons        float64                `json:"buffered_tons"`
	DataQualityScore    float64                `json:"data_quality_score"`
	UncertaintyBuffer   float64                `json:"uncertainty_buffer"`
	CalculationSteps    []CalculationStep      `json:"calculation_steps"`
	InputData           map[string]interface{} `json:"input_data"`
	ValidationResults   *ValidationResults     `json:"validation_results"`
	Metadata            map[string]interface{} `json:"metadata"`
}

// CalculationStep represents a step in the calculation process
type CalculationStep struct {
	StepNumber int                    `json:"step_number"`
	Name       string                 `json:"name"`
	Description string                 `json:"description"`
	Formula    string                 `json:"formula"`
	Inputs     map[string]interface{} `json:"inputs"`
	Outputs    map[string]interface{} `json:"outputs"`
	Timestamp  time.Time              `json:"timestamp"`
}

// MethodologyMetadata contains information about a methodology
type MethodologyMetadata struct {
	Code               string                 `json:"code"`
	Name               string                 `json:"name"`
	Description        string                 `json:"description"`
	Version            string                 `json:"version"`
	Sector             string                 `json:"sector"`
	MinimumMonitoringPeriod int               `json:"minimum_monitoring_period"`
	RequiredDataFields []string               `json:"required_data_fields"`
	DefaultBuffers     map[string]float64     `json:"default_buffers"`
	CoBenefits         []string               `json:"co_benefits"`
	Certification      string                 `json:"certification"`
}

// ValidationResults contains validation outcomes
type ValidationResults struct {
	IsValid       bool                   `json:"is_valid"`
	Errors        []ValidationError      `json:"errors"`
	Warnings      []ValidationWarning    `json:"warnings"`
	MissingFields []string               `json:"missing_fields"`
	QualityScore  float64                `json:"quality_score"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// ValidationWarning represents a validation warning
type ValidationWarning struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// NewEngine creates a new credit calculation engine
func NewEngine(db *gorm.DB) *Engine {
	engine := &Engine{
		db:           db,
		validator:    NewValidator(),
		methodologies: make(map[string]Methodology),
	}
	
	// Register built-in methodologies
	engine.registerMethodologies()
	
	return engine
}

// registerMethodologies registers all supported calculation methodologies
func (e *Engine) registerMethodologies() {
	// Register VM0007 - Improved Forest Management
	e.methodologies["VM0007"] = &VM0007Methodology{}
	
	// Register VM0015 - Avoided Grassland Conversion
	e.methodologies["VM0015"] = &VM0015Methodology{}
	
	// Register VM0033 - Soil Carbon Sequestration
	e.methodologies["VM0033"] = &VM0033Methodology{}
}

// CalculateCredits performs carbon credit calculation for a project
func (e *Engine) CalculateCredits(ctx context.Context, req *CalculationRequest, userID uuid.UUID) (*financing.CarbonCredit, error) {
	// Validate request
	if err := e.validator.ValidateCalculationRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	// Get methodology implementation
	methodology, exists := e.methodologies[req.MethodologyCode]
	if !exists {
		return nil, fmt.Errorf("unsupported methodology: %s", req.MethodologyCode)
	}
	
	// Perform additional methodology-specific validation
	if err := methodology.Validate(ctx, req); err != nil {
		return nil, fmt.Errorf("methodology validation failed: %w", err)
	}
	
	// Execute calculation
	result, err := methodology.Calculate(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("calculation failed: %w", err)
	}
	
	// Create carbon credit record
	credit := &financing.CarbonCredit{
		ProjectID:              req.ProjectID,
		VintageYear:            req.VintageYear,
		CalculationPeriodStart: req.CalculationPeriod.Start,
		CalculationPeriodEnd:   req.CalculationPeriod.End,
		MethodologyCode:        req.MethodologyCode,
		CalculatedTons:         result.CalculatedTons,
		BufferedTons:           result.BufferedTons,
		DataQualityScore:       &result.DataQualityScore,
		Status:                 financing.CreditStatusCalculated,
		CreatedBy:              userID,
	}
	
	// Store calculation metadata
	stepsJSON, _ := json.Marshal(result.CalculationSteps)
	inputsJSON, _ := json.Marshal(result.InputData)
	uncertaintyJSON, _ := json.Marshal(req.UncertaintyFactors)
	baselineJSON, _ := json.Marshal(req.BaselineData)
	
	credit.CalculationSteps = datatypes.JSON(stepsJSON)
	credit.CalculationInputs = datatypes.JSON(inputsJSON)
	credit.UncertaintyFactors = datatypes.JSON(uncertaintyJSON)
	credit.BaselineScenario = datatypes.JSON(baselineJSON)
	
	// Save to database
	if err := e.db.Create(credit).Error; err != nil {
		return nil, fmt.Errorf("failed to save carbon credit: %w", err)
	}
	
	return credit, nil
}

// RecalculateCredits recalculates credits when new monitoring data arrives
func (e *Engine) RecalculateCredits(ctx context.Context, creditID uuid.UUID, newMonitoringData datatypes.JSON, userID uuid.UUID) (*financing.CarbonCredit, error) {
	// Get existing credit
	var credit financing.CarbonCredit
	if err := e.db.First(&credit, "id = ?", creditID).Error; err != nil {
		return nil, fmt.Errorf("credit not found: %w", err)
	}
	
	// Check if credit can be recalculated (only calculated or verified credits can be recalculated)
	if credit.Status != financing.CreditStatusCalculated && credit.Status != financing.CreditStatusVerified {
		return nil, fmt.Errorf("credit cannot be recalculated in status: %s", credit.Status)
	}
	
	// Parse existing calculation inputs
	var inputs map[string]interface{}
	if err := json.Unmarshal(credit.CalculationInputs, &inputs); err != nil {
		return nil, fmt.Errorf("failed to parse calculation inputs: %w", err)
	}
	
	// Update monitoring data
	inputs["monitoring_data"] = newMonitoringData
	
	// Create new calculation request
	req := &CalculationRequest{
		ProjectID:          credit.ProjectID,
		VintageYear:        credit.VintageYear,
		MethodologyCode:    credit.MethodologyCode,
		CalculationPeriod: CalculationPeriod{
			Start: credit.CalculationPeriodStart,
			End:   credit.CalculationPeriodEnd,
		},
		MonitoringData:     newMonitoringData,
		ProjectParameters:  credit.CalculationInputs,
		DataQualityScore:   credit.DataQualityScore,
	}
	
	// Perform recalculation
	newCredit, err := e.CalculateCredits(ctx, req, userID)
	if err != nil {
		return nil, fmt.Errorf("recalculation failed: %w", err)
	}
	
	// Update original credit status to cancelled
	credit.Status = financing.CreditStatusCancelled
	if err := e.db.Save(&credit).Error; err != nil {
		return nil, fmt.Errorf("failed to cancel original credit: %w", err)
	}
	
	return newCredit, nil
}

// GetCalculationHistory retrieves calculation history for a project
func (e *Engine) GetCalculationHistory(ctx context.Context, projectID uuid.UUID, limit int) ([]financing.CarbonCredit, error) {
	var credits []financing.CarbonCredit
	query := e.db.Where("project_id = ?", projectID).
		Order("created_at DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	if err := query.Find(&credits).Error; err != nil {
		return nil, fmt.Errorf("failed to retrieve calculation history: %w", err)
	}
	
	return credits, nil
}

// ValidateCalculation validates a calculation request without executing it
func (e *Engine) ValidateCalculation(ctx context.Context, req *CalculationRequest) (*ValidationResults, error) {
	// Basic validation
	if err := e.validator.ValidateCalculationRequest(req); err != nil {
		return &ValidationResults{
			IsValid:  false,
			Errors:   []ValidationError{{Field: "general", Message: err.Error(), Code: "VALIDATION_ERROR"}},
		}, nil
	}
	
	// Get methodology
	methodology, exists := e.methodologies[req.MethodologyCode]
	if !exists {
		return &ValidationResults{
			IsValid: false,
			Errors:  []ValidationError{{Field: "methodology_code", Message: "Unsupported methodology", Code: "UNSUPPORTED_METHODOLOGY"}},
		}, nil
	}
	
	// Methodology-specific validation
	if err := methodology.Validate(ctx, req); err != nil {
		return &ValidationResults{
			IsValid: false,
			Errors:  []ValidationError{{Field: "methodology_data", Message: err.Error(), Code: "METHODOLOGY_VALIDATION_ERROR"}},
		}, nil
	}
	
	return &ValidationResults{
		IsValid:      true,
		QualityScore: *req.DataQualityScore,
	}, nil
}

// GetSupportedMethodologies returns a list of supported methodologies
func (e *Engine) GetSupportedMethodologies() []MethodologyMetadata {
	var methodologies []MethodologyMetadata
	for _, methodology := range e.methodologies {
		methodologies = append(methodologies, *methodology.GetMetadata())
	}
	return methodologies
}

// ApplyUncertaintyBuffer applies uncertainty buffers based on data quality
func ApplyUncertaintyBuffer(tons float64, dataQualityScore float64, methodologyCode string) float64 {
	// Base uncertainty buffer percentages by methodology
	baseBuffers := map[string]float64{
		"VM0007": 0.20, // Improved Forest Management
		"VM0015": 0.25, // Avoided Grassland Conversion  
		"VM0033": 0.30, // Soil Carbon Sequestration
	}
	
	baseBuffer := baseBuffers[methodologyCode]
	if baseBuffer == 0 {
		baseBuffer = 0.25 // Default buffer
	}
	
	// Adjust buffer based on data quality score (0.0 to 1.0)
	// Higher data quality = lower buffer
	qualityAdjustment := (1.0 - dataQualityScore) * 0.5 // Up to 50% additional buffer
	totalBuffer := baseBuffer * (1.0 + qualityAdjustment)
	
	// Apply buffer (conservative approach)
	bufferedTons := tons * (1.0 - totalBuffer)
	
	// Ensure we don't go negative
	if bufferedTons < 0 {
		bufferedTons = 0
	}
	
	// Round to 4 decimal places
	return math.Round(bufferedTons*10000) / 10000
}

// EstimateDataQuality estimates data quality score based on monitoring data completeness
func EstimateDataQuality(monitoringData map[string]interface{}) float64 {
	// Factors that contribute to data quality
	factors := map[string]float64{
		"satellite_data":        0.3,
		"ground_measurements":   0.25,
		"iot_sensor_data":       0.2,
		"third_party_verification": 0.15,
		"historical_baseline":   0.1,
	}
	
	var totalScore float64
	var totalWeight float64
	
	for factor, weight := range factors {
		if _, exists := monitoringData[factor]; exists {
			// Check if data is present and valid
			if data, ok := monitoringData[factor].(map[string]interface{}); ok {
				if completeness, ok := data["completeness"].(float64); ok {
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
		return 0.5 // Default score
	}
	
	qualityScore := totalScore / totalWeight
	
	// Ensure score is within bounds
	if qualityScore > 1.0 {
		qualityScore = 1.0
	}
	if qualityScore < 0.0 {
		qualityScore = 0.0
	}
	
	return math.Round(qualityScore*100) / 100
}
