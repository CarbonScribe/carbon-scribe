package analytics

import (
	"context"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/processing"

	"github.com/google/uuid"
)

// PerformanceCalculator calculates project performance metrics
type PerformanceCalculator struct {
	repo             monitoring.Repository
	biomassEstimator *processing.BiomassEstimator
}

// NewPerformanceCalculator creates a new performance calculator
func NewPerformanceCalculator(repo monitoring.Repository) *PerformanceCalculator {
	return &PerformanceCalculator{
		repo:             repo,
		biomassEstimator: processing.NewBiomassEstimator(),
	}
}

// CalculateDashboard generates a comprehensive performance dashboard
func (p *PerformanceCalculator) CalculateDashboard(ctx context.Context, projectID uuid.UUID, period string) (*monitoring.PerformanceDashboard, error) {
	dashboard := &monitoring.PerformanceDashboard{
		ProjectID:   projectID,
		Period:      period,
		GeneratedAt: time.Now(),
		Trends:      make(map[string]monitoring.TrendAnalysis),
	}

	// Parse period (e.g., "2024-01" for monthly)
	startTime, endTime, err := parsePeriod(period)
	if err != nil {
		return nil, fmt.Errorf("invalid period format: %w", err)
	}

	// Calculate carbon sequestration metrics
	carbonMetrics, err := p.calculateCarbonMetrics(ctx, projectID, startTime, endTime)
	if err != nil {
		fmt.Printf("Warning: failed to calculate carbon metrics: %v\n", err)
	} else {
		dashboard.CarbonSequestration = *carbonMetrics
	}

	// Calculate vegetation health metrics
	vegMetrics, err := p.calculateVegetationMetrics(ctx, projectID, startTime, endTime)
	if err != nil {
		fmt.Printf("Warning: failed to calculate vegetation metrics: %v\n", err)
	} else {
		dashboard.VegetationHealth = *vegMetrics
	}

	// Calculate soil health metrics
	soilMetrics, err := p.calculateSoilMetrics(ctx, projectID, startTime, endTime)
	if err != nil {
		fmt.Printf("Warning: failed to calculate soil metrics: %v\n", err)
	} else {
		dashboard.SoilHealth = *soilMetrics
	}

	// Calculate water retention metrics
	waterMetrics, err := p.calculateWaterMetrics(ctx, projectID, startTime, endTime)
	if err != nil {
		fmt.Printf("Warning: failed to calculate water metrics: %v\n", err)
	} else {
		dashboard.WaterRetention = *waterMetrics
	}

	// Get active alerts
	alerts, err := p.repo.GetActiveProjectAlerts(ctx, projectID)
	if err != nil {
		fmt.Printf("Warning: failed to get active alerts: %v\n", err)
	} else {
		dashboard.Alerts = alerts
	}

	return dashboard, nil
}

// calculateCarbonMetrics calculates carbon sequestration metrics
func (p *PerformanceCalculator) calculateCarbonMetrics(ctx context.Context, projectID uuid.UUID, start, end time.Time) (*monitoring.CarbonMetrics, error) {
	// Get average biomass for the period
	avgBiomass, err := p.repo.CalculateAverageBiomass(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}

	// Get previous period biomass for rate calculation
	prevStart := start.AddDate(0, -1, 0)
	prevEnd := end.AddDate(0, -1, 0)
	prevBiomass, err := p.repo.CalculateAverageBiomass(ctx, projectID, prevStart, prevEnd)
	if err != nil {
		prevBiomass = 0 // Ignore errors for previous period
	}

	// Calculate sequestration rate
	daysBetween := int(end.Sub(start).Hours() / 24)
	co2Rate := 0.0
	if prevBiomass > 0 && daysBetween > 0 {
		co2Rate, _ = p.biomassEstimator.EstimateCarbonSequestrationRate(avgBiomass, prevBiomass, daysBetween)
	}

	// Calculate monthly and yearly totals
	monthlyTotal := co2Rate * 30 / 365       // Approximate monthly
	yearlyTotal := co2Rate                    // Annual rate
	dailyRate := co2Rate / 365                // Daily rate

	return &monitoring.CarbonMetrics{
		DailyRateKgCO2:  dailyRate * 1000, // Convert tonnes to kg
		MonthlyTotalKg:  monthlyTotal * 1000,
		YearlyTotalKg:   yearlyTotal * 1000,
		ConfidenceScore: 0.75, // Default confidence
	}, nil
}

