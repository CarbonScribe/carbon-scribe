package calculation

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"
)

// VM0007Methodology implements VM0007 - Improved Forest Management
type VM0007Methodology struct{}

// GetMetadata returns VM0007 methodology metadata
func (m *VM0007Methodology) GetMetadata() *MethodologyMetadata {
	return &MethodologyMetadata{
		Code:                    "VM0007",
		Name:                    "Improved Forest Management",
		Description:             "Methodology for Improved Forest Management through sustainable forestry practices",
		Version:                 "1.2",
		Sector:                  "Forestry",
		MinimumMonitoringPeriod: 365, // 1 year
		RequiredDataFields: []string{
			"forest_inventory",
			"growth_rates",
			"baseline_carbon_stock",
			"management_activities",
			"monitoring_period",
		},
		DefaultBuffers: map[string]float64{
			"conservative": 0.20,
			"moderate":     0.15,
			"high_quality": 0.10,
		},
		CoBenefits: []string{
			"biodiversity_conservation",
			"watershed_protection",
			"soil_conservation",
			"recreation",
		},
		Certification: "Verra VM0007",
	}
}

// Validate validates VM0007-specific data
func (m *VM0007Methodology) Validate(ctx context.Context, req *CalculationRequest) error {
	// Parse monitoring data
	var monitoringData map[string]interface{}
	if err := json.Unmarshal(req.MonitoringData, &monitoringData); err != nil {
		return fmt.Errorf("invalid monitoring data format: %w", err)
	}

	// Check required fields
	requiredFields := []string{
		"forest_inventory",
		"growth_rates",
		"management_activities",
		"monitoring_period",
	}

	for _, field := range requiredFields {
		if _, exists := monitoringData[field]; !exists {
			return fmt.Errorf("required field missing: %s", field)
		}
	}

	// Validate monitoring period (minimum 1 year)
	if period, ok := monitoringData["monitoring_period"].(map[string]interface{}); ok {
		var start, end string
		var hasStart, hasEnd bool

		if startVal, exists := period["start"]; exists {
			start, hasStart = startVal.(string)
		}
		if endVal, exists := period["end"]; exists {
			end, hasEnd = endVal.(string)
		}

		if hasStart && hasEnd {
			startTime, err1 := time.Parse(time.RFC3339, start)
			endTime, err2 := time.Parse(time.RFC3339, end)
			if err1 != nil || err2 != nil {
				return fmt.Errorf("invalid monitoring period format")
			}

			duration := endTime.Sub(startTime)
			if duration.Hours() < 24*365 { // Less than 1 year
				return fmt.Errorf("monitoring period must be at least 1 year")
			}
		}
	}

	return nil
}

