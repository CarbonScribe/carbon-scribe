package analytics

import (
	"context"
	"errors"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// seriesAggregator returns canned aggregation values in call order — one
// per bucket a trend series requests, oldest bucket first — rather than
// performance_test.go's fakeAggregator, which returns one fixed value
// regardless of the requested window. A trend needs a different value per
// bucket to have anything to trend.
type seriesAggregator struct {
	values []float64
	err    error
	// requests records every request for assertions on scoping.
	requests []monitoring.AggregationRequest
}

func (f *seriesAggregator) GetMetricAggregation(_ context.Context, req monitoring.AggregationRequest) (*monitoring.MetricAggregationResult, error) {
	f.requests = append(f.requests, req)
	if f.err != nil {
		return nil, f.err
	}
	i := len(f.requests) - 1
	if i >= len(f.values) {
		return &monitoring.MetricAggregationResult{MetricName: req.MetricName, Aggregations: map[string]float64{"avg": 0}}, nil
	}
	return &monitoring.MetricAggregationResult{
		MetricName:   req.MetricName,
		Aggregations: map[string]float64{"avg": f.values[i]},
	}, nil
}

// seriesHealth returns canned (healthy, total) counts in call order, one per
// requested bucket.
type seriesHealth struct {
	buckets [][2]int // {healthy, total}
	err     error
	calls   int
}

func (f *seriesHealth) GetHealthCheckResultsByTimeRange(_ context.Context, _ string, _, _ time.Time) ([]monitoring.HealthCheckResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	i := f.calls
	f.calls++
	if i >= len(f.buckets) {
		return nil, nil
	}
	healthy, total := f.buckets[i][0], f.buckets[i][1]
	results := make([]monitoring.HealthCheckResult, 0, total)
	for j := range total {
		status := monitoring.HealthCheckStatusUnhealthy
		if j < healthy {
			status = monitoring.HealthCheckStatusHealthy
		}
		results = append(results, monitoring.HealthCheckResult{Status: status})
	}
	return results, nil
}

// newTestTrendsService builds a TrendsService with a pinned clock, matching
// performance_test.go's newTestService convention.
func newTestTrendsService(agg MetricAggregator, health HealthHistoryReader) *TrendsService {
	s := NewTrendsService(agg, health)
	s.now = func() time.Time { return time.Date(2026, 1, 8, 12, 0, 0, 0, time.UTC) }
	return s
}

func TestMetricTrendRequiresService(t *testing.T) {
	s := newTestTrendsService(&seriesAggregator{}, nil)

	_, err := s.MetricTrend(context.Background(), TrendRequest{MetricName: "x"})
	if !errors.Is(err, ErrServiceRequired) {
		t.Fatalf("expected ErrServiceRequired, got %v", err)
	}
}

func TestMetricTrendRequiresMetricName(t *testing.T) {
	s := newTestTrendsService(&seriesAggregator{}, nil)

	_, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api"})
	if !errors.Is(err, ErrMetricNameRequired) {
		t.Fatalf("expected ErrMetricNameRequired, got %v", err)
	}
}

func TestUptimeTrendRequiresService(t *testing.T) {
	s := newTestTrendsService(nil, &seriesHealth{})

	_, err := s.UptimeTrend(context.Background(), TrendRequest{})
	if !errors.Is(err, ErrServiceRequired) {
		t.Fatalf("expected ErrServiceRequired, got %v", err)
	}
}

func TestMetricTrendRejectsUnsupportedGranularity(t *testing.T) {
	s := newTestTrendsService(&seriesAggregator{}, nil)

	_, err := s.MetricTrend(context.Background(), TrendRequest{
		Service: "api", MetricName: "x", Granularity: "monthly",
	})
	if !errors.Is(err, ErrUnsupportedGranularity) {
		t.Fatalf("expected ErrUnsupportedGranularity, got %v", err)
	}
}

func TestMetricTrendRejectsUnsupportedPeriod(t *testing.T) {
	s := newTestTrendsService(&seriesAggregator{}, nil)

	_, err := s.MetricTrend(context.Background(), TrendRequest{
		Service: "api", MetricName: "x", Period: "1y",
	})
	if !errors.Is(err, ErrUnsupportedPeriod) {
		t.Fatalf("expected ErrUnsupportedPeriod, got %v", err)
	}
}

// TestMetricTrendDefaultsGranularityAndPeriod checks the daily/7d defaults
// (acceptance criteria: "at least daily and weekly ... 7d, 30d, 90d").
func TestMetricTrendDefaultsGranularityAndPeriod(t *testing.T) {
	agg := &seriesAggregator{values: []float64{100, 100, 100, 100, 100, 100, 100}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api", MetricName: "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Granularity != GranularityDaily {
		t.Errorf("granularity = %q, want %q", series.Granularity, GranularityDaily)
	}
	if series.Period != Period7d {
		t.Errorf("period = %q, want %q", series.Period, Period7d)
	}
	if len(series.Points) != 7 {
		t.Fatalf("points = %d, want 7 (daily buckets over a 7d period)", len(series.Points))
	}
}

func TestMetricTrendWeeklyGranularityOver30d(t *testing.T) {
	// 30d / 7d-bucket = 4 weekly buckets.
	agg := &seriesAggregator{values: []float64{10, 20, 30, 40}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{
		Service: "api", MetricName: "x", Granularity: GranularityWeekly, Period: Period30d,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(series.Points) != 4 {
		t.Fatalf("points = %d, want 4 (weekly buckets over a 30d period)", len(series.Points))
	}
	for _, req := range agg.requests {
		if got := req.EndTime.Sub(req.StartTime); got != 7*24*time.Hour {
			t.Errorf("bucket width = %v, want 7 days", got)
		}
	}
}

// TestMetricTrendFlat covers the flat scenario: identical values every
// bucket must report TrendFlat throughout, with zero percent change.
func TestMetricTrendFlat(t *testing.T) {
	agg := &seriesAggregator{values: []float64{50, 50, 50, 50, 50, 50, 50}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api", MetricName: "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for i, p := range series.Points {
		if p.Direction != TrendFlat {
			t.Errorf("point %d direction = %q, want %q", i, p.Direction, TrendFlat)
		}
		if i > 0 && p.PercentChange != 0 {
			t.Errorf("point %d percent change = %v, want 0", i, p.PercentChange)
		}
	}
	if series.Summary.Direction != TrendFlat {
		t.Errorf("summary direction = %q, want %q", series.Summary.Direction, TrendFlat)
	}
	if series.Summary.PercentChange != 0 {
		t.Errorf("summary percent change = %v, want 0", series.Summary.PercentChange)
	}
}

// TestMetricTrendImproving covers a steadily increasing series (e.g.
// throughput, correctly-processed records): every later point should report
// TrendUp relative to the one before it, and the summary should show a
// large positive overall change.
func TestMetricTrendImproving(t *testing.T) {
	agg := &seriesAggregator{values: []float64{100, 110, 125, 140, 160, 180, 200}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api", MetricName: "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for i := 1; i < len(series.Points); i++ {
		if series.Points[i].Direction != TrendUp {
			t.Errorf("point %d direction = %q, want %q (value %v after %v)",
				i, series.Points[i].Direction, TrendUp, series.Points[i].Value, series.Points[i-1].Value)
		}
		if series.Points[i].PercentChange <= 0 {
			t.Errorf("point %d percent change = %v, want > 0", i, series.Points[i].PercentChange)
		}
	}

	if series.Summary.Direction != TrendUp {
		t.Errorf("summary direction = %q, want %q", series.Summary.Direction, TrendUp)
	}
	if series.Summary.FirstValue != 100 || series.Summary.LatestValue != 200 {
		t.Errorf("summary first/latest = %v/%v, want 100/200", series.Summary.FirstValue, series.Summary.LatestValue)
	}
	if series.Summary.PercentChange != 100 {
		t.Errorf("summary percent change = %v, want 100 (doubled)", series.Summary.PercentChange)
	}
}

// TestMetricTrendDegrading covers a steadily decreasing series (e.g. latency
// getting worse): every later point should report TrendDown, and the
// summary should show a negative overall change.
func TestMetricTrendDegrading(t *testing.T) {
	agg := &seriesAggregator{values: []float64{200, 180, 160, 140, 125, 110, 100}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api", MetricName: "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for i := 1; i < len(series.Points); i++ {
		if series.Points[i].Direction != TrendDown {
			t.Errorf("point %d direction = %q, want %q", i, series.Points[i].Direction, TrendDown)
		}
		if series.Points[i].PercentChange >= 0 {
			t.Errorf("point %d percent change = %v, want < 0", i, series.Points[i].PercentChange)
		}
	}

	if series.Summary.Direction != TrendDown {
		t.Errorf("summary direction = %q, want %q", series.Summary.Direction, TrendDown)
	}
	if series.Summary.PercentChange != -50 {
		t.Errorf("summary percent change = %v, want -50 (halved)", series.Summary.PercentChange)
	}
}

// TestMetricTrendWithinFlatThresholdIsFlat ensures sub-threshold noise is
// reported as flat, not a spurious up/down.
func TestMetricTrendWithinFlatThresholdIsFlat(t *testing.T) {
	// 0.5% change, below the 1% FlatThreshold.
	agg := &seriesAggregator{values: []float64{100, 100.5}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{
		Service: "api", MetricName: "x", Period: Period7d, Granularity: GranularityWeekly,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Points[1].Direction != TrendFlat {
		t.Errorf("direction = %q, want %q for a 0.5%% change", series.Points[1].Direction, TrendFlat)
	}
}

// TestMetricTrendJustOverFlatThreshold ensures a change just over the
// threshold is correctly classified, not swallowed by the flat band.
func TestMetricTrendJustOverFlatThreshold(t *testing.T) {
	// +2% change, clearly over the 1% FlatThreshold.
	agg := &seriesAggregator{values: []float64{100, 102}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{
		Service: "api", MetricName: "x", Period: Period7d, Granularity: GranularityWeekly,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Points[1].Direction != TrendUp {
		t.Errorf("direction = %q, want %q for a 2%% change", series.Points[1].Direction, TrendUp)
	}
}

func TestMetricTrendFromZeroBaseline(t *testing.T) {
	agg := &seriesAggregator{values: []float64{0, 10}}
	s := newTestTrendsService(agg, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{
		Service: "api", MetricName: "x", Period: Period7d, Granularity: GranularityWeekly,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Points[1].Direction != TrendUp {
		t.Errorf("direction = %q, want %q (0 -> 10)", series.Points[1].Direction, TrendUp)
	}
	if series.Points[1].PercentChange != 0 {
		t.Errorf("percent change from a zero baseline = %v, want 0 (undefined, not reported as a number)", series.Points[1].PercentChange)
	}
}

func TestMetricTrendPropagatesAggregatorError(t *testing.T) {
	boom := errors.New("timescale unavailable")
	s := newTestTrendsService(&seriesAggregator{err: boom}, nil)

	_, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api", MetricName: "x"})
	if !errors.Is(err, boom) {
		t.Fatalf("expected aggregator error to propagate, got %v", err)
	}
}

func TestMetricTrendNilAggregatorReturnsEmptySeries(t *testing.T) {
	s := newTestTrendsService(nil, nil)

	series, err := s.MetricTrend(context.Background(), TrendRequest{Service: "api", MetricName: "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(series.Points) != 0 {
		t.Errorf("points = %d, want 0 for an unconfigured metrics port", len(series.Points))
	}
}

func TestMetricTrendScopesQueriesToServiceAndMetric(t *testing.T) {
	agg := &seriesAggregator{values: []float64{1, 2, 3, 4, 5, 6, 7}}
	s := newTestTrendsService(agg, nil)

	_, err := s.MetricTrend(context.Background(), TrendRequest{Service: "billing", MetricName: "queue_depth"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(agg.requests) != 7 {
		t.Fatalf("expected 7 aggregation requests (one per daily bucket), got %d", len(agg.requests))
	}
	for _, req := range agg.requests {
		if req.Service != "billing" {
			t.Errorf("request not scoped to service: got %q", req.Service)
		}
		if req.MetricName != "queue_depth" {
			t.Errorf("request not scoped to metric: got %q", req.MetricName)
		}
		if got := req.EndTime.Sub(req.StartTime); got != 24*time.Hour {
			t.Errorf("bucket width = %v, want 24h", got)
		}
	}
}

// --- Uptime trend ---

func TestUptimeTrendImproving(t *testing.T) {
	health := &seriesHealth{buckets: [][2]int{
		{50, 100}, {60, 100}, {70, 100}, {80, 100}, {90, 100}, {95, 100}, {100, 100},
	}}
	s := newTestTrendsService(nil, health)

	series, err := s.UptimeTrend(context.Background(), TrendRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if series.MetricName != "" {
		t.Errorf("uptime trend should not set MetricName, got %q", series.MetricName)
	}
	if series.Summary.Direction != TrendUp {
		t.Errorf("summary direction = %q, want %q", series.Summary.Direction, TrendUp)
	}
	if series.Summary.FirstValue != 0.5 || series.Summary.LatestValue != 1.0 {
		t.Errorf("summary first/latest = %v/%v, want 0.5/1.0", series.Summary.FirstValue, series.Summary.LatestValue)
	}
}

func TestUptimeTrendDegrading(t *testing.T) {
	health := &seriesHealth{buckets: [][2]int{
		{100, 100}, {95, 100}, {90, 100}, {80, 100}, {70, 100}, {60, 100}, {50, 100},
	}}
	s := newTestTrendsService(nil, health)

	series, err := s.UptimeTrend(context.Background(), TrendRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Summary.Direction != TrendDown {
		t.Errorf("summary direction = %q, want %q", series.Summary.Direction, TrendDown)
	}
}

func TestUptimeTrendFlat(t *testing.T) {
	health := &seriesHealth{buckets: [][2]int{
		{99, 100}, {99, 100}, {99, 100}, {99, 100}, {99, 100}, {99, 100}, {99, 100},
	}}
	s := newTestTrendsService(nil, health)

	series, err := s.UptimeTrend(context.Background(), TrendRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Summary.Direction != TrendFlat {
		t.Errorf("summary direction = %q, want %q", series.Summary.Direction, TrendFlat)
	}
}

// TestUptimeTrendDegradedCountsAgainstUptime pins the documented policy
// (matching PerformanceService.uptime): a degraded result counts against
// uptime, same as unhealthy.
func TestUptimeTrendDegradedCountsAgainstUptime(t *testing.T) {
	health := &seriesHealthWithStatus{
		results: []monitoring.HealthCheckResult{
			{Status: monitoring.HealthCheckStatusHealthy},
			{Status: monitoring.HealthCheckStatusDegraded},
		},
	}
	s := newTestTrendsService(nil, health)

	series, err := s.UptimeTrend(context.Background(), TrendRequest{
		Service: "api", Period: Period7d, Granularity: GranularityWeekly,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Both buckets see the same fixed result set: 1 healthy of 2 => 0.5.
	for i, p := range series.Points {
		if p.Value != 0.5 {
			t.Errorf("point %d value = %v, want 0.5 (degraded must count against uptime)", i, p.Value)
		}
	}
}

// seriesHealthWithStatus returns the same fixed result set for every bucket,
// for tests that only care about status classification, not a trend shape.
type seriesHealthWithStatus struct {
	results []monitoring.HealthCheckResult
}

func (f *seriesHealthWithStatus) GetHealthCheckResultsByTimeRange(_ context.Context, _ string, _, _ time.Time) ([]monitoring.HealthCheckResult, error) {
	return f.results, nil
}

func TestUptimeTrendPropagatesHealthError(t *testing.T) {
	boom := errors.New("db unavailable")
	s := newTestTrendsService(nil, &seriesHealth{err: boom})

	_, err := s.UptimeTrend(context.Background(), TrendRequest{Service: "api"})
	if !errors.Is(err, boom) {
		t.Fatalf("expected health error to propagate, got %v", err)
	}
}

func TestUptimeTrendNilHealthReturnsEmptySeries(t *testing.T) {
	s := newTestTrendsService(nil, nil)

	series, err := s.UptimeTrend(context.Background(), TrendRequest{Service: "api"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(series.Points) != 0 {
		t.Errorf("points = %d, want 0 for an unconfigured health port", len(series.Points))
	}
}

// --- computeBuckets / percentChange unit coverage ---

func TestComputeBucketsClampsToAtLeastTwo(t *testing.T) {
	end := time.Date(2026, 1, 8, 0, 0, 0, 0, time.UTC)
	// Weekly granularity with a 7d period would naively be 1 bucket; must
	// clamp to 2 so there's always something to compare.
	bounds := computeBuckets(end, 7*24*time.Hour, 7*24*time.Hour)
	if len(bounds) != 2 {
		t.Fatalf("buckets = %d, want 2 (clamped minimum)", len(bounds))
	}
	if !bounds[len(bounds)-1].End.Equal(end) {
		t.Errorf("last bucket end = %v, want %v", bounds[len(bounds)-1].End, end)
	}
	// Buckets must be consecutive and non-overlapping.
	for i := 1; i < len(bounds); i++ {
		if !bounds[i-1].End.Equal(bounds[i].Start) {
			t.Errorf("bucket %d does not start where bucket %d ended", i, i-1)
		}
	}
}

func TestPercentChangeClassifiesDirection(t *testing.T) {
	cases := []struct {
		name      string
		from, to  float64
		wantDir   TrendDirection
		wantPctEq *float64
	}{
		{"up", 100, 150, TrendUp, floatPtr(50)},
		{"down", 100, 50, TrendDown, floatPtr(-50)},
		{"flat exact", 100, 100, TrendFlat, floatPtr(0)},
		{"flat within threshold", 100, 100.5, TrendFlat, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			pct, dir := percentChange(tc.from, tc.to)
			if dir != tc.wantDir {
				t.Errorf("direction = %q, want %q", dir, tc.wantDir)
			}
			if tc.wantPctEq != nil && pct != *tc.wantPctEq {
				t.Errorf("percent change = %v, want %v", pct, *tc.wantPctEq)
			}
		})
	}
}

func floatPtr(f float64) *float64 { return &f }
