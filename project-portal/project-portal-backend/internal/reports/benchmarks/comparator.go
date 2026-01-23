package benchmarks

import (
	"context"
	"fmt"
	"math"
	"sort"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Comparator compares project metrics against benchmarks
type Comparator struct {
	repository BenchmarkRepository
	logger     *zap.Logger
}

// BenchmarkRepository interface for benchmark data access
type BenchmarkRepository interface {
	GetBenchmarksByCategory(ctx context.Context, category string, methodology, region *string, year *int) ([]*Benchmark, error)
	GetProjectMetrics(ctx context.Context, projectID uuid.UUID, metricTypes []string) (map[string]float64, error)
}

// Benchmark represents a benchmark dataset
type Benchmark struct {
	ID                   uuid.UUID         `json:"id"`
	Name                 string            `json:"name"`
	Description          *string           `json:"description,omitempty"`
	Category             string            `json:"category"`
	Methodology          *string           `json:"methodology,omitempty"`
	Region               *string           `json:"region,omitempty"`
	Year                 int               `json:"year"`
	Data                 BenchmarkData     `json:"data"`
	Statistics           BenchmarkStats    `json:"statistics"`
	Source               *string           `json:"source,omitempty"`
	ConfidenceScore      float64           `json:"confidence_score"`
	SampleSize           int               `json:"sample_size"`
}

// BenchmarkData represents the raw benchmark data
type BenchmarkData struct {
	Values      []float64 `json:"values"`
	Unit        string    `json:"unit"`
	Methodology string    `json:"methodology,omitempty"`
	Market      string    `json:"market,omitempty"`
}

// BenchmarkStats represents pre-calculated statistics
type BenchmarkStats struct {
	Mean    float64 `json:"mean"`
	Median  float64 `json:"median"`
	StdDev  float64 `json:"std_dev"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	P25     float64 `json:"p25"`
	P75     float64 `json:"p75"`
	P90     float64 `json:"p90"`
}

// ComparisonRequest represents a benchmark comparison request
type ComparisonRequest struct {
	ProjectID   uuid.UUID `json:"project_id"`
	Category    string    `json:"category"`
	Methodology *string   `json:"methodology,omitempty"`
	Region      *string   `json:"region,omitempty"`
	Year        *int      `json:"year,omitempty"`
	MetricTypes []string  `json:"metric_types,omitempty"`
}

// ComparisonResult represents the result of a benchmark comparison
type ComparisonResult struct {
	ProjectMetrics    map[string]float64     `json:"project_metrics"`
	BenchmarkMetrics  map[string]MetricStats `json:"benchmark_metrics"`
	PercentileRanking map[string]float64     `json:"percentile_ranking"`
	GapAnalysis       []GapItem              `json:"gap_analysis"`
	Recommendations   []Recommendation       `json:"recommendations"`
	BenchmarkInfo     BenchmarkInfo          `json:"benchmark_info"`
}

// MetricStats represents statistics for a metric
type MetricStats struct {
	Mean       float64 `json:"mean"`
	Median     float64 `json:"median"`
	Min        float64 `json:"min"`
	Max        float64 `json:"max"`
	P25        float64 `json:"p25"`
	P75        float64 `json:"p75"`
	P90        float64 `json:"p90"`
	StdDev     float64 `json:"std_dev"`
	Unit       string  `json:"unit"`
	SampleSize int     `json:"sample_size"`
}

// GapItem represents a gap between project and benchmark
type GapItem struct {
	Metric        string  `json:"metric"`
	CurrentValue  float64 `json:"current_value"`
	TargetValue   float64 `json:"target_value"`
	Gap           float64 `json:"gap"`
	GapPercentage float64 `json:"gap_percentage"`
	Priority      string  `json:"priority"` // high, medium, low
	Direction     string  `json:"direction"` // above, below, at_target
}

// Recommendation represents an improvement recommendation
type Recommendation struct {
	Metric       string   `json:"metric"`
	Priority     string   `json:"priority"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	ActionItems  []string `json:"action_items,omitempty"`
	ExpectedGain float64  `json:"expected_gain,omitempty"`
}

// BenchmarkInfo contains information about the benchmark used
type BenchmarkInfo struct {
	Name            string  `json:"name"`
	Year            int     `json:"year"`
	Source          string  `json:"source,omitempty"`
	ConfidenceScore float64 `json:"confidence_score"`
	SampleSize      int     `json:"sample_size"`
	Methodology     string  `json:"methodology,omitempty"`
	Region          string  `json:"region,omitempty"`
}

// NewComparator creates a new comparator
func NewComparator(repository BenchmarkRepository, logger *zap.Logger) *Comparator {
	return &Comparator{
		repository: repository,
		logger:     logger,
	}
}

// Compare performs a benchmark comparison
func (c *Comparator) Compare(ctx context.Context, req *ComparisonRequest) (*ComparisonResult, error) {
	// Get relevant benchmarks
	benchmarks, err := c.repository.GetBenchmarksByCategory(ctx, req.Category, req.Methodology, req.Region, req.Year)
	if err != nil {
		return nil, fmt.Errorf("failed to get benchmarks: %w", err)
	}

	if len(benchmarks) == 0 {
		return nil, fmt.Errorf("no benchmarks found for category: %s", req.Category)
	}

	// Select the best matching benchmark
	benchmark := c.selectBestBenchmark(benchmarks, req)

	// Get project metrics
	projectMetrics, err := c.repository.GetProjectMetrics(ctx, req.ProjectID, req.MetricTypes)
	if err != nil {
		return nil, fmt.Errorf("failed to get project metrics: %w", err)
	}

	// Build result
	result := &ComparisonResult{
		ProjectMetrics:    projectMetrics,
		BenchmarkMetrics:  c.extractBenchmarkMetrics(benchmark),
		PercentileRanking: c.calculatePercentileRanking(projectMetrics, benchmark),
		GapAnalysis:       c.analyzeGaps(projectMetrics, benchmark),
		Recommendations:   c.generateRecommendations(projectMetrics, benchmark),
		BenchmarkInfo:     c.buildBenchmarkInfo(benchmark),
	}

	return result, nil
}

// selectBestBenchmark selects the most relevant benchmark
func (c *Comparator) selectBestBenchmark(benchmarks []*Benchmark, req *ComparisonRequest) *Benchmark {
	// Sort by relevance: methodology match, region match, recency, confidence
	sort.Slice(benchmarks, func(i, j int) bool {
		scoreI := c.scoreBenchmark(benchmarks[i], req)
		scoreJ := c.scoreBenchmark(benchmarks[j], req)
		return scoreI > scoreJ
	})

	return benchmarks[0]
}

// scoreBenchmark scores a benchmark for relevance
func (c *Comparator) scoreBenchmark(b *Benchmark, req *ComparisonRequest) float64 {
	score := 0.0

	// Methodology match (high weight)
	if req.Methodology != nil && b.Methodology != nil && *b.Methodology == *req.Methodology {
		score += 30
	}

	// Region match (medium weight)
	if req.Region != nil && b.Region != nil && *b.Region == *req.Region {
		score += 20
	}

	// Year match (medium weight)
	if req.Year != nil {
		yearDiff := math.Abs(float64(*req.Year - b.Year))
		score += 10 - yearDiff // More recent = higher score
	}

	// Confidence score (low weight)
	score += b.ConfidenceScore * 10

	// Sample size (low weight)
	score += math.Min(float64(b.SampleSize)/100, 10)

	return score
}

// extractBenchmarkMetrics extracts metrics from benchmark
func (c *Comparator) extractBenchmarkMetrics(b *Benchmark) map[string]MetricStats {
	metrics := make(map[string]MetricStats)

	metrics[b.Category] = MetricStats{
		Mean:       b.Statistics.Mean,
		Median:     b.Statistics.Median,
		Min:        b.Statistics.Min,
		Max:        b.Statistics.Max,
		P25:        b.Statistics.P25,
		P75:        b.Statistics.P75,
		P90:        b.Statistics.P90,
		StdDev:     b.Statistics.StdDev,
		Unit:       b.Data.Unit,
		SampleSize: b.SampleSize,
	}

	return metrics
}

// calculatePercentileRanking calculates percentile ranking for project metrics
func (c *Comparator) calculatePercentileRanking(projectMetrics map[string]float64, b *Benchmark) map[string]float64 {
	rankings := make(map[string]float64)

	if len(b.Data.Values) == 0 {
		return rankings
	}

	// Sort benchmark values
	sorted := make([]float64, len(b.Data.Values))
	copy(sorted, b.Data.Values)
	sort.Float64s(sorted)

	for metric, value := range projectMetrics {
		// Find position in sorted array
		position := 0
		for i, v := range sorted {
			if value <= v {
				position = i
				break
			}
			position = i + 1
		}

		// Calculate percentile
		percentile := float64(position) / float64(len(sorted)) * 100
		rankings[metric] = math.Round(percentile*100) / 100
	}

	return rankings
}

// analyzeGaps analyzes gaps between project metrics and benchmarks
func (c *Comparator) analyzeGaps(projectMetrics map[string]float64, b *Benchmark) []GapItem {
	var gaps []GapItem

	for metric, value := range projectMetrics {
		target := b.Statistics.Median
		gap := value - target
		gapPercentage := 0.0
		if target != 0 {
			gapPercentage = (gap / target) * 100
		}

		direction := "at_target"
		if gap > 0 {
			direction = "above"
		} else if gap < 0 {
			direction = "below"
		}

		priority := c.determinePriority(gapPercentage)

		gaps = append(gaps, GapItem{
			Metric:        metric,
			CurrentValue:  value,
			TargetValue:   target,
			Gap:           gap,
			GapPercentage: math.Round(gapPercentage*100) / 100,
			Priority:      priority,
			Direction:     direction,
		})
	}

	// Sort by priority
	sort.Slice(gaps, func(i, j int) bool {
		priorityOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
		return priorityOrder[gaps[i].Priority] < priorityOrder[gaps[j].Priority]
	})

	return gaps
}

// determinePriority determines the priority based on gap percentage
func (c *Comparator) determinePriority(gapPercentage float64) string {
	absGap := math.Abs(gapPercentage)
	if absGap > 25 {
		return "high"
	} else if absGap > 10 {
		return "medium"
	}
	return "low"
}

// generateRecommendations generates improvement recommendations
func (c *Comparator) generateRecommendations(projectMetrics map[string]float64, b *Benchmark) []Recommendation {
	var recommendations []Recommendation
	gaps := c.analyzeGaps(projectMetrics, b)

	for _, gap := range gaps {
		if gap.Direction == "below" {
			rec := Recommendation{
				Metric:   gap.Metric,
				Priority: gap.Priority,
			}

			switch gap.Priority {
			case "high":
				rec.Title = fmt.Sprintf("Critical improvement needed for %s", gap.Metric)
				rec.Description = fmt.Sprintf(
					"Current performance (%.2f) is %.1f%% below the industry benchmark (%.2f). "+
						"This represents a significant opportunity for improvement.",
					gap.CurrentValue, math.Abs(gap.GapPercentage), gap.TargetValue,
				)
				rec.ActionItems = []string{
					"Review current methodology and identify bottlenecks",
					"Consider implementing best practices from top performers",
					"Set incremental improvement targets",
				}
				rec.ExpectedGain = gap.TargetValue - gap.CurrentValue

			case "medium":
				rec.Title = fmt.Sprintf("Moderate improvement opportunity for %s", gap.Metric)
				rec.Description = fmt.Sprintf(
					"Current performance (%.2f) is %.1f%% below benchmark (%.2f). "+
						"There is room for improvement with focused effort.",
					gap.CurrentValue, math.Abs(gap.GapPercentage), gap.TargetValue,
				)
				rec.ActionItems = []string{
					"Identify specific areas for optimization",
					"Implement targeted improvements",
				}
				rec.ExpectedGain = (gap.TargetValue - gap.CurrentValue) * 0.5

			case "low":
				rec.Title = fmt.Sprintf("Minor optimization possible for %s", gap.Metric)
				rec.Description = fmt.Sprintf(
					"Performance (%.2f) is close to benchmark (%.2f). "+
						"Fine-tuning may yield small improvements.",
					gap.CurrentValue, gap.TargetValue,
				)
			}

			recommendations = append(recommendations, rec)
		} else if gap.Direction == "above" && gap.Priority != "low" {
			rec := Recommendation{
				Metric:   gap.Metric,
				Priority: "info",
				Title:    fmt.Sprintf("Excellent performance on %s", gap.Metric),
				Description: fmt.Sprintf(
					"Current performance (%.2f) exceeds the benchmark (%.2f) by %.1f%%. "+
						"This is a strength that can be leveraged.",
					gap.CurrentValue, gap.TargetValue, gap.GapPercentage,
				),
			}
			recommendations = append(recommendations, rec)
		}
	}

	return recommendations
}

// buildBenchmarkInfo builds benchmark information
func (c *Comparator) buildBenchmarkInfo(b *Benchmark) BenchmarkInfo {
	info := BenchmarkInfo{
		Name:            b.Name,
		Year:            b.Year,
		ConfidenceScore: b.ConfidenceScore,
		SampleSize:      b.SampleSize,
	}

	if b.Source != nil {
		info.Source = *b.Source
	}
	if b.Methodology != nil {
		info.Methodology = *b.Methodology
	}
	if b.Region != nil {
		info.Region = *b.Region
	}

	return info
}

// CalculateStatistics calculates statistics from raw values
func CalculateStatistics(values []float64) BenchmarkStats {
	if len(values) == 0 {
		return BenchmarkStats{}
	}

	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	n := len(sorted)
	sum := 0.0
	for _, v := range sorted {
		sum += v
	}
	mean := sum / float64(n)

	// Median
	var median float64
	if n%2 == 0 {
		median = (sorted[n/2-1] + sorted[n/2]) / 2
	} else {
		median = sorted[n/2]
	}

	// Standard deviation
	sumSqDiff := 0.0
	for _, v := range sorted {
		sumSqDiff += math.Pow(v-mean, 2)
	}
	stdDev := math.Sqrt(sumSqDiff / float64(n))

	// Percentiles
	p25 := percentile(sorted, 25)
	p75 := percentile(sorted, 75)
	p90 := percentile(sorted, 90)

	return BenchmarkStats{
		Mean:   mean,
		Median: median,
		StdDev: stdDev,
		Min:    sorted[0],
		Max:    sorted[n-1],
		P25:    p25,
		P75:    p75,
		P90:    p90,
	}
}

// percentile calculates the p-th percentile of a sorted slice
func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}

	index := (p / 100) * float64(len(sorted)-1)
	lower := int(math.Floor(index))
	upper := int(math.Ceil(index))

	if lower == upper {
		return sorted[lower]
	}

	weight := index - float64(lower)
	return sorted[lower]*(1-weight) + sorted[upper]*weight
}