// Calculate performs VM0007 carbon credit calculation
func (m *VM0007Methodology) Calculate(ctx context.Context, req *CalculationRequest) (*CalculationResult, error) {
	var monitoringData map[string]interface{}
	if err := json.Unmarshal(req.MonitoringData, &monitoringData); err != nil {
		return nil, fmt.Errorf("failed to parse monitoring data: %w", err)
	}

	var baselineData map[string]interface{}
	if err := json.Unmarshal(req.BaselineData, &baselineData); err != nil {
		return nil, fmt.Errorf("failed to parse baseline data: %w", err)
	}

	steps := []CalculationStep{}
	inputData := make(map[string]interface{})

	// Step 1: Calculate baseline carbon stocks
	step1 := CalculationStep{
		StepNumber:  1,
		Name:        "Calculate Baseline Carbon Stocks",
		Description: "Calculate carbon stocks in baseline scenario",
		Formula:     "C_baseline = A_forest × (C_above + C_below + C_soil + C_dead)",
		Inputs:      map[string]interface{}{"baseline_data": baselineData},
		Timestamp:   time.Now(),
	}

	baselineCarbon, err := m.calculateBaselineCarbon(baselineData)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate baseline carbon: %w", err)
	}

	step1.Outputs = map[string]interface{}{
		"baseline_carbon_tons": baselineCarbon,
	}
	steps = append(steps, step1)
	inputData["baseline_carbon"] = baselineCarbon

	// Step 2: Calculate project carbon stocks
	step2 := CalculationStep{
		StepNumber:  2,
		Name:        "Calculate Project Carbon Stocks",
		Description: "Calculate carbon stocks under project management",
		Formula:     "C_project = Σ(A_i × C_i) where i = forest strata",
		Inputs:      map[string]interface{}{"monitoring_data": monitoringData},
		Timestamp:   time.Now(),
	}

	projectCarbon, err := m.calculateProjectCarbon(monitoringData)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate project carbon: %w", err)
	}

	step2.Outputs = map[string]interface{}{
		"project_carbon_tons": projectCarbon,
	}
	steps = append(steps, step2)
	inputData["project_carbon"] = projectCarbon

	// Step 3: Calculate carbon sequestration
	step3 := CalculationStep{
		StepNumber:  3,
		Name:        "Calculate Carbon Sequestration",
		Description: "Calculate net carbon sequestration during monitoring period",
		Formula:     "ΔC = C_project - C_baseline - C_leakage",
		Inputs: map[string]interface{}{
			"project_carbon":  projectCarbon,
			"baseline_carbon": baselineCarbon,
		},
		Timestamp: time.Now(),
	}

	leakage := m.calculateLeakage(monitoringData)
	netSequestration := projectCarbon - baselineCarbon - leakage

	step3.Outputs = map[string]interface{}{
		"leakage_tons":           leakage,
		"net_sequestration_tons": netSequestration,
	}
	steps = append(steps, step3)
	inputData["net_sequestration"] = netSequestration

	// Step 4: Apply uncertainty buffer
	dataQualityScore := *req.DataQualityScore
	uncertaintyBuffer := m.ApplyUncertaintyBuffer(netSequestration, dataQualityScore)
	bufferedTons := netSequestration - uncertaintyBuffer

	step4 := CalculationStep{
		StepNumber:  4,
		Name:        "Apply Uncertainty Buffer",
		Description: "Apply conservative uncertainty buffer based on data quality",
		Formula:     "C_buffered = ΔC × (1 - buffer_rate)",
		Inputs: map[string]interface{}{
			"net_sequestration":  netSequestration,
			"data_quality_score": dataQualityScore,
		},
		Outputs: map[string]interface{}{
			"uncertainty_buffer_tons": uncertaintyBuffer,
			"buffered_tons":           bufferedTons,
		},
		Timestamp: time.Now(),
	}
	steps = append(steps, step4)

	// Ensure non-negative result
	if bufferedTons < 0 {
		bufferedTons = 0
	}

	return &CalculationResult{
		MethodologyCode:   "VM0007",
		CalculatedTons:    netSequestration,
		BufferedTons:      bufferedTons,
		DataQualityScore:  dataQualityScore,
		UncertaintyBuffer: uncertaintyBuffer,
		CalculationSteps:  steps,
		InputData:         inputData,
		ValidationResults: &ValidationResults{
			IsValid:      true,
			QualityScore: dataQualityScore,
		},
		Metadata: map[string]interface{}{
			"methodology_version": "1.2",
			"calculation_date":    time.Now().Format(time.RFC3339),
			"conservatism_factor": "high",
		},
	}, nil
}

// ApplyUncertaintyBuffer applies VM0007-specific uncertainty buffers
func (m *VM0007Methodology) ApplyUncertaintyBuffer(tons float64, dataQuality float64) float64 {
	// Base buffer for VM0007
	baseBuffer := 0.20 // 20% base buffer

	// Adjust based on data quality
	if dataQuality >= 0.9 {
		baseBuffer = 0.10 // High quality data
	} else if dataQuality >= 0.7 {
		baseBuffer = 0.15 // Good quality data
	} else if dataQuality < 0.5 {
		baseBuffer = 0.30 // Poor quality data
	}

	bufferAmount := tons * baseBuffer
	return math.Round(bufferAmount*10000) / 10000
}

