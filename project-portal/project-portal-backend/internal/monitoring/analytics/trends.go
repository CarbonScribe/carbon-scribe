// TrendsService computes historical trend series — percentage change
// bucket-over-bucket — from stored monitoring data (issue #687). It mirrors
// PerformanceService's two data sources: a named SystemMetric aggregated
// per bucket (MetricTrend), or observed uptime derived from
// HealthCheckResult history (UptimeTrend), since SystemMetric alone can't
// express "was the service actually up" the way a health check can.
package analytics

import (
	"context"
	"errors"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// Granularity is the bucket size a trend series is computed over.
type Granularity string

const (
	GranularityDaily  Granularity = "daily"
	GranularityWeekly Granularity = "weekly"
)

// ErrUnsupportedGranularity is returned for any Granularity value other than
// the ones declared above.
var ErrUnsupportedGranularity = errors.New("analytics: unsupported granularity")

func (g Granularity) duration() (time.Duration, error) {
	switch g {
	case GranularityDaily:
		return 24 * time.Hour, nil
	case GranularityWeekly:
		return 7 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("%w: %q", ErrUnsupportedGranularity, g)
	}
}

// Period is the total look-back window a trend series spans, matching the
// 7d/30d/90d convention already used elsewhere in monitoring (see
// internal/health's UptimeResponse.Uptime7d/Uptime30d).
type Period string

const (
	Period7d  Period = "7d"
	Period30d Period = "30d"
	Period90d Period = "90d"
)

// ErrUnsupportedPeriod is returned for any Period value other than the ones
// declared above.
var ErrUnsupportedPeriod = errors.New("analytics: unsupported period")

func (p Period) duration() (time.Duration, error) {
	switch p {
	case Period7d:
		return 7 * 24 * time.Hour, nil
	case Period30d:
		return 30 * 24 * time.Hour, nil
	case Period90d:
		return 90 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("%w: %q", ErrUnsupportedPeriod, p)
	}
}

// TrendDirection classifies a percentage change.
type TrendDirection string

const (
	TrendUp   TrendDirection = "up"
	TrendDown TrendDirection = "down"
	TrendFlat TrendDirection = "flat"
)

// FlatThreshold is the minimum magnitude of change (as a fraction, e.g. 0.01
// = 1%) for a trend to be classified up/down rather than flat. Without this,
// noise-level fluctuation between two buckets (e.g. 100.00 -> 100.01) would
// be reported as a meaningful "up" trend.
const FlatThreshold = 0.01

// TrendPoint is one bucket's value in a trend series, plus its percentage
// change and direction relative to the immediately preceding point. The
// first point in a series has no predecessor: its PercentChange is always 0
// and its Direction is always TrendFlat.
type TrendPoint struct {
	BucketStart   time.Time      `json:"bucket_start"`
	BucketEnd     time.Time      `json:"bucket_end"`
	Value         float64        `json:"value"`
	PercentChange float64        `json:"percent_change"`
	Direction     TrendDirection `json:"direction"`
}

// TrendSummary compares the first and most recent points in a series — the
// single headline figure a dashboard card would show, as opposed to the
// point-to-point deltas in Points.
type TrendSummary struct {
	FirstValue    float64        `json:"first_value"`
	LatestValue   float64        `json:"latest_value"`
	PercentChange float64        `json:"percent_change"`
	Direction     TrendDirection `json:"direction"`
}

// TrendSeries is the computed trend report returned to an HTTP handler.
type TrendSeries struct {
	Service string `json:"service"`
	// MetricName is empty for an UptimeTrend result — uptime isn't a named
	// stored metric, it's derived from health-check history.
	MetricName  string       `json:"metric_name,omitempty"`
	Granularity Granularity  `json:"granularity"`
	Period      Period       `json:"period"`
	GeneratedAt time.Time    `json:"generated_at"`
	Points      []TrendPoint `json:"points"`
	Summary     TrendSummary `json:"summary"`
}

// TrendRequest selects the service, data source, and window for a trend
// series.
type TrendRequest struct {
	// Service scopes the query, same reasoning as BenchmarkRequest: an empty
	// service would blend every service's data into one meaningless series.
	Service string
	// MetricName selects the stored SystemMetric to trend. Required for
	// MetricTrend; ignored by UptimeTrend.
	MetricName string
	// Granularity is the bucket size. Defaults to GranularityDaily.
	Granularity Granularity
	// Period is the total look-back window. Defaults to Period7d.
	Period Period
	// End is the series' end time. Defaults to now.
	End time.Time
}

// ErrMetricNameRequired is returned by MetricTrend when no metric name is
// supplied — ErrServiceRequired (defined in performance.go) covers the
// missing-service case shared by both trend methods.
var ErrMetricNameRequired = errors.New("analytics: metric name is required")

// TrendsService computes historical trend series from stored monitoring
// data (issue #687).
type TrendsService struct {
	metrics MetricAggregator
	health  HealthHistoryReader
	// now is injectable so tests can pin the series' end time.
	now func() time.Time
}

// NewTrendsService constructs a TrendsService. Either port may be nil: the
// trend it would supply is returned as an empty series rather than
// panicking, so a partially wired deployment degrades instead of crashing —
// the same policy PerformanceService uses for a nil port.
func NewTrendsService(metrics MetricAggregator, health HealthHistoryReader) *TrendsService {
	return &TrendsService{metrics: metrics, health: health, now: time.Now}
}

// resolve applies defaults and validates the requested granularity/period,
// returning the concrete bucket size, total look-back duration, and series
// end time to compute over.
func (s *TrendsService) resolve(req TrendRequest) (granularity Granularity, period Period, bucketSize, totalWindow time.Duration, end time.Time, err error) {
	granularity = req.Granularity
	if granularity == "" {
		granularity = GranularityDaily
	}
	bucketSize, err = granularity.duration()
	if err != nil {
		return "", "", 0, 0, time.Time{}, err
	}

	period = req.Period
	if period == "" {
		period = Period7d
	}
	totalWindow, err = period.duration()
	if err != nil {
		return "", "", 0, 0, time.Time{}, err
	}

	end = req.End
	if end.IsZero() {
		end = s.now().UTC()
	}
	return granularity, period, bucketSize, totalWindow, end, nil
}

// bucketBounds is the [Start,End) range of one bucket in a trend series.
type bucketBounds struct {
	Start, End time.Time
}

// computeBuckets returns a series of consecutive, non-overlapping buckets
// of bucketSize, oldest first, covering totalWindow ending at end.
//
// Always returns at least 2 buckets — a trend is a comparison, and one
// bucket alone has nothing to compare against — even when totalWindow is
// shorter than 2*bucketSize (a weekly granularity requested with a 7d
// period, say). In that case the actual look-back span, 2*bucketSize,
// exceeds the nominal Period; this is a deliberate safety clamp to keep
// every (granularity, period) combination computable rather than rejecting
// the ones that are too short.
func computeBuckets(end time.Time, bucketSize, totalWindow time.Duration) []bucketBounds {
	n := max(int(totalWindow/bucketSize), 2)

	buckets := make([]bucketBounds, n)
	cursor := end
	for i := n - 1; i >= 0; i-- {
		start := cursor.Add(-bucketSize)
		buckets[i] = bucketBounds{Start: start, End: cursor}
		cursor = start
	}
	return buckets
}

// buildSeries turns parallel bucket bounds and values into the point series
// plus the first-vs-latest summary.
func buildSeries(bounds []bucketBounds, values []float64) ([]TrendPoint, TrendSummary) {
	points := make([]TrendPoint, len(bounds))
	for i, b := range bounds {
		p := TrendPoint{BucketStart: b.Start, BucketEnd: b.End, Value: values[i]}
		if i > 0 {
			p.PercentChange, p.Direction = percentChange(values[i-1], values[i])
		} else {
			p.Direction = TrendFlat
		}
		points[i] = p
	}

	var summary TrendSummary
	if len(values) > 0 {
		summary.FirstValue = values[0]
		summary.LatestValue = values[len(values)-1]
		summary.PercentChange, summary.Direction = percentChange(summary.FirstValue, summary.LatestValue)
	}
	return points, summary
}

// percentChange returns the percentage change from `from` to `to` (10.0
// means a 10% increase) and its classified direction.
//
// A `from` of exactly 0 is handled as a special case rather than dividing by
// it: "percent change from zero" is mathematically undefined, not merely
// large, so PercentChange is reported as 0 while Direction still reflects
// whether `to` moved away from zero and in which direction.
func percentChange(from, to float64) (float64, TrendDirection) {
	if from == 0 {
		switch {
		case to > 0:
			return 0, TrendUp
		case to < 0:
			return 0, TrendDown
		default:
			return 0, TrendFlat
		}
	}

	change := (to - from) / from
	direction := TrendFlat
	switch {
	case change > FlatThreshold:
		direction = TrendUp
	case change < -FlatThreshold:
		direction = TrendDown
	}
	return change * 100, direction
}

// MetricTrend computes a trend series for a named stored SystemMetric,
// bucketed at the requested granularity over the requested period.
func (s *TrendsService) MetricTrend(ctx context.Context, req TrendRequest) (*TrendSeries, error) {
	if req.Service == "" {
		return nil, ErrServiceRequired
	}
	if req.MetricName == "" {
		return nil, ErrMetricNameRequired
	}

	granularity, period, bucketSize, totalWindow, end, err := s.resolve(req)
	if err != nil {
		return nil, err
	}

	series := &TrendSeries{
		Service:     req.Service,
		MetricName:  req.MetricName,
		Granularity: granularity,
		Period:      period,
		GeneratedAt: s.now().UTC(),
	}

	if s.metrics == nil {
		return series, nil
	}

	bounds := computeBuckets(end, bucketSize, totalWindow)
	values := make([]float64, len(bounds))
	for i, b := range bounds {
		res, err := s.metrics.GetMetricAggregation(ctx, monitoring.AggregationRequest{
			MetricName:   req.MetricName,
			Service:      req.Service,
			StartTime:    b.Start,
			EndTime:      b.End,
			Aggregations: []string{"avg"},
		})
		if err != nil {
			return nil, fmt.Errorf("aggregate metric %q for bucket [%s,%s): %w", req.MetricName, b.Start, b.End, err)
		}
		if res != nil {
			values[i] = res.Aggregations["avg"]
		}
	}

	series.Points, series.Summary = buildSeries(bounds, values)
	return series, nil
}

// UptimeTrend computes a trend series for observed uptime — the fraction of
// health checks that reported healthy per bucket — derived from
// HealthCheckResult history. Degraded results count against uptime, the
// same policy PerformanceService.uptime uses: a degraded service is not
// meeting its availability target.
func (s *TrendsService) UptimeTrend(ctx context.Context, req TrendRequest) (*TrendSeries, error) {
	if req.Service == "" {
		return nil, ErrServiceRequired
	}

	granularity, period, bucketSize, totalWindow, end, err := s.resolve(req)
	if err != nil {
		return nil, err
	}

	series := &TrendSeries{
		Service:     req.Service,
		Granularity: granularity,
		Period:      period,
		GeneratedAt: s.now().UTC(),
	}

	if s.health == nil {
		return series, nil
	}

	bounds := computeBuckets(end, bucketSize, totalWindow)
	values := make([]float64, len(bounds))
	for i, b := range bounds {
		results, err := s.health.GetHealthCheckResultsByTimeRange(ctx, req.Service, b.Start, b.End)
		if err != nil {
			return nil, fmt.Errorf("read health check results for %q bucket [%s,%s): %w", req.Service, b.Start, b.End, err)
		}
		if len(results) == 0 {
			continue
		}
		healthy := 0
		for _, r := range results {
			if r.Status == monitoring.HealthCheckStatusHealthy {
				healthy++
			}
		}
		values[i] = float64(healthy) / float64(len(results))
	}

	series.Points, series.Summary = buildSeries(bounds, values)
	return series, nil
}
