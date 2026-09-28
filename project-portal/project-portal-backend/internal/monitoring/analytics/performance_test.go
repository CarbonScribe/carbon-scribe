package analytics

import (
	"context"
	"errors"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// fakeAggregator returns canned aggregation results keyed by metric name.
type fakeAggregator struct {
	byMetric map[string]map[string]float64
	err      error
	// lastRequests records every request for assertions on scoping.
	lastRequests []monitoring.AggregationRequest
}

func (f *fakeAggregator) GetMetricAggregation(_ context.Context, req monitoring.AggregationRequest) (*monitoring.MetricAggregationResult, error) {
	f.lastRequests = append(f.lastRequests, req)
	if f.err != nil {
		return nil, f.err
	}
	aggs, ok := f.byMetric[req.MetricName]
	if !ok {
		return &monitoring.MetricAggregationResult{
			MetricName:   req.MetricName,
			Aggregations: map[string]float64{"count": 0},
		}, nil
	}
	return &monitoring.MetricAggregationResult{
		MetricName:   req.MetricName,
		Aggregations: aggs,
	}, nil
}

// fakeHealth returns canned health-check results.
type fakeHealth struct {
	results []monitoring.HealthCheckResult
	err     error
}

func (f *fakeHealth) GetHealthCheckResultsByTimeRange(_ context.Context, _ string, _, _ time.Time) ([]monitoring.HealthCheckResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.results, nil
}

func healthResults(healthy, unhealthy int) []monitoring.HealthCheckResult {
	out := make([]monitoring.HealthCheckResult, 0, healthy+unhealthy)
	for i := 0; i < healthy; i++ {
		out = append(out, monitoring.HealthCheckResult{Status: monitoring.HealthCheckStatusHealthy})
	}
	for i := 0; i < unhealthy; i++ {
		out = append(out, monitoring.HealthCheckResult{Status: monitoring.HealthCheckStatusUnhealthy})
	}
	return out
}

func defaultThresholds() SLAThresholds {
	return SLAThresholds{
		LatencyP50Ms: 100,
		LatencyP95Ms: 250,
		LatencyP99Ms: 500,
		MaxErrorRate: 0.01,
		MinUptime:    0.99,
	}
}

// newTestService builds a PerformanceService with a pinned clock.
func newTestService(agg MetricAggregator, health HealthHistoryReader, th SLAThresholds) *PerformanceService {
	s := NewPerformanceService(agg, health, th)
	s.now = func() time.Time { return time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC) }
	return s
}

// findBenchmark returns the benchmark for a metric, failing the test if absent.
func findBenchmark(t *testing.T, report *BenchmarkReport, metric string) MetricBenchmark {
	t.Helper()
	for _, b := range report.Benchmarks {
		if b.Metric == metric {
			return b
		}
	}
	t.Fatalf("benchmark %q not present in report", metric)
	return MetricBenchmark{}
}

func TestBenchmarkRequiresService(t *testing.T) {
	s := newTestService(&fakeAggregator{}, &fakeHealth{}, defaultThresholds())

	_, err := s.Benchmark(context.Background(), BenchmarkRequest{})
	if !errors.Is(err, ErrServiceRequired) {
		t.Fatalf("expected ErrServiceRequired, got %v", err)
	}
}

func TestBenchmarkAllMetricsPass(t *testing.T) {
	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		DefaultLatencyMetric:   {"p50": 40, "p95": 120, "p99": 300, "count": 900},
		DefaultErrorRateMetric: {"avg": 0.002, "count": 60},
	}}
	s := newTestService(agg, &fakeHealth{results: healthResults(100, 0)}, defaultThresholds())

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !report.Passed {
		t.Fatalf("expected report to pass, breaches=%v", report.Breaches)
	}
	if len(report.Breaches) != 0 {
		t.Fatalf("expected no breaches, got %v", report.Breaches)
	}

	p95 := findBenchmark(t, report, MetricLatencyP95)
	if p95.Delta != 120-250 {
		t.Errorf("p95 delta = %v, want %v", p95.Delta, float64(120-250))
	}
	if p95.Comparison != ComparisonMaximum {
		t.Errorf("p95 comparison = %q, want %q", p95.Comparison, ComparisonMaximum)
	}

	uptime := findBenchmark(t, report, MetricUptime)
	if uptime.Observed != 1 {
		t.Errorf("uptime observed = %v, want 1", uptime.Observed)
	}
	if uptime.Comparison != ComparisonMinimum {
		t.Errorf("uptime comparison = %q, want %q", uptime.Comparison, ComparisonMinimum)
	}
}