// Helper methods for VM0007 calculations
func (m *VM0007Methodology) calculateBaselineCarbon(baselineData map[string]interface{}) (float64, error) {
	// Extract forest area and carbon densities
	forestArea, ok := baselineData["forest_area"].(float64)
	if !ok {
		return 0, fmt.Errorf("forest_area required in baseline data")
	}

	aboveGroundCarbon, _ := baselineData["above_ground_carbon_density"].(float64)
	belowGroundCarbon, _ := baselineData["below_ground_carbon_density"].(float64)
	soilCarbon, _ := baselineData["soil_carbon_density"].(float64)
	deadWoodCarbon, _ := baselineData["dead_wood_carbon_density"].(float64)

	// Default values if not provided
	if aboveGroundCarbon == 0 {
		aboveGroundCarbon = 150.0 // tons CO2e/ha default
	}
	if belowGroundCarbon == 0 {
		belowGroundCarbon = aboveGroundCarbon * 0.26 // 26% of above ground
	}
	if soilCarbon == 0 {
		soilCarbon = 100.0 // tons CO2e/ha default
	}
	if deadWoodCarbon == 0 {
		deadWoodCarbon = 20.0 // tons CO2e/ha default
	}

	totalCarbonDensity := aboveGroundCarbon + belowGroundCarbon + soilCarbon + deadWoodCarbon
	totalCarbon := forestArea * totalCarbonDensity

	return totalCarbon, nil
}

func (m *VM0007Methodology) calculateProjectCarbon(monitoringData map[string]interface{}) (float64, error) {
	// Extract forest inventory data
	inventory, ok := monitoringData["forest_inventory"].(map[string]interface{})
	if !ok {
		return 0, fmt.Errorf("forest_inventory required in monitoring data")
	}

	var totalCarbon float64

	// Calculate carbon for each forest stratum
	if strata, ok := inventory["strata"].([]interface{}); ok {
		for _, stratum := range strata {
			stratumData, ok := stratum.(map[string]interface{})
			if !ok {
				continue
			}

			area, _ := stratumData["area"].(float64)
			aboveGround, _ := stratumData["above_ground_carbon"].(float64)
			belowGround, _ := stratumData["below_ground_carbon"].(float64)
			soil, _ := stratumData["soil_carbon"].(float64)
			deadWood, _ := stratumData["dead_wood_carbon"].(float64)

			stratumCarbon := area * (aboveGround + belowGround + soil + deadWood)
			totalCarbon += stratumCarbon
		}
	}

	return totalCarbon, nil
}

func (m *VM0007Methodology) calculateLeakage(monitoringData map[string]interface{}) float64 {
	// Simple leakage calculation - can be enhanced with more sophisticated models
	leakageRate := 0.05 // 5% leakage default

	if leakage, ok := monitoringData["leakage_rate"].(float64); ok {
		leakageRate = leakage
	}

	// Calculate leakage based on project activities
	if activities, ok := monitoringData["management_activities"].(map[string]interface{}); ok {
		// Adjust leakage based on management intensity
		if intensity, ok := activities["management_intensity"].(string); ok {
			switch intensity {
			case "low":
				leakageRate = 0.02
			case "medium":
				leakageRate = 0.05
			case "high":
				leakageRate = 0.08
			}
		}
	}

	return leakageRate
}

// VM0015Methodology implements VM0015 - Avoided Grassland Conversion
type VM0015Methodology struct{}

