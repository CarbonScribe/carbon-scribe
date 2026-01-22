package processing

import (
	"errors"
	"math"
)

// BiomassEstimator handles biomass estimation from satellite data
type BiomassEstimator struct {
	calculator *NDVICalculator
}

// NewBiomassEstimator creates a new biomass estimator instance
func NewBiomassEstimator() *BiomassEstimator {
	return &BiomassEstimator{
		calculator: NewNDVICalculator(),
	}
}

// BiomassEstimate represents the estimated biomass with confidence metrics
type BiomassEstimate struct {
	BiomassKgPerHa  float64 // Estimated aboveground biomass in kg per hectare
	CarbonTonnesPerHa float64 // Estimated carbon content in tonnes per hectare
	ConfidenceScore float64 // Confidence in the estimate (0-1)
	Method          string  // Method used for estimation
	VegetationType  string  // Type of vegetation detected
}

// EstimateFromNDVI estimates biomass using NDVI-based regression
// This uses empirical relationships between NDVI and biomass
// Reference: Tucker et al. (1985), Gamon et al. (1995)
func (e *BiomassEstimator) EstimateFromNDVI(ndvi float64, vegetationType string) (*BiomassEstimate, error) {
	if ndvi < -1 || ndvi > 1 {
		return nil, errors.New("NDVI value must be between -1 and 1")
	}
	
	// Different vegetation types have different NDVI-biomass relationships
	var biomassKgPerHa float64
	var confidence float64
	
	switch vegetationType {
	case "grassland", "rangeland":
		// Grassland relationship: Biomass = 1000 * (NDVI^2) + 2000 * NDVI
		if ndvi < 0.2 {
			biomassKgPerHa = 0
			confidence = 0.9
		} else {
			biomassKgPerHa = 1000*math.Pow(ndvi, 2) + 2000*ndvi
			confidence = 0.75 - math.Abs(0.5-ndvi)*0.3 // Higher confidence for mid-range NDVI
		}
		
	case "forest", "woodland":
		// Forest relationship: Biomass = 15000 * NDVI - 3000
		// Forests typically have higher NDVI saturation
		if ndvi < 0.3 {
			biomassKgPerHa = 0
			confidence = 0.85
		} else if ndvi > 0.8 {
			// NDVI saturation in dense forests
			biomassKgPerHa = 50000 + (ndvi-0.8)*20000
			confidence = 0.6 // Lower confidence due to saturation
		} else {
			biomassKgPerHa = 15000*ndvi - 3000
			confidence = 0.8
		}
		
	case "cropland", "agricultural":
		// Cropland relationship: More linear, varies by crop stage
		if ndvi < 0.2 {
			biomassKgPerHa = 0
			confidence = 0.9
		} else {
			biomassKgPerHa = 8000*ndvi - 1000
			confidence = 0.85
		}
		
	case "shrubland", "savanna":
		// Shrubland relationship: Intermediate between grass and forest
		if ndvi < 0.2 {
			biomassKgPerHa = 0
			confidence = 0.85
		} else {
			biomassKgPerHa = 5000*math.Pow(ndvi, 1.5) + 1000*ndvi
			confidence = 0.75
		}
		
	default:
		// Generic relationship for unknown vegetation types
		if ndvi < 0.2 {
			biomassKgPerHa = 0
			confidence = 0.7
		} else {
			biomassKgPerHa = 10000*ndvi - 1500
			confidence = 0.65 // Lower confidence for unknown types
		}
	}
	
	// Ensure non-negative biomass
	if biomassKgPerHa < 0 {
		biomassKgPerHa = 0
	}
	
	// Calculate carbon content (typical carbon fraction is ~45% of dry biomass)
	carbonTonnesPerHa := biomassKgPerHa * 0.45 / 1000.0
	
	return &BiomassEstimate{
		BiomassKgPerHa:    math.Round(biomassKgPerHa*100) / 100,
		CarbonTonnesPerHa: math.Round(carbonTonnesPerHa*1000) / 1000,
		ConfidenceScore:   math.Round(confidence*100) / 100,
		Method:            "ndvi_regression",
		VegetationType:    vegetationType,
	}, nil
}