func TestBenchmarkLatencyBreachFailsReport(t *testing.T) {
	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		// p99 of 750ms breaches the 500ms ceiling; everything else is inside SLA.
		DefaultLatencyMetric:   {"p50": 40, "p95": 120, "p99": 750, "count": 900},
		DefaultErrorRateMetric: {"avg": 0.002, "count": 60},
	}}
	s := newTestService(agg, &fakeHealth{results: healthResults(100, 0)}, defaultThresholds())

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if report.Passed {
		t.Fatal("expected report to fail on p99 breach")
	}
	if len(report.Breaches) != 1 || report.Breaches[0] != MetricLatencyP99 {
		t.Fatalf("breaches = %v, want [%s]", report.Breaches, MetricLatencyP99)
	}

	p99 := findBenchmark(t, report, MetricLatencyP99)
	if p99.Passed {
		t.Error("p99 benchmark should not pass")
	}
	if p99.Delta != 250 {
		t.Errorf("p99 delta = %v, want 250 (observed over threshold)", p99.Delta)
	}
}

func TestBenchmarkErrorRateBreach(t *testing.T) {
	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		DefaultLatencyMetric:   {"p50": 10, "p95": 20, "p99": 30, "count": 10},
		DefaultErrorRateMetric: {"avg": 0.05, "count": 60},
	}}
	s := newTestService(agg, &fakeHealth{results: healthResults(100, 0)}, defaultThresholds())

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if report.Passed {
		t.Fatal("expected report to fail on error-rate breach")
	}
	er := findBenchmark(t, report, MetricErrorRate)
	if er.Passed {
		t.Error("error-rate benchmark should not pass")
	}
	if got, want := er.Delta, 0.04; got < want-1e-9 || got > want+1e-9 {
		t.Errorf("error rate delta = %v, want %v", got, want)
	}
}

func TestBenchmarkUptimeBreach(t *testing.T) {
	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		DefaultLatencyMetric:   {"p50": 10, "p95": 20, "p99": 30, "count": 10},
		DefaultErrorRateMetric: {"avg": 0, "count": 10},
	}}
	// 90 healthy of 100 == 0.90 uptime, under the 0.99 floor.
	s := newTestService(agg, &fakeHealth{results: healthResults(90, 10)}, defaultThresholds())

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if report.Passed {
		t.Fatal("expected report to fail on uptime breach")
	}
	uptime := findBenchmark(t, report, MetricUptime)
	if uptime.Observed != 0.9 {
		t.Errorf("uptime observed = %v, want 0.9", uptime.Observed)
	}
	if uptime.Delta >= 0 {
		t.Errorf("uptime delta = %v, want negative (under floor)", uptime.Delta)
	}
}

// TestBenchmarkBoundaryValuesPass pins the documented boundary policy: a value
// exactly equal to its threshold passes, for both comparison directions.
func TestBenchmarkBoundaryValuesPass(t *testing.T) {
	th := defaultThresholds()
	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		DefaultLatencyMetric: {
			"p50":   th.LatencyP50Ms,
			"p95":   th.LatencyP95Ms,
			"p99":   th.LatencyP99Ms,
			"count": 500,
		},
		DefaultErrorRateMetric: {"avg": th.MaxErrorRate, "count": 500},
	}}
	// 99 healthy of 100 == exactly the 0.99 uptime floor.
	s := newTestService(agg, &fakeHealth{results: healthResults(99, 1)}, th)

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !report.Passed {
		t.Fatalf("values equal to threshold must pass; breaches=%v", report.Breaches)
	}
	for _, b := range report.Benchmarks {
		if b.Skipped {
			t.Errorf("benchmark %q unexpectedly skipped: %s", b.Metric, b.Note)
			continue
		}
		if !b.Passed {
			t.Errorf("benchmark %q at exact threshold should pass (observed=%v threshold=%v)", b.Metric, b.Observed, b.Threshold)
		}
		if b.Delta != 0 {
			t.Errorf("benchmark %q delta = %v, want 0 at exact threshold", b.Metric, b.Delta)
		}
	}
}