// GetMetadata returns VM0015 methodology metadata
func (m *VM0015Methodology) GetMetadata() *MethodologyMetadata {
	return &MethodologyMetadata{
		Code:                    "VM0015",
		Name:                    "Avoided Grassland Conversion",
		Description:             "Methodology for avoiding conversion of grasslands to croplands or other uses",
		Version:                 "1.1",
		Sector:                  "Grassland",
		MinimumMonitoringPeriod: 365, // 1 year
		RequiredDataFields: []string{
			"grassland_area",
			"carbon_stock_density",
			"baseline_conversion_rate",
			"project_activities",
			"monitoring_period",
		},
		DefaultBuffers: map[string]float64{
			"conservative": 0.25,
			"moderate":     0.20,
			"high_quality": 0.15,
		},
		CoBenefits: []string{
			"biodiversity_habitat",
			"soil_conservation",
			"water_quality",
			"cultural_values",
		},
		Certification: "Verra VM0015",
	}
}

// Validate validates VM0015-specific data
func (m *VM0015Methodology) Validate(ctx context.Context, req *CalculationRequest) error {
	var monitoringData map[string]interface{}
	if err := json.Unmarshal(req.MonitoringData, &monitoringData); err != nil {
		return fmt.Errorf("invalid monitoring data format: %w", err)
	}

	requiredFields := []string{
		"grassland_area",
		"carbon_stock_density",
		"baseline_conversion_rate",
		"project_activities",
	}

	for _, field := range requiredFields {
		if _, exists := monitoringData[field]; !exists {
			return fmt.Errorf("required field missing: %s", field)
		}
	}

	return nil
}

// Calculate performs VM0015 carbon credit calculation
func (m *VM0015Methodology) Calculate(ctx context.Context, req *CalculationRequest) (*CalculationResult, error) {
	var monitoringData map[string]interface{}
	if err := json.Unmarshal(req.MonitoringData, &monitoringData); err != nil {
		return nil, fmt.Errorf("failed to parse monitoring data: %w", err)
	}

	var baselineData map[string]interface{}
	if err := json.Unmarshal(req.BaselineData, &baselineData); err != nil {
		return nil, fmt.Errorf("failed to parse baseline data: %w", err)
	}

	steps := []CalculationStep{}
	inputData := make(map[string]interface{})

	// Step 1: Calculate baseline emissions (conversion scenario)
	step1 := CalculationStep{
		StepNumber:  1,
		Name:        "Calculate Baseline Emissions",
		Description: "Calculate emissions if grassland was converted",
		Formula:     "E_baseline = A_grassland × C_stock × R_conversion",
		Inputs:      map[string]interface{}{"baseline_data": baselineData},
		Timestamp:   time.Now(),
	}

	area, _ := monitoringData["grassland_area"].(float64)
	carbonStock, _ := monitoringData["carbon_stock_density"].(float64)
	conversionRate, _ := baselineData["baseline_conversion_rate"].(float64)

	baselineEmissions := area * carbonStock * conversionRate
	step1.Outputs = map[string]interface{}{
		"baseline_emissions_tons": baselineEmissions,
	}
	steps = append(steps, step1)
	inputData["baseline_emissions"] = baselineEmissions

	// Step 2: Calculate project emissions
	step2 := CalculationStep{
		StepNumber:  2,
		Name:        "Calculate Project Emissions",
		Description: "Calculate actual emissions under project scenario",
		Formula:     "E_project = A_grassland × C_stock × R_project",
		Inputs:      map[string]interface{}{"monitoring_data": monitoringData},
		Timestamp:   time.Now(),
	}

	projectEmissionRate := 0.01 // Minimal emissions under conservation
	if activities, ok := monitoringData["project_activities"].(map[string]interface{}); ok {
		if rate, ok := activities["emission_rate"].(float64); ok {
			projectEmissionRate = rate
		}
	}

	projectEmissions := area * carbonStock * projectEmissionRate
	step2.Outputs = map[string]interface{}{
		"project_emissions_tons": projectEmissions,
	}
	steps = append(steps, step2)
	inputData["project_emissions"] = projectEmissions

	// Step 3: Calculate emission reductions
	step3 := CalculationStep{
		StepNumber:  3,
		Name:        "Calculate Emission Reductions",
		Description: "Calculate net emission reductions",
		Formula:     "ER = E_baseline - E_project",
		Inputs: map[string]interface{}{
			"baseline_emissions": baselineEmissions,
			"project_emissions":  projectEmissions,
		},
		Timestamp: time.Now(),
	}

	emissionReductions := baselineEmissions - projectEmissions
	step3.Outputs = map[string]interface{}{
		"emission_reductions_tons": emissionReductions,
	}
	steps = append(steps, step3)
	inputData["emission_reductions"] = emissionReductions

	// Step 4: Apply uncertainty buffer
	dataQualityScore := *req.DataQualityScore
	uncertaintyBuffer := m.ApplyUncertaintyBuffer(emissionReductions, dataQualityScore)
	bufferedTons := emissionReductions - uncertaintyBuffer

	step4 := CalculationStep{
		StepNumber:  4,
		Name:        "Apply Uncertainty Buffer",
		Description: "Apply conservative uncertainty buffer",
		Formula:     "C_buffered = ER × (1 - buffer_rate)",
		Inputs: map[string]interface{}{
			"emission_reductions": emissionReductions,
			"data_quality_score":  dataQualityScore,
		},
		Outputs: map[string]interface{}{
			"uncertainty_buffer_tons": uncertaintyBuffer,
			"buffered_tons":           bufferedTons,
		},
		Timestamp: time.Now(),
	}
	steps = append(steps, step4)

	if bufferedTons < 0 {
		bufferedTons = 0
	}

	return &CalculationResult{
		MethodologyCode:   "VM0015",
		CalculatedTons:    emissionReductions,
		BufferedTons:      bufferedTons,
		DataQualityScore:  dataQualityScore,
		UncertaintyBuffer: uncertaintyBuffer,
		CalculationSteps:  steps,
		InputData:         inputData,
		ValidationResults: &ValidationResults{
			IsValid:      true,
			QualityScore: dataQualityScore,
		},
		Metadata: map[string]interface{}{
			"methodology_version": "1.1",
			"calculation_date":    time.Now().Format(time.RFC3339),
		},
	}, nil
}

