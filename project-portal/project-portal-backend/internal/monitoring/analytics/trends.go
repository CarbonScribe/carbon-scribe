package analytics

import (
	"context"
	"fmt"
	"math"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"

	"github.com/google/uuid"
)

// TrendAnalyzer analyzes trends in time-series data
type TrendAnalyzer struct {
	repo monitoring.Repository
}

// NewTrendAnalyzer creates a new trend analyzer
func NewTrendAnalyzer(repo monitoring.Repository) *TrendAnalyzer {
	return &TrendAnalyzer{
		repo: repo,
	}
}

// AnalyzeMetricTrends analyzes trends for multiple metrics
func (t *TrendAnalyzer) AnalyzeMetricTrends(ctx context.Context, projectID uuid.UUID, metricNames []string, start, end time.Time) (map[string]monitoring.TrendAnalysis, error) {
	trends := make(map[string]monitoring.TrendAnalysis)

	for _, metricName := range metricNames {
		trend, err := t.AnalyzeSingleMetricTrend(ctx, projectID, metricName, start, end)
		if err != nil {
			fmt.Printf("Warning: failed to analyze trend for %s: %v\n", metricName, err)
			continue
		}
		trends[metricName] = *trend
	}

	return trends, nil
}

// AnalyzeSingleMetricTrend analyzes trend for a single metric
func (t *TrendAnalyzer) AnalyzeSingleMetricTrend(ctx context.Context, projectID uuid.UUID, metricName string, start, end time.Time) (*monitoring.TrendAnalysis, error) {
	// Get time series data
	timeSeries, err := t.repo.GetMetricTimeSeries(ctx, projectID, metricName, "daily", start, end)
	if err != nil {
		return nil, err
	}

	if len(timeSeries) < 2 {
		return nil, fmt.Errorf("insufficient data points for trend analysis")
	}

	// Calculate linear regression
	slope, intercept := linearRegression(timeSeries)

	// Determine direction
	direction := "stable"
	if slope > 0.01 {
		direction = "up"
	} else if slope < -0.01 {
		direction = "down"
	}

	// Calculate percentage change
	firstValue := timeSeries[0].Value
	lastValue := timeSeries[len(timeSeries)-1].Value
	changePercent := 0.0
	if firstValue != 0 {
		changePercent = ((lastValue - firstValue) / firstValue) * 100
	}

	// Calculate statistical significance (simplified)
	pValue := calculatePValue(timeSeries, slope)
	significance := "not_significant"
	if pValue < 0.05 {
		significance = "significant"
	}

	// Forecast next value
	forecastedValue := slope*float64(len(timeSeries)) + intercept

	return &monitoring.TrendAnalysis{
		MetricName:      metricName,
		Direction:       direction,
		ChangePercent:   changePercent,
		Significance:    significance,
		PValue:          &pValue,
		ForecastedValue: &forecastedValue,
	}, nil
}

// DetectAnomalies detects anomalous values in time series data
func (t *TrendAnalyzer) DetectAnomalies(ctx context.Context, projectID uuid.UUID, metricName string, start, end time.Time) ([]monitoring.ProjectMetric, error) {
	timeSeries, err := t.repo.GetMetricTimeSeries(ctx, projectID, metricName, "daily", start, end)
	if err != nil {
		return nil, err
	}

	if len(timeSeries) < 3 {
		return nil, fmt.Errorf("insufficient data for anomaly detection")
	}

	// Calculate mean and standard deviation
	mean, stdDev := calculateMeanAndStdDev(timeSeries)

	// Detect anomalies (values beyond 3 standard deviations)
	anomalies := []monitoring.ProjectMetric{}
	threshold := 3.0

	for _, metric := range timeSeries {
		zScore := (metric.Value - mean) / stdDev
		if math.Abs(zScore) > threshold {
			anomalies = append(anomalies, metric)
		}
	}

	return anomalies, nil
}