// TestBenchmarkJustOverAndUnderBoundary checks the smallest meaningful step
// either side of a threshold resolves the way the policy says it should.
func TestBenchmarkJustOverAndUnderBoundary(t *testing.T) {
	th := SLAThresholds{LatencyP95Ms: 250}

	t.Run("just under passes", func(t *testing.T) {
		agg := &fakeAggregator{byMetric: map[string]map[string]float64{
			DefaultLatencyMetric: {"p95": 249.999, "count": 1},
		}}
		s := newTestService(agg, nil, th)
		report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if b := findBenchmark(t, report, MetricLatencyP95); !b.Passed {
			t.Errorf("249.999 <= 250 should pass")
		}
	})

	t.Run("just over fails", func(t *testing.T) {
		agg := &fakeAggregator{byMetric: map[string]map[string]float64{
			DefaultLatencyMetric: {"p95": 250.001, "count": 1},
		}}
		s := newTestService(agg, nil, th)
		report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if b := findBenchmark(t, report, MetricLatencyP95); b.Passed {
			t.Errorf("250.001 <= 250 should fail")
		}
	})
}

// TestBenchmarkUnconfiguredThresholdIsSkipped ensures an unset SLA cannot
// manufacture a breach.
func TestBenchmarkUnconfiguredThresholdIsSkipped(t *testing.T) {
	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		DefaultLatencyMetric:   {"p50": 9999, "p95": 9999, "p99": 9999, "count": 10},
		DefaultErrorRateMetric: {"avg": 0.9, "count": 10},
	}}
	// No thresholds configured at all.
	s := newTestService(agg, &fakeHealth{results: healthResults(0, 10)}, SLAThresholds{})

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !report.Passed {
		t.Fatalf("unconfigured thresholds must not fail the report; breaches=%v", report.Breaches)
	}
	for _, b := range report.Benchmarks {
		if !b.Skipped {
			t.Errorf("benchmark %q should be skipped with no threshold configured", b.Metric)
		}
	}
}

// TestBenchmarkNoDataIsSkippedNotFailed ensures an idle window reports as
// skipped rather than as a 0-latency pass or a false breach.
func TestBenchmarkNoDataIsSkippedNotFailed(t *testing.T) {
	// Aggregator returns count == 0 for every metric; no health checks.
	s := newTestService(&fakeAggregator{}, &fakeHealth{}, defaultThresholds())

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !report.Passed {
		t.Fatalf("empty window must not fail the report; breaches=%v", report.Breaches)
	}
	uptime := findBenchmark(t, report, MetricUptime)
	if !uptime.Skipped || uptime.Note == "" {
		t.Errorf("uptime should be skipped with an explanatory note, got %+v", uptime)
	}
}

func TestBenchmarkPropagatesAggregatorError(t *testing.T) {
	boom := errors.New("timescale unavailable")
	s := newTestService(&fakeAggregator{err: boom}, &fakeHealth{}, defaultThresholds())

	_, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if !errors.Is(err, boom) {
		t.Fatalf("expected aggregator error to propagate, got %v", err)
	}
}

func TestBenchmarkScopesQueriesToServiceAndWindow(t *testing.T) {
	agg := &fakeAggregator{}
	s := newTestService(agg, &fakeHealth{}, defaultThresholds())

	_, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "billing", Window: 30 * time.Minute})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(agg.lastRequests) == 0 {
		t.Fatal("expected the aggregator to be queried")
	}
	for _, req := range agg.lastRequests {
		if req.Service != "billing" {
			t.Errorf("aggregation not scoped to service: got %q", req.Service)
		}
		if got := req.EndTime.Sub(req.StartTime); got != 30*time.Minute {
			t.Errorf("window = %v, want 30m", got)
		}
	}
}

// TestCustomMetricNames verifies the observed values are read from the
// configured metric names rather than the built-in defaults.
func TestCustomMetricNames(t *testing.T) {
	th := defaultThresholds()
	th.LatencyMetricName = "gateway_latency_ms"
	th.ErrorRateMetricName = "gateway_error_ratio"

	agg := &fakeAggregator{byMetric: map[string]map[string]float64{
		"gateway_latency_ms":  {"p50": 10, "p95": 20, "p99": 30, "count": 5},
		"gateway_error_ratio": {"avg": 0.001, "count": 5},
	}}
	s := newTestService(agg, &fakeHealth{results: healthResults(10, 0)}, th)

	report, err := s.Benchmark(context.Background(), BenchmarkRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if b := findBenchmark(t, report, MetricLatencyP95); b.Skipped {
		t.Fatalf("expected the configured latency metric to be read, got skipped: %s", b.Note)
	}
	if !report.Passed {
		t.Errorf("expected pass, breaches=%v", report.Breaches)
	}
}