// ApplyUncertaintyBuffer applies VM0015-specific uncertainty buffers
func (m *VM0015Methodology) ApplyUncertaintyBuffer(tons float64, dataQuality float64) float64 {
	baseBuffer := 0.25 // 25% base buffer for grasslands

	if dataQuality >= 0.9 {
		baseBuffer = 0.15
	} else if dataQuality >= 0.7 {
		baseBuffer = 0.20
	} else if dataQuality < 0.5 {
		baseBuffer = 0.35
	}

	bufferAmount := tons * baseBuffer
	return math.Round(bufferAmount*10000) / 10000
}

// VM0033Methodology implements VM0033 - Soil Carbon Sequestration
type VM0033Methodology struct{}

// GetMetadata returns VM0033 methodology metadata
func (m *VM0033Methodology) GetMetadata() *MethodologyMetadata {
	return &MethodologyMetadata{
		Code:                    "VM0033",
		Name:                    "Soil Carbon Sequestration",
		Description:             "Methodology for measuring soil organic carbon sequestration through improved land management",
		Version:                 "1.0",
		Sector:                  "Agriculture/Soil",
		MinimumMonitoringPeriod: 730, // 2 years minimum
		RequiredDataFields: []string{
			"soil_carbon_measurements",
			"land_management_practices",
			"baseline_soil_carbon",
			"soil_bulk_density",
			"monitoring_period",
		},
		DefaultBuffers: map[string]float64{
			"conservative": 0.30,
			"moderate":     0.25,
			"high_quality": 0.20,
		},
		CoBenefits: []string{
			"soil_health",
			"water_retention",
			"crop_yield",
			"biodiversity",
		},
		Certification: "Verra VM0033",
	}
}

