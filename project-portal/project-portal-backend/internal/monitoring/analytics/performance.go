// Package analytics computes derived views over stored monitoring data.
//
// PerformanceService benchmarks observed service performance (latency
// percentiles, error rate, uptime) against SLA thresholds supplied by
// configuration, and reports a pass/fail verdict plus the signed distance
// from each threshold.
package analytics

import (
	"context"
	"errors"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// Default metric names used when configuration does not override them. They
// are the names the API middleware is expected to record under; deployments
// that use different names configure them rather than editing this file.
const (
	DefaultLatencyMetric   = "api_request_latency_ms"
	DefaultErrorRateMetric = "api_error_rate"
)

// DefaultWindow is the look-back period used when a request does not specify
// its own window.
const DefaultWindow = time.Hour

// Metric identifiers reported in a BenchmarkReport.
const (
	MetricLatencyP50 = "latency_p50_ms"
	MetricLatencyP95 = "latency_p95_ms"
	MetricLatencyP99 = "latency_p99_ms"
	MetricErrorRate  = "error_rate"
	MetricUptime     = "uptime"
)

// Comparison describes how an observed value is judged against its threshold.
type Comparison string

const (
	// ComparisonMaximum means the threshold is a ceiling: the benchmark passes
	// while observed <= threshold (latency, error rate).
	ComparisonMaximum Comparison = "max"
	// ComparisonMinimum means the threshold is a floor: the benchmark passes
	// while observed >= threshold (uptime).
	ComparisonMinimum Comparison = "min"
)

// SLAThresholds holds the configured SLA targets a service is benchmarked
// against. A zero value for any threshold means "not configured": that metric
// is reported but skipped rather than failed, so an unconfigured SLA can never
// manufacture a breach.
type SLAThresholds struct {
	// LatencyP50Ms, LatencyP95Ms and LatencyP99Ms are ceilings in milliseconds.
	LatencyP50Ms float64
	LatencyP95Ms float64
	LatencyP99Ms float64
	// MaxErrorRate is a ceiling expressed as a fraction in [0,1] (0.01 = 1%).
	MaxErrorRate float64
	// MinUptime is a floor expressed as a fraction in [0,1] (0.999 = 99.9%).
	MinUptime float64

	// LatencyMetricName and ErrorRateMetricName name the stored metrics the
	// observed values are read from. Empty values fall back to the Default*
	// constants above.
	LatencyMetricName   string
	ErrorRateMetricName string
}

// latencyMetric returns the configured latency metric name or the default.
func (t SLAThresholds) latencyMetric() string {
	if t.LatencyMetricName != "" {
		return t.LatencyMetricName
	}
	return DefaultLatencyMetric
}

// errorRateMetric returns the configured error-rate metric name or the default.
func (t SLAThresholds) errorRateMetric() string {
	if t.ErrorRateMetricName != "" {
		return t.ErrorRateMetricName
	}
	return DefaultErrorRateMetric
}

// MetricAggregator is the narrow read port over stored metrics that the
// benchmark needs. monitoring.Repository satisfies it.
type MetricAggregator interface {
	GetMetricAggregation(ctx context.Context, req monitoring.AggregationRequest) (*monitoring.MetricAggregationResult, error)
}

// HealthHistoryReader is the narrow read port over stored health-check results
// used to derive observed uptime. monitoring.Repository satisfies it.
type HealthHistoryReader interface {
	GetHealthCheckResultsByTimeRange(ctx context.Context, serviceName string, start, end time.Time) ([]monitoring.HealthCheckResult, error)
}

// MetricBenchmark is the result of comparing one observed metric against its
// configured threshold.
type MetricBenchmark struct {
	Metric     string     `json:"metric"`
	Unit       string     `json:"unit"`
	Observed   float64    `json:"observed"`
	Threshold  float64    `json:"threshold"`
	Comparison Comparison `json:"comparison"`
	// Passed is true when the observed value satisfies the threshold. A value
	// exactly equal to its threshold passes for both comparison directions.
	Passed bool `json:"passed"`
	// Delta is always observed-threshold. For a ComparisonMaximum metric a
	// positive delta is a breach; for ComparisonMinimum a negative delta is.
	Delta float64 `json:"delta"`
	// Skipped is true when the metric could not be judged — either no
	// threshold is configured or no data exists in the window. A skipped
	// benchmark never fails the report.
	Skipped bool   `json:"skipped"`
	Note    string `json:"note,omitempty"`
}

// BenchmarkReport is the structured result returned to an HTTP handler or
// worker.
type BenchmarkReport struct {
	Service     string            `json:"service"`
	WindowStart time.Time         `json:"window_start"`
	WindowEnd   time.Time         `json:"window_end"`
	GeneratedAt time.Time         `json:"generated_at"`
	// Passed is true when every non-skipped benchmark passed.
	Passed     bool              `json:"passed"`
	Benchmarks []MetricBenchmark `json:"benchmarks"`
	// Breaches lists the metric identifiers that failed, for quick alerting.
	Breaches []string `json:"breaches,omitempty"`
}

// BenchmarkRequest selects the service and window to benchmark.
type BenchmarkRequest struct {
	// Service is the service label to filter stored metrics and health checks
	// by. Required — an empty service would blend every service's data into a
	// single meaningless verdict.
	Service string
	// Start and End bound the window. When both are zero the service uses
	// Window (or DefaultWindow) ending at the current time.
	Start  time.Time
	End    time.Time
	Window time.Duration
}

// ErrServiceRequired is returned when a benchmark is requested without a
// service to scope it to.
var ErrServiceRequired = errors.New("analytics: service is required")

// PerformanceService benchmarks stored monitoring data against SLA thresholds.
type PerformanceService struct {
	metrics    MetricAggregator
	health     HealthHistoryReader
	thresholds SLAThresholds
	// now is injectable so tests can pin the window.
	now func() time.Time
}

// NewPerformanceService constructs a PerformanceService. Either port may be
// nil: the metrics it would supply are reported as skipped rather than
// panicking, so a partially wired deployment degrades instead of crashing.
func NewPerformanceService(metrics MetricAggregator, health HealthHistoryReader, thresholds SLAThresholds) *PerformanceService {
	return &PerformanceService{
		metrics:    metrics,
		health:     health,
		thresholds: thresholds,
		now:        time.Now,
	}
}

// Thresholds returns the SLA thresholds this service benchmarks against.
func (s *PerformanceService) Thresholds() SLAThresholds { return s.thresholds }

// resolveWindow derives the concrete [start,end) window for a request.
func (s *PerformanceService) resolveWindow(req BenchmarkRequest) (time.Time, time.Time) {
	if !req.Start.IsZero() && !req.End.IsZero() {
		return req.Start, req.End
	}
	end := req.End
	if end.IsZero() {
		end = s.now().UTC()
	}
	window := req.Window
	if window <= 0 {
		window = DefaultWindow
	}
	start := req.Start
	if start.IsZero() {
		start = end.Add(-window)
	}
	return start, end
}

// Benchmark computes the current performance metrics for a service over the
// requested window and compares each against its configured SLA threshold.
func (s *PerformanceService) Benchmark(ctx context.Context, req BenchmarkRequest) (*BenchmarkReport, error) {
	if req.Service == "" {
		return nil, ErrServiceRequired
	}

	start, end := s.resolveWindow(req)

	report := &BenchmarkReport{
		Service:     req.Service,
		WindowStart: start,
		WindowEnd:   end,
		GeneratedAt: s.now().UTC(),
		Benchmarks:  make([]MetricBenchmark, 0, 5),
	}

	latency, err := s.latencyPercentiles(ctx, req.Service, start, end)
	if err != nil {
		return nil, err
	}
	report.Benchmarks = append(report.Benchmarks,
		compare(MetricLatencyP50, "ms", latency.p50, s.thresholds.LatencyP50Ms, ComparisonMaximum, latency.note),
		compare(MetricLatencyP95, "ms", latency.p95, s.thresholds.LatencyP95Ms, ComparisonMaximum, latency.note),
		compare(MetricLatencyP99, "ms", latency.p99, s.thresholds.LatencyP99Ms, ComparisonMaximum, latency.note),
	)

	errorRate, errRateNote, err := s.errorRate(ctx, req.Service, start, end)
	if err != nil {
		return nil, err
	}
	report.Benchmarks = append(report.Benchmarks,
		compare(MetricErrorRate, "ratio", errorRate, s.thresholds.MaxErrorRate, ComparisonMaximum, errRateNote),
	)

	uptime, uptimeNote, err := s.uptime(ctx, req.Service, start, end)
	if err != nil {
		return nil, err
	}
	report.Benchmarks = append(report.Benchmarks,
		compare(MetricUptime, "ratio", uptime, s.thresholds.MinUptime, ComparisonMinimum, uptimeNote),
	)

	report.Passed = true
	for _, b := range report.Benchmarks {
		if b.Skipped {
			continue
		}
		if !b.Passed {
			report.Passed = false
			report.Breaches = append(report.Breaches, b.Metric)
		}
	}

	return report, nil
}

// percentiles carries the three latency percentiles plus a note explaining a
// missing reading, so all three share one aggregation round trip.
type percentiles struct {
	p50, p95, p99 float64
	note          string
}

// latencyPercentiles reads p50/p95/p99 for the configured latency metric.
func (s *PerformanceService) latencyPercentiles(ctx context.Context, service string, start, end time.Time) (percentiles, error) {
	if s.metrics == nil {
		return percentiles{note: "metric source not configured"}, nil
	}

	res, err := s.metrics.GetMetricAggregation(ctx, monitoring.AggregationRequest{
		MetricName:   s.thresholds.latencyMetric(),
		Service:      service,
		StartTime:    start,
		EndTime:      end,
		Aggregations: []string{"p50", "p95", "p99", "count"},
	})
	if err != nil {
		return percentiles{}, fmt.Errorf("aggregate latency metric %q: %w", s.thresholds.latencyMetric(), err)
	}
	if res == nil || res.Aggregations["count"] == 0 {
		return percentiles{note: "no latency samples in window"}, nil
	}

	return percentiles{
		p50: res.Aggregations["p50"],
		p95: res.Aggregations["p95"],
		p99: res.Aggregations["p99"],
	}, nil
}

// errorRate reads the mean of the configured error-rate metric over the window.
func (s *PerformanceService) errorRate(ctx context.Context, service string, start, end time.Time) (float64, string, error) {
	if s.metrics == nil {
		return 0, "metric source not configured", nil
	}

	res, err := s.metrics.GetMetricAggregation(ctx, monitoring.AggregationRequest{
		MetricName:   s.thresholds.errorRateMetric(),
		Service:      service,
		StartTime:    start,
		EndTime:      end,
		Aggregations: []string{"avg", "count"},
	})
	if err != nil {
		return 0, "", fmt.Errorf("aggregate error-rate metric %q: %w", s.thresholds.errorRateMetric(), err)
	}
	if res == nil || res.Aggregations["count"] == 0 {
		return 0, "no error-rate samples in window", nil
	}

	return res.Aggregations["avg"], "", nil
}

// uptime derives observed uptime from stored health-check results as the
// fraction of checks that reported healthy. Degraded results count against
// uptime: a degraded service is not meeting its availability target.
func (s *PerformanceService) uptime(ctx context.Context, service string, start, end time.Time) (float64, string, error) {
	if s.health == nil {
		return 0, "health source not configured", nil
	}

	results, err := s.health.GetHealthCheckResultsByTimeRange(ctx, service, start, end)
	if err != nil {
		return 0, "", fmt.Errorf("read health check results for %q: %w", service, err)
	}
	if len(results) == 0 {
		return 0, "no health checks in window", nil
	}

	healthy := 0
	for _, r := range results {
		if r.Status == monitoring.HealthCheckStatusHealthy {
			healthy++
		}
	}
	return float64(healthy) / float64(len(results)), "", nil
}

// compare judges one observed value against its threshold.
//
// A metric is skipped — neither passing nor failing — when no threshold is
// configured (threshold <= 0) or when the caller supplied a note explaining
// that no data was available. Otherwise a value exactly equal to the threshold
// passes, for both comparison directions.
func compare(metric, unit string, observed, threshold float64, cmp Comparison, note string) MetricBenchmark {
	b := MetricBenchmark{
		Metric:     metric,
		Unit:       unit,
		Observed:   observed,
		Threshold:  threshold,
		Comparison: cmp,
		Note:       note,
	}

	if note != "" {
		b.Skipped = true
		return b
	}
	if threshold <= 0 {
		b.Skipped = true
		b.Note = "no threshold configured"
		return b
	}

	b.Delta = observed - threshold
	switch cmp {
	case ComparisonMinimum:
		b.Passed = observed >= threshold
	default:
		b.Passed = observed <= threshold
	}
	return b
}