// calculateVegetationMetrics calculates vegetation health metrics
func (p *PerformanceCalculator) calculateVegetationMetrics(ctx context.Context, projectID uuid.UUID, start, end time.Time) (*monitoring.VegetationMetrics, error) {
	// Get average NDVI
	avgNDVI, err := p.repo.CalculateAverageNDVI(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}

	// Get average biomass
	avgBiomass, err := p.repo.CalculateAverageBiomass(ctx, projectID, start, end)
	if err != nil {
		avgBiomass = 0
	}

	// Determine vegetation trend
	prevStart := start.AddDate(0, -1, 0)
	prevEnd := end.AddDate(0, -1, 0)
	prevNDVI, err := p.repo.CalculateAverageNDVI(ctx, projectID, prevStart, prevEnd)
	if err != nil {
		prevNDVI = avgNDVI // No previous data
	}

	trend := "stable"
	ndviChange := avgNDVI - prevNDVI
	if ndviChange > 0.05 {
		trend = "improving"
	} else if ndviChange < -0.05 {
		trend = "declining"
	}

	// Estimate canopy coverage from NDVI
	canopyCoverage := estimateCanopyCoverage(avgNDVI)

	return &monitoring.VegetationMetrics{
		AverageNDVI:     avgNDVI,
		BiomassKgPerHa:  avgBiomass,
		CanopyCoverage:  canopyCoverage,
		VegetationTrend: trend,
	}, nil
}

// calculateSoilMetrics calculates soil health metrics
func (p *PerformanceCalculator) calculateSoilMetrics(ctx context.Context, projectID uuid.UUID, start, end time.Time) (*monitoring.SoilMetrics, error) {
	// Get sensor readings for soil metrics
	moistureReadings, err := p.repo.GetSensorReadingsByType(ctx, projectID, "soil_moisture", start, end)
	if err != nil {
		return nil, err
	}

	phReadings, err := p.repo.GetSensorReadingsByType(ctx, projectID, "ph", start, end)
	if err != nil {
		phReadings = []monitoring.SensorReading{} // Optional metric
	}

	tempReadings, err := p.repo.GetSensorReadingsByType(ctx, projectID, "temperature", start, end)
	if err != nil {
		tempReadings = []monitoring.SensorReading{}
	}

	// Calculate averages
	avgMoisture := calculateAverageValue(moistureReadings)
	avgPH := calculateAverageValue(phReadings)
	avgTemp := calculateAverageValue(tempReadings)

	return &monitoring.SoilMetrics{
		AverageMoisture:    avgMoisture,
		AveragePH:          avgPH,
		OrganicMatter:      0, // Would require specific sensor data
		TemperatureCelsius: avgTemp,
	}, nil
}

// calculateWaterMetrics calculates water retention metrics
func (p *PerformanceCalculator) calculateWaterMetrics(ctx context.Context, projectID uuid.UUID, start, end time.Time) (*monitoring.WaterMetrics, error) {
	// Get rainfall data
	rainfallReadings, err := p.repo.GetSensorReadingsByType(ctx, projectID, "rainfall", start, end)
	if err != nil {
		rainfallReadings = []monitoring.SensorReading{}
	}

	totalRainfall := 0.0
	for _, r := range rainfallReadings {
		totalRainfall += r.Value
	}

	// Get soil moisture for water content
	moistureReadings, err := p.repo.GetSensorReadingsByType(ctx, projectID, "soil_moisture", start, end)
	if err != nil {
		moistureReadings = []monitoring.SensorReading{}
	}

	avgSoilWater := calculateAverageValue(moistureReadings)

	return &monitoring.WaterMetrics{
		RainfallMm:       totalRainfall,
		NDWI:             0, // Would need to be calculated from satellite data
		SoilWaterContent: avgSoilWater,
	}, nil
}

