package benchmarks

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"

	"github.com/google/uuid"
)

// Comparator handles benchmark comparison logic
type Comparator struct {
	repository BenchmarkRepository
	metrics    MetricsProvider
}

// BenchmarkRepository defines the interface for benchmark data access
type BenchmarkRepository interface {
	GetBenchmarkByCategory(ctx context.Context, category, methodology, region string, year int) (*BenchmarkDataset, error)
	ListBenchmarks(ctx context.Context, filter BenchmarkFilter) ([]BenchmarkDataset, error)
}

// MetricsProvider provides project metrics for comparison
type MetricsProvider interface {
	GetProjectMetrics(ctx context.Context, projectID uuid.UUID) (map[string]float64, error)
	GetProjectsInPeerGroup(ctx context.Context, methodology, region string) ([]ProjectMetrics, error)
}

// BenchmarkDataset represents benchmark data
type BenchmarkDataset struct {
	ID              uuid.UUID       `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	Category        string          `json:"category"`
	Methodology     string          `json:"methodology"`
	Region          string          `json:"region"`
	Data            json.RawMessage `json:"data"`
	Year            int             `json:"year"`
	Source          string          `json:"source"`
	ConfidenceScore float64         `json:"confidence_score"`
	IsActive        bool            `json:"is_active"`
}

// BenchmarkFilter defines filtering options
type BenchmarkFilter struct {
	Category    string
	Methodology string
	Region      string
	Year        int
	IsActive    *bool
}

// BenchmarkMetric represents a single benchmark metric
type BenchmarkMetric struct {
	Metric       string  `json:"metric"`
	Value        float64 `json:"value"`
	Unit         string  `json:"unit"`
	Percentile25 float64 `json:"percentile_25"`
	Percentile50 float64 `json:"percentile_50"`
	Percentile75 float64 `json:"percentile_75"`
	Percentile90 float64 `json:"percentile_90"`
	Min          float64 `json:"min"`
	Max          float64 `json:"max"`
	SampleSize   int     `json:"sample_size"`
	Description  string  `json:"description"`
}

// ProjectMetrics represents a project's metrics
type ProjectMetrics struct {
	ProjectID   uuid.UUID          `json:"project_id"`
	Metrics     map[string]float64 `json:"metrics"`
	Methodology string             `json:"methodology"`
	Region      string             `json:"region"`
}

// ComparisonRequest represents a benchmark comparison request
type ComparisonRequest struct {
	ProjectID   uuid.UUID `json:"project_id"`
	Category    string    `json:"category"`
	Methodology string    `json:"methodology"`
	Region      string    `json:"region"`
	Year        int       `json:"year"`
}

// ComparisonResult represents the full comparison result
type ComparisonResult struct {
	ProjectID       uuid.UUID          `json:"project_id"`
	ProjectMetrics  map[string]float64 `json:"project_metrics"`
	Comparisons     []MetricComparison `json:"comparisons"`
	PercentileRanks map[string]float64 `json:"percentile_ranks"`
	GapAnalysis     []GapAnalysisItem  `json:"gap_analysis"`
	OverallScore    float64            `json:"overall_score"`
	PerformanceRank string             `json:"performance_rank"`
	Summary         string             `json:"summary"`
}

// MetricComparison represents comparison for a single metric
type MetricComparison struct {
	Metric            string  `json:"metric"`
	ProjectValue      float64 `json:"project_value"`
	BenchmarkMedian   float64 `json:"benchmark_median"`
	BenchmarkP25      float64 `json:"benchmark_p25"`
	BenchmarkP75      float64 `json:"benchmark_p75"`
	Difference        float64 `json:"difference"`
	DifferencePercent float64 `json:"difference_percent"`
	PerformanceLevel  string  `json:"performance_level"`
	Trend             string  `json:"trend"`
}

// GapAnalysisItem represents a performance gap
type GapAnalysisItem struct {
	Metric         string  `json:"metric"`
	CurrentValue   float64 `json:"current_value"`
	TargetValue    float64 `json:"target_value"`
	Gap            float64 `json:"gap"`
	GapPercent     float64 `json:"gap_percent"`
	Priority       string  `json:"priority"`
	Impact         string  `json:"impact"`
	Recommendation string  `json:"recommendation"`
}

// NewComparator creates a new benchmark comparator
func NewComparator(repository BenchmarkRepository, metrics MetricsProvider) *Comparator {
	return &Comparator{
		repository: repository,
		metrics:    metrics,
	}
}

// Compare performs a benchmark comparison
func (c *Comparator) Compare(ctx context.Context, req ComparisonRequest) (*ComparisonResult, error) {
	// Get project metrics
	projectMetrics, err := c.metrics.GetProjectMetrics(ctx, req.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("failed to get project metrics: %w", err)
	}

	// Get benchmark dataset
	benchmark, err := c.repository.GetBenchmarkByCategory(ctx, req.Category, req.Methodology, req.Region, req.Year)
	if err != nil {
		return nil, fmt.Errorf("benchmark not found: %w", err)
	}

	// Parse benchmark data
	var benchmarkMetrics []BenchmarkMetric
	if err := json.Unmarshal(benchmark.Data, &benchmarkMetrics); err != nil {
		return nil, fmt.Errorf("failed to parse benchmark data: %w", err)
	}

	// Build comparisons
	comparisons := make([]MetricComparison, 0)
	percentileRanks := make(map[string]float64)
	gaps := make([]GapAnalysisItem, 0)

	for _, bm := range benchmarkMetrics {
		projectValue, exists := projectMetrics[bm.Metric]
		if !exists {
			continue
		}

		comparison := c.compareMetric(projectValue, bm)
		comparisons = append(comparisons, comparison)

		// Calculate percentile rank
		percentileRanks[bm.Metric] = c.calculatePercentileRank(projectValue, bm)

		// Check for gaps
		if comparison.PerformanceLevel == "below" {
			gap := c.analyzeGap(bm.Metric, projectValue, bm)
			gaps = append(gaps, gap)
		}
	}

	// Calculate overall score
	overallScore := c.calculateOverallScore(percentileRanks)

	// Determine performance rank
	performanceRank := c.determineRank(overallScore)

	// Generate summary
	summary := c.generateSummary(comparisons, gaps, overallScore)

	return &ComparisonResult{
		ProjectID:       req.ProjectID,
		ProjectMetrics:  projectMetrics,
		Comparisons:     comparisons,
		PercentileRanks: percentileRanks,
		GapAnalysis:     gaps,
		OverallScore:    overallScore,
		PerformanceRank: performanceRank,
		Summary:         summary,
	}, nil
}

func (c *Comparator) compareMetric(projectValue float64, benchmark BenchmarkMetric) MetricComparison {
	diff := projectValue - benchmark.Percentile50
	diffPercent := 0.0
	if benchmark.Percentile50 != 0 {
		diffPercent = (diff / benchmark.Percentile50) * 100
	}

	// Determine performance level
	var level string
	if projectValue >= benchmark.Percentile75 {
		level = "excellent"
	} else if projectValue >= benchmark.Percentile50 {
		level = "above"
	} else if projectValue >= benchmark.Percentile25 {
		level = "at"
	} else {
		level = "below"
	}

	return MetricComparison{
		Metric:            benchmark.Metric,
		ProjectValue:      projectValue,
		BenchmarkMedian:   benchmark.Percentile50,
		BenchmarkP25:      benchmark.Percentile25,
		BenchmarkP75:      benchmark.Percentile75,
		Difference:        diff,
		DifferencePercent: diffPercent,
		PerformanceLevel:  level,
		Trend:             "", // Would be populated from historical data
	}
}

func (c *Comparator) calculatePercentileRank(value float64, benchmark BenchmarkMetric) float64 {
	// Estimate percentile rank using linear interpolation
	if value <= benchmark.Min {
		return 0
	}
	if value >= benchmark.Max {
		return 100
	}

	// Simple linear interpolation between known percentiles
	percentiles := []struct {
		p     float64
		value float64
	}{
		{0, benchmark.Min},
		{25, benchmark.Percentile25},
		{50, benchmark.Percentile50},
		{75, benchmark.Percentile75},
		{90, benchmark.Percentile90},
		{100, benchmark.Max},
	}

	for i := 1; i < len(percentiles); i++ {
		if value <= percentiles[i].value {
			// Interpolate between this and previous percentile
			lower := percentiles[i-1]
			upper := percentiles[i]
			ratio := (value - lower.value) / (upper.value - lower.value)
			return lower.p + ratio*(upper.p-lower.p)
		}
	}

	return 100
}

func (c *Comparator) analyzeGap(metric string, projectValue float64, benchmark BenchmarkMetric) GapAnalysisItem {
	// Target P50 as the minimum acceptable level
	target := benchmark.Percentile50
	gap := target - projectValue
	gapPercent := 0.0
	if target != 0 {
		gapPercent = (gap / target) * 100
	}

	// Determine priority based on gap size
	priority := "low"
	if gapPercent > 30 {
		priority = "high"
	} else if gapPercent > 15 {
		priority = "medium"
	}

	// Determine impact
	impact := c.determineImpact(metric)

	// Generate recommendation
	recommendation := c.generateRecommendation(metric, gap, gapPercent)

	return GapAnalysisItem{
		Metric:         metric,
		CurrentValue:   projectValue,
		TargetValue:    target,
		Gap:            gap,
		GapPercent:     gapPercent,
		Priority:       priority,
		Impact:         impact,
		Recommendation: recommendation,
	}
}

func (c *Comparator) calculateOverallScore(percentileRanks map[string]float64) float64 {
	if len(percentileRanks) == 0 {
		return 0
	}

	sum := 0.0
	for _, rank := range percentileRanks {
		sum += rank
	}
	return sum / float64(len(percentileRanks))
}

func (c *Comparator) determineRank(score float64) string {
	switch {
	case score >= 90:
		return "Top Performer"
	case score >= 75:
		return "Above Average"
	case score >= 50:
		return "Average"
	case score >= 25:
		return "Below Average"
	default:
		return "Needs Improvement"
	}
}

func (c *Comparator) determineImpact(metric string) string {
	highImpactMetrics := map[string]bool{
		"carbon_sequestration_rate": true,
		"total_credits_issued":      true,
		"revenue_per_hectare":       true,
		"verification_success_rate": true,
	}

	if highImpactMetrics[metric] {
		return "high"
	}
	return "medium"
}

func (c *Comparator) generateRecommendation(metric string, gap, gapPercent float64) string {
	recommendations := map[string]string{
		"carbon_sequestration_rate": "Consider implementing enhanced forest management practices, optimizing species composition, or improving soil management techniques.",
		"total_credits_issued":      "Focus on increasing monitoring coverage and documentation quality to maximize credit issuance potential.",
		"revenue_per_hectare":       "Explore premium certification programs, direct buyer relationships, or bundled credit offerings to improve revenue.",
		"verification_success_rate": "Review documentation processes, ensure alignment with methodology requirements, and consider third-party pre-verification.",
		"monitoring_coverage":       "Deploy additional IoT sensors, increase satellite imagery frequency, or implement drone-based monitoring.",
		"biomass_growth_rate":       "Evaluate current species selection, soil amendments, and silvicultural practices for optimization opportunities.",
	}

	if rec, exists := recommendations[metric]; exists {
		return rec
	}
	return fmt.Sprintf("Review current practices for %s and consult with technical advisors for improvement strategies. Gap: %.1f%%", metric, gapPercent)
}

func (c *Comparator) generateSummary(comparisons []MetricComparison, gaps []GapAnalysisItem, score float64) string {
	excellentCount := 0
	aboveCount := 0
	belowCount := 0

	for _, comp := range comparisons {
		switch comp.PerformanceLevel {
		case "excellent":
			excellentCount++
		case "above":
			aboveCount++
		case "below":
			belowCount++
		}
	}

	summary := fmt.Sprintf("Overall performance score: %.1f%%. ", score)

	if excellentCount > 0 {
		summary += fmt.Sprintf("%d metrics in top quartile. ", excellentCount)
	}
	if aboveCount > 0 {
		summary += fmt.Sprintf("%d metrics above median. ", aboveCount)
	}
	if belowCount > 0 {
		summary += fmt.Sprintf("%d metrics require attention. ", belowCount)
	}

	if len(gaps) > 0 {
		highPriorityGaps := 0
		for _, gap := range gaps {
			if gap.Priority == "high" {
				highPriorityGaps++
			}
		}
		if highPriorityGaps > 0 {
			summary += fmt.Sprintf("%d high-priority improvement areas identified.", highPriorityGaps)
		}
	}

	return summary
}

// CalculatePercentileFromPeers calculates percentile rank among peer projects
func (c *Comparator) CalculatePercentileFromPeers(ctx context.Context, projectID uuid.UUID, metric string, methodology, region string) (float64, error) {
	// Get all projects in peer group
	peers, err := c.metrics.GetProjectsInPeerGroup(ctx, methodology, region)
	if err != nil {
		return 0, err
	}

	// Extract metric values
	values := make([]float64, 0, len(peers))
	var projectValue float64
	projectFound := false

	for _, peer := range peers {
		if val, exists := peer.Metrics[metric]; exists {
			values = append(values, val)
			if peer.ProjectID == projectID {
				projectValue = val
				projectFound = true
			}
		}
	}

	if !projectFound || len(values) == 0 {
		return 0, fmt.Errorf("project or metric not found")
	}

	// Sort values
	sort.Float64s(values)

	// Find position of project value
	position := 0
	for i, v := range values {
		if v <= projectValue {
			position = i + 1
		}
	}

	// Calculate percentile
	percentile := (float64(position) / float64(len(values))) * 100
	return math.Round(percentile*10) / 10, nil
}

// TrendAnalyzer analyzes performance trends over time
type TrendAnalyzer struct {
	metricsProvider MetricsProvider
}

// TrendResult represents trend analysis results
type TrendResult struct {
	Metric       string      `json:"metric"`
	CurrentValue float64     `json:"current_value"`
	Trend        string      `json:"trend"`
	ChangeRate   float64     `json:"change_rate"`
	Projection   float64     `json:"projection"`
	DataPoints   []DataPoint `json:"data_points"`
}

// DataPoint represents a historical data point
type DataPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

// NewTrendAnalyzer creates a new trend analyzer
func NewTrendAnalyzer(provider MetricsProvider) *TrendAnalyzer {
	return &TrendAnalyzer{metricsProvider: provider}
}

// AnalyzeTrend analyzes the trend for a metric
func (t *TrendAnalyzer) AnalyzeTrend(dataPoints []DataPoint) *TrendResult {
	if len(dataPoints) < 2 {
		return nil
	}

	// Calculate simple linear regression
	n := float64(len(dataPoints))
	sumX := 0.0
	sumY := 0.0
	sumXY := 0.0
	sumX2 := 0.0

	for i, dp := range dataPoints {
		x := float64(i)
		y := dp.Value
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	// Calculate slope
	slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)

	// Determine trend direction
	trend := "stable"
	if slope > 0.05 {
		trend = "improving"
	} else if slope < -0.05 {
		trend = "declining"
	}

	// Calculate change rate
	firstValue := dataPoints[0].Value
	lastValue := dataPoints[len(dataPoints)-1].Value
	changeRate := 0.0
	if firstValue != 0 {
		changeRate = ((lastValue - firstValue) / firstValue) * 100
	}

	// Project next value
	projection := lastValue + slope

	return &TrendResult{
		CurrentValue: lastValue,
		Trend:        trend,
		ChangeRate:   changeRate,
		Projection:   projection,
		DataPoints:   dataPoints,
	}
}