// ForecastMetric forecasts future metric values using simple linear extrapolation
func (t *TrendAnalyzer) ForecastMetric(ctx context.Context, projectID uuid.UUID, metricName string, daysAhead int) ([]ForecastPoint, error) {
	// Get historical data (last 30 days)
	end := time.Now()
	start := end.AddDate(0, 0, -30)

	timeSeries, err := t.repo.GetMetricTimeSeries(ctx, projectID, metricName, "daily", start, end)
	if err != nil {
		return nil, err
	}

	if len(timeSeries) < 7 {
		return nil, fmt.Errorf("insufficient historical data for forecasting")
	}

	// Calculate linear regression
	slope, intercept := linearRegression(timeSeries)

	// Generate forecast points
	forecast := make([]ForecastPoint, daysAhead)
	lastIndex := len(timeSeries)

	for i := 0; i < daysAhead; i++ {
		predictedValue := slope*float64(lastIndex+i) + intercept
		
		// Calculate confidence interval (simplified)
		confidenceInterval := calculateConfidenceInterval(timeSeries, slope, float64(lastIndex+i))

		forecast[i] = ForecastPoint{
			Date:               end.AddDate(0, 0, i+1),
			PredictedValue:     predictedValue,
			ConfidenceLower:    predictedValue - confidenceInterval,
			ConfidenceUpper:    predictedValue + confidenceInterval,
			ConfidenceInterval: confidenceInterval,
		}
	}

	return forecast, nil
}

// CompareProjects compares metrics across multiple projects
func (t *TrendAnalyzer) CompareProjects(ctx context.Context, projectIDs []uuid.UUID, metricName string, period time.Time) (map[uuid.UUID]float64, error) {
	comparison := make(map[uuid.UUID]float64)

	start := period.Truncate(24 * time.Hour)
	end := start.Add(24 * time.Hour)

	for _, projectID := range projectIDs {
		metric, err := t.repo.GetLatestMetricValue(ctx, projectID, metricName, "daily")
		if err != nil || metric == nil {
			comparison[projectID] = 0
			continue
		}

		comparison[projectID] = metric.Value
	}

	return comparison, nil
}

// ForecastPoint represents a forecasted value with confidence interval
type ForecastPoint struct {
	Date               time.Time
	PredictedValue     float64
	ConfidenceLower    float64
	ConfidenceUpper    float64
	ConfidenceInterval float64
}

// Statistical helper functions

func linearRegression(timeSeries []monitoring.ProjectMetric) (slope, intercept float64) {
	n := float64(len(timeSeries))
	if n == 0 {
		return 0, 0
	}

	sumX := 0.0
	sumY := 0.0
	sumXY := 0.0
	sumX2 := 0.0

	for i, metric := range timeSeries {
		x := float64(i)
		y := metric.Value
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	// Calculate slope and intercept
	denominator := n*sumX2 - sumX*sumX
	if denominator == 0 {
		return 0, sumY / n
	}

	slope = (n*sumXY - sumX*sumY) / denominator
	intercept = (sumY - slope*sumX) / n

	return slope, intercept
}

func calculateMeanAndStdDev(timeSeries []monitoring.ProjectMetric) (mean, stdDev float64) {
	if len(timeSeries) == 0 {
		return 0, 0
	}

	// Calculate mean
	sum := 0.0
	for _, metric := range timeSeries {
		sum += metric.Value
	}
	mean = sum / float64(len(timeSeries))

	// Calculate standard deviation
	variance := 0.0
	for _, metric := range timeSeries {
		variance += math.Pow(metric.Value-mean, 2)
	}
	variance /= float64(len(timeSeries))
	stdDev = math.Sqrt(variance)

	return mean, stdDev
}

func calculatePValue(timeSeries []monitoring.ProjectMetric, slope float64) float64 {
	// Simplified p-value calculation
	// In a real implementation, you'd use proper statistical tests
	n := float64(len(timeSeries))
	if n < 3 {
		return 1.0
	}

	// Calculate residuals
	_, stdDev := calculateMeanAndStdDev(timeSeries)
	
	// Simplified t-statistic
	standardError := stdDev / math.Sqrt(n)
	if standardError == 0 {
		return 1.0
	}

	tStat := math.Abs(slope / standardError)
	
	// Approximate p-value (very simplified)
	// In production, use a proper t-distribution lookup
	if tStat > 3.0 {
		return 0.01
	} else if tStat > 2.0 {
		return 0.05
	} else if tStat > 1.0 {
		return 0.2
	}
	return 0.5
}

func calculateConfidenceInterval(timeSeries []monitoring.ProjectMetric, slope float64, x float64) float64 {
	// Simplified confidence interval calculation
	_, stdDev := calculateMeanAndStdDev(timeSeries)
	
	// 95% confidence interval (approximately 2 * standard error)
	n := float64(len(timeSeries))
	standardError := stdDev / math.Sqrt(n)
	
	return 1.96 * standardError * math.Sqrt(1 + 1/n + math.Pow(x-n/2, 2)/(n*(n*n-1)/12))
}