// EstimateFromMultipleIndices estimates biomass using multiple vegetation indices
// Combines NDVI, EVI, and SAVI for more robust estimation
func (e *BiomassEstimator) EstimateFromMultipleIndices(indices *VegetationIndices, vegetationType string) (*BiomassEstimate, error) {
	if indices == nil {
		return nil, errors.New("vegetation indices cannot be nil")
	}
	
	// Get baseline estimate from NDVI
	baseEstimate, err := e.EstimateFromNDVI(indices.NDVI, vegetationType)
	if err != nil {
		return nil, err
	}
	
	// Adjust based on EVI if available (EVI is better for high biomass areas)
	if indices.EVI != 0 {
		eviAdjustment := 1.0
		if indices.EVI > 0.6 {
			// In high EVI areas, increase biomass estimate
			eviAdjustment = 1.0 + (indices.EVI-0.6)*0.5
		}
		baseEstimate.BiomassKgPerHa *= eviAdjustment
		baseEstimate.ConfidenceScore += 0.05 // Slightly higher confidence with EVI
	}
	
	// Adjust based on SAVI if available (SAVI accounts for soil background)
	if indices.SAVI != 0 {
		// If SAVI is significantly different from NDVI, there's soil influence
		saviNdviDiff := math.Abs(indices.SAVI - indices.NDVI)
		if saviNdviDiff > 0.1 {
			// Significant soil background, reduce biomass estimate slightly
			baseEstimate.BiomassKgPerHa *= 0.9
			baseEstimate.ConfidenceScore -= 0.05
		}
	}
	
	// Recalculate carbon content
	baseEstimate.CarbonTonnesPerHa = baseEstimate.BiomassKgPerHa * 0.45 / 1000.0
	baseEstimate.CarbonTonnesPerHa = math.Round(baseEstimate.CarbonTonnesPerHa*1000) / 1000
	
	// Ensure confidence is in valid range
	if baseEstimate.ConfidenceScore > 1.0 {
		baseEstimate.ConfidenceScore = 1.0
	} else if baseEstimate.ConfidenceScore < 0 {
		baseEstimate.ConfidenceScore = 0
	}
	
	baseEstimate.BiomassKgPerHa = math.Round(baseEstimate.BiomassKgPerHa*100) / 100
	baseEstimate.Method = "multi_index_regression"
	
	return baseEstimate, nil
}

// EstimateCarbonSequestrationRate estimates carbon sequestration rate
// Returns tonnes of CO2 per hectare per year
func (e *BiomassEstimator) EstimateCarbonSequestrationRate(currentBiomass, previousBiomass float64, daysBetween int) (float64, error) {
	if daysBetween <= 0 {
		return 0, errors.New("time interval must be positive")
	}
	
	// Calculate biomass change (kg/ha)
	biomassChange := currentBiomass - previousBiomass
	
	// Convert to annual rate
	annualBiomassChange := biomassChange * (365.0 / float64(daysBetween))
	
	// Convert biomass to carbon (45% carbon content)
	carbonChange := annualBiomassChange * 0.45
	
	// Convert carbon to CO2 (molecular weight ratio: CO2/C = 44/12)
	co2Sequestration := carbonChange * (44.0 / 12.0) / 1000.0 // Convert kg to tonnes
	
	return math.Round(co2Sequestration*1000) / 1000, nil
}