// CalculateMetricForProject calculates a specific metric for a project
func (p *PerformanceCalculator) CalculateMetricForProject(ctx context.Context, projectID uuid.UUID, metricName string, period time.Time) (*monitoring.ProjectMetric, error) {
	metric := &monitoring.ProjectMetric{
		Time:              period,
		ProjectID:         projectID,
		MetricName:        metricName,
		AggregationPeriod: "daily",
		CreatedAt:         time.Now(),
	}

	start := period.Truncate(24 * time.Hour)
	end := start.Add(24 * time.Hour)

	switch metricName {
	case "carbon_sequestration_daily":
		value, err := p.calculateDailyCarbonSequestration(ctx, projectID, start, end)
		if err != nil {
			return nil, err
		}
		metric.Value = value
		metric.Unit = strPtr("kg_co2")
		metric.CalculationMethod = strPtr("biomass_derived")

	case "vegetation_health":
		ndvi, err := p.repo.CalculateAverageNDVI(ctx, projectID, start, end)
		if err != nil {
			return nil, err
		}
		metric.Value = ndvi * 100 // Scale to 0-100
		metric.Unit = strPtr("index")
		metric.CalculationMethod = strPtr("satellite_derived")

	case "water_retention":
		moisture, err := p.calculateAverageSoilMoisture(ctx, projectID, start, end)
		if err != nil {
			return nil, err
		}
		metric.Value = moisture
		metric.Unit = strPtr("percent")
		metric.CalculationMethod = strPtr("sensor_measured")

	default:
		return nil, fmt.Errorf("unknown metric: %s", metricName)
	}

	return metric, nil
}

// Helper functions

func calculateDailyCarbonSequestration(p *PerformanceCalculator, ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error) {
	avgBiomass, err := p.repo.CalculateAverageBiomass(ctx, projectID, start, end)
	if err != nil {
		return 0, err
	}

	// Estimate daily carbon sequestration (simplified)
	// Assuming 0.1% daily growth rate for active vegetation
	dailyGrowthRate := 0.001
	dailyBiomassIncrease := avgBiomass * dailyGrowthRate
	
	// Convert to CO2 (carbon is 45% of biomass, CO2/C ratio is 44/12)
	co2Kg := dailyBiomassIncrease * 0.45 * (44.0 / 12.0)
	
	return co2Kg, nil
}

func (p *PerformanceCalculator) calculateDailyCarbonSequestration(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error) {
	return calculateDailyCarbonSequestration(p, ctx, projectID, start, end)
}

func (p *PerformanceCalculator) calculateAverageSoilMoisture(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error) {
	readings, err := p.repo.GetSensorReadingsByType(ctx, projectID, "soil_moisture", start, end)
	if err != nil {
		return 0, err
	}
	return calculateAverageValue(readings), nil
}

func calculateAverageValue(readings []monitoring.SensorReading) float64 {
	if len(readings) == 0 {
		return 0
	}
	
	sum := 0.0
	for _, r := range readings {
		sum += r.Value
	}
	return sum / float64(len(readings))
}

func estimateCanopyCoverage(ndvi float64) float64 {
	// Simplified relationship between NDVI and canopy coverage
	if ndvi < 0.2 {
		return 0
	} else if ndvi > 0.8 {
		return 100
	}
	// Linear interpolation between 0.2 and 0.8 NDVI
	return (ndvi - 0.2) / 0.6 * 100
}

func parsePeriod(period string) (time.Time, time.Time, error) {
	// Parse period in format "YYYY-MM" or "YYYY-MM-DD"
	var start time.Time
	var err error

	if len(period) == 7 { // "YYYY-MM"
		start, err = time.Parse("2006-01", period)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		end := start.AddDate(0, 1, 0) // Add one month
		return start, end, nil
	} else if len(period) == 10 { // "YYYY-MM-DD"
		start, err = time.Parse("2006-01-02", period)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		end := start.AddDate(0, 0, 1) // Add one day
		return start, end, nil
	}

	return time.Time{}, time.Time{}, fmt.Errorf("invalid period format: %s", period)
}

func strPtr(s string) *string {
	return &s
}