// Validate validates VM0033-specific data
func (m *VM0033Methodology) Validate(ctx context.Context, req *CalculationRequest) error {
	var monitoringData map[string]interface{}
	if err := json.Unmarshal(req.MonitoringData, &monitoringData); err != nil {
		return fmt.Errorf("invalid monitoring data format: %w", err)
	}

	requiredFields := []string{
		"soil_carbon_measurements",
		"land_management_practices",
		"soil_bulk_density",
	}

	for _, field := range requiredFields {
		if _, exists := monitoringData[field]; !exists {
			return fmt.Errorf("required field missing: %s", field)
		}
	}

	// VM0033 requires minimum 2 years monitoring
	if period, ok := monitoringData["monitoring_period"].(map[string]interface{}); ok {
		var start, end string
		var hasStart, hasEnd bool

		if startVal, exists := period["start"]; exists {
			start, hasStart = startVal.(string)
		}
		if endVal, exists := period["end"]; exists {
			end, hasEnd = endVal.(string)
		}

		if hasStart && hasEnd {
			startTime, err1 := time.Parse(time.RFC3339, start)
			endTime, err2 := time.Parse(time.RFC3339, end)
			if err1 != nil || err2 != nil {
				return fmt.Errorf("invalid monitoring period format")
			}

			duration := endTime.Sub(startTime)
			if duration.Hours() < 24*730 { // Less than 2 years
				return fmt.Errorf("VM0033 requires minimum 2 years monitoring period")
			}
		}
	}

	return nil
}

// Calculate performs VM0033 carbon credit calculation
func (m *VM0033Methodology) Calculate(ctx context.Context, req *CalculationRequest) (*CalculationResult, error) {
	var monitoringData map[string]interface{}
	if err := json.Unmarshal(req.MonitoringData, &monitoringData); err != nil {
		return nil, fmt.Errorf("failed to parse monitoring data: %w", err)
	}

	var baselineData map[string]interface{}
	if err := json.Unmarshal(req.BaselineData, &baselineData); err != nil {
		return nil, fmt.Errorf("failed to parse baseline data: %w", err)
	}

	steps := []CalculationStep{}
	inputData := make(map[string]interface{})

	// Step 1: Calculate baseline soil carbon
	step1 := CalculationStep{
		StepNumber:  1,
		Name:        "Calculate Baseline Soil Carbon",
		Description: "Calculate baseline soil organic carbon stocks",
		Formula:     "C_baseline = Σ(A_i × BD_i × SOC_i × D_i)",
		Inputs:      map[string]interface{}{"baseline_data": baselineData},
		Timestamp:   time.Now(),
	}

	baselineSoilCarbon, err := m.calculateSoilCarbonStock(baselineData)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate baseline soil carbon: %w", err)
	}

	step1.Outputs = map[string]interface{}{
		"baseline_soil_carbon_tons": baselineSoilCarbon,
	}
	steps = append(steps, step1)
	inputData["baseline_soil_carbon"] = baselineSoilCarbon

	// Step 2: Calculate current soil carbon
	step2 := CalculationStep{
		StepNumber:  2,
		Name:        "Calculate Current Soil Carbon",
		Description: "Calculate current soil organic carbon stocks",
		Formula:     "C_current = Σ(A_i × BD_i × SOC_i × D_i)",
		Inputs:      map[string]interface{}{"monitoring_data": monitoringData},
		Timestamp:   time.Now(),
	}

	currentSoilCarbon, err := m.calculateSoilCarbonStock(monitoringData)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate current soil carbon: %w", err)
	}

	step2.Outputs = map[string]interface{}{
		"current_soil_carbon_tons": currentSoilCarbon,
	}
	steps = append(steps, step2)
	inputData["current_soil_carbon"] = currentSoilCarbon

	// Step 3: Calculate carbon sequestration
	step3 := CalculationStep{
		StepNumber:  3,
		Name:        "Calculate Soil Carbon Sequestration",
		Description: "Calculate net soil carbon sequestration",
		Formula:     "ΔC = C_current - C_baseline",
		Inputs: map[string]interface{}{
			"current_soil_carbon":  currentSoilCarbon,
			"baseline_soil_carbon": baselineSoilCarbon,
		},
		Timestamp: time.Now(),
	}

	sequestration := currentSoilCarbon - baselineSoilCarbon
	step3.Outputs = map[string]interface{}{
		"soil_sequestration_tons": sequestration,
	}
	steps = append(steps, step3)
	inputData["soil_sequestration"] = sequestration

	// Step 4: Apply uncertainty buffer
	dataQualityScore := *req.DataQualityScore
	uncertaintyBuffer := m.ApplyUncertaintyBuffer(sequestration, dataQualityScore)
	bufferedTons := sequestration - uncertaintyBuffer

	step4 := CalculationStep{
		StepNumber:  4,
		Name:        "Apply Uncertainty Buffer",
		Description: "Apply conservative uncertainty buffer for soil measurements",
		Formula:     "C_buffered = ΔC × (1 - buffer_rate)",
		Inputs: map[string]interface{}{
			"soil_sequestration": sequestration,
			"data_quality_score": dataQualityScore,
		},
		Outputs: map[string]interface{}{
			"uncertainty_buffer_tons": uncertaintyBuffer,
			"buffered_tons":           bufferedTons,
		},
		Timestamp: time.Now(),
	}
	steps = append(steps, step4)

	if bufferedTons < 0 {
		bufferedTons = 0
	}

	return &CalculationResult{
		MethodologyCode:   "VM0033",
		CalculatedTons:    sequestration,
		BufferedTons:      bufferedTons,
		DataQualityScore:  dataQualityScore,
		UncertaintyBuffer: uncertaintyBuffer,
		CalculationSteps:  steps,
		InputData:         inputData,
		ValidationResults: &ValidationResults{
			IsValid:      true,
			QualityScore: dataQualityScore,
		},
		Metadata: map[string]interface{}{
			"methodology_version":   "1.0",
			"calculation_date":      time.Now().Format(time.RFC3339),
			"soil_depth_considered": "0-30cm",
		},
	}, nil
}

