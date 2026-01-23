package calculation

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// CalculationRequest represents a request to calculate carbon credits
type CalculationRequest struct {
	ProjectID              uuid.UUID `json:"project_id"`
	VintageYear            int       `json:"vintage_year"`
	CalculationPeriodStart time.Time `json:"calculation_period_start"`
	CalculationPeriodEnd   time.Time `json:"calculation_period_end"`
	MethodologyCode        string    `json:"methodology_code"`
}

// CalculationResponse represents the response from credit calculation
type CalculationResponse struct {
	CreditID          uuid.UUID `json:"credit_id"`
	CalculatedTons    float64   `json:"calculated_tons"`
	BufferedTons      float64   `json:"buffered_tons"`
	DataQualityScore  float64   `json:"data_quality_score"`
	UncertaintyBuffer float64   `json:"uncertainty_buffer"`
	ValidationResults []string  `json:"validation_results"`
	Warnings          []string  `json:"warnings"`
}

// Engine handles carbon credit calculations
type Engine struct {
	methodologies map[string]Methodology
	validator     *Validator
}

// Methodology defines the interface for carbon calculation methodologies
type Methodology interface {
	Calculate(ctx context.Context, req *CalculationInput) (*CalculationResult, error)
	Validate(ctx context.Context, req *CalculationInput) (*ValidationResult, error)
	GetCode() string
	GetName() string
	GetMinimumMonitoringPeriod() time.Duration
}

// CalculationInput represents input data for credit calculation
type CalculationInput struct {
	ProjectID              uuid.UUID
	VintageYear            int
	CalculationPeriodStart time.Time
	CalculationPeriodEnd   time.Time
	MethodologyCode        string
	
	// Monitoring data
	MonitoringData        MonitoringData
	BaselineData          BaselineData
	ProjectParameters     map[string]interface{}
	
	// Quality factors
	DataQualityScore      float64
	SatelliteCoverage     float64
	IoTSensorCoverage     float64
	ThirdPartyVerification bool
}

// MonitoringData represents monitoring data from various sources
type MonitoringData struct {
	SatelliteData    []SatelliteMeasurement
	IoTSensorData    []IoTMeasurement
	ManualMeasurements []ManualMeasurement
	WeatherData      []WeatherMeasurement
	SoilData         []SoilMeasurement
}

// SatelliteMeasurement represents satellite-based measurement
type SatelliteMeasurement struct {
	Timestamp       time.Time
	Latitude        float64
	Longitude       float64
	NDVI            float64
	EVI             float64
	LAI             float64
	CanopyCover     float64
	BiomassEstimate float64
	QualityScore    float64
}

// IoTMeasurement represents IoT sensor measurement
type IoTMeasurement struct {
	Timestamp         time.Time
	SensorID          string
	Latitude          float64
	Longitude         float64
	SoilMoisture      float64
	Temperature       float64
	CO2Concentration  float64
	CH4Concentration  float64
	BatteryLevel      float64
	QualityScore      float64
}

// ManualMeasurement represents manual field measurement
type ManualMeasurement struct {
	Timestamp       time.Time
	MeasurerID      string
	Latitude        float64
	Longitude       float64
	TreeHeight      float64
	DBH             float64 // Diameter at Breast Height
	Species         string
	BiomassSample   float64
	QualityScore    float64
}

// WeatherMeasurement represents weather data
type WeatherMeasurement struct {
	Timestamp    time.Time
	Temperature  float64
	Humidity     float64
	Rainfall     float64
	WindSpeed    float64
	SolarRadiation float64
}

// SoilMeasurement represents soil data
type SoilMeasurement struct {
	Timestamp      time.Time
	Latitude       float64
	Longitude      float64
	SoilType       string
	SoilDepth      float64
	SoilCarbon     float64
	SoilNitrogen   float64
	BulkDensity    float64
	QualityScore   float64
}

// BaselineData represents baseline scenario data
type BaselineData struct {
	ReferenceScenario string
	BaselineEmissions float64
	BaselineRemovals  float64
	ConservativenessFactor float64
}

// CalculationResult represents the result of credit calculation
type CalculationResult struct {
	CalculatedTons    float64
	BufferedTons      float64
	UncertaintyBuffer float64
	DataQualityScore  float64
	ConfidenceLevel   float64
	ValidationResults []string
	Warnings          []string
	CalculationSteps  []CalculationStep
}

// CalculationStep represents a step in the calculation process
type CalculationStep struct {
	StepName    string
	Formula     string
	InputValues map[string]interface{}
	Result      float64
	Unit        string
	Timestamp   time.Time
}

// ValidationResult represents validation results
type ValidationResult struct {
	IsValid       bool
	Errors        []string
	Warnings      []string
	QualityScore  float64
	Requirements  []RequirementCheck
}

// RequirementCheck represents a methodology requirement check
type RequirementCheck struct {
	Requirement string
	Met         bool
	Details     string
}

// NewEngine creates a new calculation engine
func NewEngine() *Engine {
	engine := &Engine{
		methodologies: make(map[string]Methodology),
		validator:     NewValidator(),
	}
	
	// Register default methodologies
	engine.RegisterMethodology(NewVM0007Methodology())
	engine.RegisterMethodology(NewVM0015Methodology())
	engine.RegisterMethodology(NewVM0033Methodology())
	
	return engine
}