// CalculateProjectCarbonMetrics calculates comprehensive carbon metrics for a project
func (e *BiomassEstimator) CalculateProjectCarbonMetrics(currentBiomassPerHa, previousBiomassPerHa float64, projectAreaHa float64, daysBetween int) (map[string]float64, error) {
	if projectAreaHa <= 0 {
		return nil, errors.New("project area must be positive")
	}
	
	metrics := make(map[string]float64)
	
	// Total biomass
	totalBiomass := currentBiomassPerHa * projectAreaHa
	metrics["total_biomass_kg"] = math.Round(totalBiomass*100) / 100
	
	// Total carbon stock (tonnes)
	carbonStock := totalBiomass * 0.45 / 1000.0
	metrics["carbon_stock_tonnes"] = math.Round(carbonStock*100) / 100
	
	// Total CO2 equivalent (tonnes)
	co2Equivalent := carbonStock * (44.0 / 12.0)
	metrics["co2_equivalent_tonnes"] = math.Round(co2Equivalent*100) / 100
	
	// Calculate sequestration rate if previous data available
	if previousBiomassPerHa > 0 && daysBetween > 0 {
		ratePerHa, err := e.EstimateCarbonSequestrationRate(currentBiomassPerHa, previousBiomassPerHa, daysBetween)
		if err != nil {
			return nil, err
		}
		
		metrics["co2_sequestration_rate_tonnes_per_ha_per_year"] = ratePerHa
		metrics["total_co2_sequestration_rate_tonnes_per_year"] = math.Round(ratePerHa*projectAreaHa*100) / 100
		
		// Daily rate
		dailyRate := (ratePerHa * projectAreaHa) / 365.0
		metrics["daily_co2_sequestration_kg"] = math.Round(dailyRate*1000*100) / 100
	}
	
	return metrics, nil
}

// InferVegetationType attempts to infer vegetation type from NDVI patterns
func (e *BiomassEstimator) InferVegetationType(ndvi, evi, savi float64) string {
	// High NDVI and EVI typically indicates forest
	if ndvi > 0.7 && evi > 0.6 {
		return "forest"
	}
	
	// Medium-high NDVI with moderate EVI suggests cropland
	if ndvi >= 0.5 && ndvi < 0.7 && evi >= 0.4 && evi < 0.6 {
		return "cropland"
	}
	
	// Medium NDVI suggests shrubland or savanna
	if ndvi >= 0.3 && ndvi < 0.5 {
		// If SAVI is close to NDVI, less soil background (shrubland)
		if math.Abs(savi-ndvi) < 0.1 {
			return "shrubland"
		}
		return "savanna"
	}
	
	// Low-medium NDVI suggests grassland
	if ndvi >= 0.2 && ndvi < 0.3 {
		return "grassland"
	}
	
	// Very low NDVI suggests bare soil or sparse vegetation
	if ndvi >= 0 && ndvi < 0.2 {
		return "bare_soil"
	}
	
	// Negative NDVI suggests water
	if ndvi < 0 {
		return "water"
	}
	
	return "unknown"
}

// ValidateBiomassEstimate checks if biomass estimate is reasonable
func (e *BiomassEstimator) ValidateBiomassEstimate(estimate *BiomassEstimate) error {
	if estimate == nil {
		return errors.New("biomass estimate cannot be nil")
	}
	
	// Check for unreasonably high values
	if estimate.BiomassKgPerHa > 100000 {
		return errors.New("biomass estimate exceeds reasonable maximum (100,000 kg/ha)")
	}
	
	// Check for negative values
	if estimate.BiomassKgPerHa < 0 {
		return errors.New("biomass estimate cannot be negative")
	}
	
	// Check confidence score
	if estimate.ConfidenceScore < 0 || estimate.ConfidenceScore > 1 {
		return errors.New("confidence score must be between 0 and 1")
	}
	
	return nil
}

// GetBiomassRange returns typical biomass range for a vegetation type
func (e *BiomassEstimator) GetBiomassRange(vegetationType string) (min, max float64) {
	switch vegetationType {
	case "grassland", "rangeland":
		return 500, 5000
	case "forest", "woodland":
		return 10000, 80000
	case "cropland", "agricultural":
		return 1000, 15000
	case "shrubland", "savanna":
		return 2000, 20000
	case "bare_soil":
		return 0, 500
	default:
		return 0, 50000
	}
}