// ApplyUncertaintyBuffer applies VM0033-specific uncertainty buffers
func (m *VM0033Methodology) ApplyUncertaintyBuffer(tons float64, dataQuality float64) float64 {
	baseBuffer := 0.30 // 30% base buffer for soil carbon (high variability)

	if dataQuality >= 0.9 {
		baseBuffer = 0.20
	} else if dataQuality >= 0.7 {
		baseBuffer = 0.25
	} else if dataQuality < 0.5 {
		baseBuffer = 0.40
	}

	bufferAmount := tons * baseBuffer
	return math.Round(bufferAmount*10000) / 10000
}

// Helper method for soil carbon calculations
func (m *VM0033Methodology) calculateSoilCarbonStock(data map[string]interface{}) (float64, error) {
	measurements, ok := data["soil_carbon_measurements"].([]interface{})
	if !ok {
		return 0, fmt.Errorf("soil_carbon_measurements required")
	}

	var totalCarbon float64

	for _, measurement := range measurements {
		m, ok := measurement.(map[string]interface{})
		if !ok {
			continue
		}

		area, _ := m["area"].(float64)                          // ha
		bulkDensity, _ := m["bulk_density"].(float64)           // g/cm³
		socConcentration, _ := m["soc_concentration"].(float64) // %
		depth, _ := m["depth"].(float64)                        // cm

		// Convert units and calculate carbon stock
		// SOC (tons/ha) = Area × Bulk Density × SOC Concentration × Depth × Conversion Factor
		if bulkDensity == 0 || socConcentration == 0 || depth == 0 {
			continue
		}

		// Conversion: g/cm³ × % × cm × ha = tons/ha
		// Factor: 0.1 converts to proper units
		carbonStock := area * bulkDensity * socConcentration * depth * 0.1
		totalCarbon += carbonStock
	}

	return totalCarbon, nil
}
