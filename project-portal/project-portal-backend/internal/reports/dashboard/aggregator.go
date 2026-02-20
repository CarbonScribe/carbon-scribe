package dashboard

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Aggregator handles dashboard data aggregation
type Aggregator struct {
	cache      *Cache
	repository DataRepository
	mu         sync.RWMutex
}

// DataRepository defines the interface for fetching raw data
type DataRepository interface {
	GetProjectCount(ctx context.Context, userID *uuid.UUID) (int, error)
	GetTotalCredits(ctx context.Context, userID *uuid.UUID) (float64, error)
	GetTotalRevenue(ctx context.Context, userID *uuid.UUID) (float64, error)
	GetActiveMonitoringAreas(ctx context.Context, userID *uuid.UUID) (int, error)
	GetRecentActivity(ctx context.Context, userID *uuid.UUID, limit int) ([]ActivityItem, error)
	GetMetricValue(ctx context.Context, metric string, period string) (MetricData, error)
	GetTimeSeriesData(ctx context.Context, metric string, start, end time.Time, interval string) ([]TimeSeriesPoint, error)
}

// MetricData holds aggregated metric information
type MetricData struct {
	CurrentValue  float64
	PreviousValue float64
	Period        string
}

// TimeSeriesPoint represents a data point in time series
type TimeSeriesPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
	Label string    `json:"label,omitempty"`
}