// RegisterMethodology registers a new calculation methodology
func (e *Engine) RegisterMethodology(methodology Methodology) {
	e.methodologies[methodology.GetCode()] = methodology
}

// CalculateCredits performs carbon credit calculation
func (e *Engine) CalculateCredits(ctx context.Context, req *CalculationRequest, monitoringData MonitoringData, baselineData BaselineData) (*CalculationResponse, error) {
	// Get methodology
	methodology, exists := e.methodologies[req.MethodologyCode]
	if !exists {
		return nil, fmt.Errorf("unsupported methodology: %s", req.MethodologyCode)
	}
	
	// Prepare calculation input
	input := &CalculationInput{
		ProjectID:              req.ProjectID,
		VintageYear:            req.VintageYear,
		CalculationPeriodStart: req.CalculationPeriodStart,
		CalculationPeriodEnd:   req.CalculationPeriodEnd,
		MethodologyCode:        req.MethodologyCode,
		MonitoringData:         monitoringData,
		BaselineData:           baselineData,
		DataQualityScore:       e.calculateDataQualityScore(monitoringData),
	}
	
	// Validate input
	validationResult, err := methodology.Validate(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	if !validationResult.IsValid {
		return nil, fmt.Errorf("validation failed: %v", validationResult.Errors)
	}
	
	// Perform calculation
	result, err := methodology.Calculate(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("calculation failed: %w", err)
	}
	
	// Apply uncertainty buffer
	bufferedTons := e.applyUncertaintyBuffer(result.CalculatedTons, result.DataQualityScore, result.ConfidenceLevel)
	
	return &CalculationResponse{
		CreditID:          uuid.New(),
		CalculatedTons:    result.CalculatedTons,
		BufferedTons:      bufferedTons,
		DataQualityScore:  result.DataQualityScore,
		UncertaintyBuffer: bufferedTons - result.CalculatedTons,
		ValidationResults: validationResult.Errors,
		Warnings:          append(result.Warnings, validationResult.Warnings...),
	}, nil
}

// calculateDataQualityScore calculates overall data quality score
func (e *Engine) calculateDataQualityScore(data MonitoringData) float64 {
	var totalScore, totalWeight float64
	
	// Satellite data quality
	if len(data.SatelliteData) > 0 {
		satScore := 0.0
		for _, measurement := range data.SatelliteData {
			satScore += measurement.QualityScore
		}
		satScore /= float64(len(data.SatelliteData))
		totalScore += satScore * 0.4
		totalWeight += 0.4
	}
	
	// IoT sensor data quality
	if len(data.IoTSensorData) > 0 {
		iotScore := 0.0
		for _, measurement := range data.IoTSensorData {
			iotScore += measurement.QualityScore
		}
		iotScore /= float64(len(data.IoTSensorData))
		totalScore += iotScore * 0.3
		totalWeight += 0.3
	}
	
	// Manual measurement quality
	if len(data.ManualMeasurements) > 0 {
		manualScore := 0.0
		for _, measurement := range data.ManualMeasurements {
			manualScore += measurement.QualityScore
		}
		manualScore /= float64(len(data.ManualMeasurements))
		totalScore += manualScore * 0.3
		totalWeight += 0.3
	}
	
	if totalWeight > 0 {
		return totalScore / totalWeight
	}
	return 0.5 // Default score if no data
}

// applyUncertaintyBuffer applies conservative uncertainty buffer
func (e *Engine) applyUncertaintyBuffer(calculatedTons, dataQualityScore, confidenceLevel float64) float64 {
	// Base uncertainty buffer (10-30% based on data quality)
	baseBuffer := 0.30 - (dataQualityScore * 0.20)
	
	// Confidence level adjustment
	confidenceAdjustment := (1.0 - confidenceLevel) * 0.15
	
	// Total buffer
	totalBuffer := baseBuffer + confidenceAdjustment
	
	// Ensure buffer is between 10% and 40%
	totalBuffer = math.Max(0.10, math.Min(0.40, totalBuffer))
	
	return calculatedTons * (1.0 - totalBuffer)
}

// GetMethodology returns a methodology by code
func (e *Engine) GetMethodology(code string) (Methodology, bool) {
	methodology, exists := e.methodologies[code]
	return methodology, exists
}

// ListMethodologies returns all available methodologies
func (e *Engine) ListMethodologies() []Methodology {
	methodologies := make([]Methodology, 0, len(e.methodologies))
	for _, methodology := range e.methodologies {
		methodologies = append(methodologies, methodology)
	}
	return methodologies
}

// EstimateCalculationTime estimates calculation time based on data volume
func (e *Engine) EstimateCalculationTime(data MonitoringData) time.Duration {
	dataPoints := len(data.SatelliteData) + len(data.IoTSensorData) + len(data.ManualMeasurements)
	
	// Base time: 5 seconds + 0.1 seconds per data point
	baseTime := 5 * time.Second
	perPointTime := 100 * time.Millisecond
	
	return baseTime + time.Duration(dataPoints)*perPointTime
}