// ActivityItem represents a recent activity
type ActivityItem struct {
	ID          uuid.UUID `json:"id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	UserID      uuid.UUID `json:"user_id,omitempty"`
	EntityID    uuid.UUID `json:"entity_id,omitempty"`
	EntityType  string    `json:"entity_type,omitempty"`
}

// DashboardSummary represents aggregated dashboard data
type DashboardSummary struct {
	TotalProjects         int                          `json:"total_projects"`
	TotalCredits          float64                      `json:"total_credits"`
	TotalRevenue          float64                      `json:"total_revenue"`
	ActiveMonitoringAreas int                          `json:"active_monitoring_areas"`
	RecentActivity        []ActivityItem               `json:"recent_activity"`
	PerformanceMetrics    map[string]MetricSummary     `json:"performance_metrics"`
	TimeSeriesData        map[string][]TimeSeriesPoint `json:"time_series_data,omitempty"`
	CachedAt              time.Time                    `json:"cached_at"`
}

// MetricSummary represents a summary metric
type MetricSummary struct {
	Value         float64 `json:"value"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"change_percent"`
	Period        string  `json:"period"`
	Trend         string  `json:"trend"` // up, down, stable
}

// NewAggregator creates a new dashboard aggregator
func NewAggregator(repository DataRepository, cacheConfig CacheConfig) *Aggregator {
	return &Aggregator{
		cache:      NewCache(cacheConfig),
		repository: repository,
	}
}

// GetSummary returns aggregated dashboard summary
func (a *Aggregator) GetSummary(ctx context.Context, userID *uuid.UUID) (*DashboardSummary, error) {
	cacheKey := "dashboard_summary"
	if userID != nil {
		cacheKey = "dashboard_summary_" + userID.String()
	}

	// Try cache first
	if cached, found := a.cache.Get(cacheKey); found {
		if summary, ok := cached.(*DashboardSummary); ok {
			return summary, nil
		}
	}

	// Build summary from repository
	summary, err := a.buildSummary(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Cache the result
	a.cache.Set(cacheKey, summary, 5*time.Minute)

	return summary, nil
}

func (a *Aggregator) buildSummary(ctx context.Context, userID *uuid.UUID) (*DashboardSummary, error) {
	summary := &DashboardSummary{
		PerformanceMetrics: make(map[string]MetricSummary),
		TimeSeriesData:     make(map[string][]TimeSeriesPoint),
		CachedAt:           time.Now(),
	}

	// Fetch all metrics concurrently
	var wg sync.WaitGroup
	var mu sync.Mutex
	errChan := make(chan error, 10)

	// Project count
	wg.Add(1)
	go func() {
		defer wg.Done()
		if count, err := a.repository.GetProjectCount(ctx, userID); err != nil {
			errChan <- err
		} else {
			mu.Lock()
			summary.TotalProjects = count
			mu.Unlock()
		}
	}()

	// Total credits
	wg.Add(1)
	go func() {
		defer wg.Done()
		if credits, err := a.repository.GetTotalCredits(ctx, userID); err != nil {
			errChan <- err
		} else {
			mu.Lock()
			summary.TotalCredits = credits
			mu.Unlock()
		}
	}()

	// Total revenue
	wg.Add(1)
	go func() {
		defer wg.Done()
		if revenue, err := a.repository.GetTotalRevenue(ctx, userID); err != nil {
			errChan <- err
		} else {
			mu.Lock()
			summary.TotalRevenue = revenue
			mu.Unlock()
		}
	}()

	// Active monitoring areas
	wg.Add(1)
	go func() {
		defer wg.Done()
		if areas, err := a.repository.GetActiveMonitoringAreas(ctx, userID); err != nil {
			errChan <- err
		} else {
			mu.Lock()
			summary.ActiveMonitoringAreas = areas
			mu.Unlock()
		}
	}()

	// Recent activity
	wg.Add(1)
	go func() {
		defer wg.Done()
		if activity, err := a.repository.GetRecentActivity(ctx, userID, 10); err != nil {
			errChan <- err
		} else {
			mu.Lock()
			summary.RecentActivity = activity
			mu.Unlock()
		}
	}()

	// Performance metrics
	metrics := []string{"credits_issued", "revenue", "verification_rate", "monitoring_coverage"}
	for _, metric := range metrics {
		metric := metric
		wg.Add(1)
		go func() {
			defer wg.Done()
			if data, err := a.repository.GetMetricValue(ctx, metric, "30d"); err == nil {
				metricSummary := MetricSummary{
					Value:  data.CurrentValue,
					Period: data.Period,
				}

				if data.PreviousValue > 0 {
					metricSummary.Change = data.CurrentValue - data.PreviousValue
					metricSummary.ChangePercent = (metricSummary.Change / data.PreviousValue) * 100

					if metricSummary.ChangePercent > 5 {
						metricSummary.Trend = "up"
					} else if metricSummary.ChangePercent < -5 {
						metricSummary.Trend = "down"
					} else {
						metricSummary.Trend = "stable"
					}
				}

				mu.Lock()
				summary.PerformanceMetrics[metric] = metricSummary
				mu.Unlock()
			}
		}()
	}

	wg.Wait()
	close(errChan)

	// Check for errors (non-fatal, we return partial data)
	for err := range errChan {
		if err != nil {
			// Log error but continue
			_ = err
		}
	}

	return summary, nil
}

// GetTimeSeries returns time series data for a metric
func (a *Aggregator) GetTimeSeries(ctx context.Context, metric string, start, end time.Time, interval string) ([]TimeSeriesPoint, error) {
	cacheKey := "timeseries_" + metric + "_" + interval + "_" + start.Format("20060102") + "_" + end.Format("20060102")

	if cached, found := a.cache.Get(cacheKey); found {
		if data, ok := cached.([]TimeSeriesPoint); ok {
			return data, nil
		}
	}

	data, err := a.repository.GetTimeSeriesData(ctx, metric, start, end, interval)
	if err != nil {
		return nil, err
	}

	// Cache for shorter duration for recent data
	cacheDuration := 1 * time.Hour
	if end.After(time.Now().Add(-24 * time.Hour)) {
		cacheDuration = 5 * time.Minute
	}
	a.cache.Set(cacheKey, data, cacheDuration)

	return data, nil
}

// RefreshCache refreshes all cached dashboard data
func (a *Aggregator) RefreshCache(ctx context.Context) error {
	// Clear existing cache
	a.cache.Clear()

	// Pre-populate with fresh data
	_, err := a.GetSummary(ctx, nil)
	return err
}

// InvalidateUserCache invalidates cache for a specific user
func (a *Aggregator) InvalidateUserCache(userID uuid.UUID) {
	a.cache.Delete("dashboard_summary_" + userID.String())
}

// Cache implements a simple in-memory cache
type Cache struct {
	items  map[string]cacheItem
	mu     sync.RWMutex
	config CacheConfig
}

type cacheItem struct {
	value      interface{}
	expiration time.Time
}

// CacheConfig holds cache configuration
type CacheConfig struct {
	DefaultTTL      time.Duration
	CleanupInterval time.Duration
	MaxItems        int
}

// DefaultCacheConfig returns default cache configuration
func DefaultCacheConfig() CacheConfig {
	return CacheConfig{
		DefaultTTL:      5 * time.Minute,
		CleanupInterval: 10 * time.Minute,
		MaxItems:        1000,
	}
}

// NewCache creates a new cache instance
func NewCache(config CacheConfig) *Cache {
	c := &Cache{
		items:  make(map[string]cacheItem),
		config: config,
	}

	// Start cleanup goroutine
	go c.cleanup()

	return c
}

// Get retrieves an item from cache
func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, found := c.items[key]
	if !found {
		return nil, false
	}

	if time.Now().After(item.expiration) {
		return nil, false
	}

	return item.value, true
}

// Set stores an item in cache
func (c *Cache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if ttl == 0 {
		ttl = c.config.DefaultTTL
	}

	c.items[key] = cacheItem{
		value:      value,
		expiration: time.Now().Add(ttl),
	}
}

// Delete removes an item from cache
func (c *Cache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

// Clear removes all items from cache
func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]cacheItem)
}

func (c *Cache) cleanup() {
	ticker := time.NewTicker(c.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for key, item := range c.items {
			if now.After(item.expiration) {
				delete(c.items, key)
			}
		}
		c.mu.Unlock()
	}
}

// AggregationPipeline defines a data aggregation pipeline
type AggregationPipeline struct {
	stages []AggregationStage
}

// AggregationStage represents a stage in the pipeline
type AggregationStage interface {
	Process(ctx context.Context, data interface{}) (interface{}, error)
}

// NewAggregationPipeline creates a new aggregation pipeline
func NewAggregationPipeline() *AggregationPipeline {
	return &AggregationPipeline{
		stages: make([]AggregationStage, 0),
	}
}

// AddStage adds a stage to the pipeline
func (p *AggregationPipeline) AddStage(stage AggregationStage) *AggregationPipeline {
	p.stages = append(p.stages, stage)
	return p
}

// Execute runs all stages in sequence
func (p *AggregationPipeline) Execute(ctx context.Context, input interface{}) (interface{}, error) {
	result := input

	for _, stage := range p.stages {
		var err error
		result, err = stage.Process(ctx, result)
		if err != nil {
			return nil, err
		}
	}

	return result, nil
}

// GroupByStage groups data by a field
type GroupByStage struct {
	Field     string
	Aggregate func([]interface{}) interface{}
}

func (s *GroupByStage) Process(ctx context.Context, data interface{}) (interface{}, error) {
	// Implementation would group data by the specified field
	return data, nil
}

// FilterStage filters data based on a predicate
type FilterStage struct {
	Predicate func(interface{}) bool
}

func (s *FilterStage) Process(ctx context.Context, data interface{}) (interface{}, error) {
	// Implementation would filter data
	return data, nil
}

// SortStage sorts data by a field
type SortStage struct {
	Field     string
	Ascending bool
}

func (s *SortStage) Process(ctx context.Context, data interface{}) (interface{}, error) {
	// Implementation would sort data
	return data, nil
}
