package dashboard

import (
	"strings"
	"sync"
	"time"
)

// AggregateCache provides in-memory caching for aggregates
type AggregateCache struct {
	data    map[string]*cacheEntry
	ttl     time.Duration
	mu      sync.RWMutex
	cleanup *time.Ticker
	done    chan struct{}
}

// cacheEntry represents a cache entry with expiration
type cacheEntry struct {
	value      interface{}
	expiration time.Time
}

// NewAggregateCache creates a new aggregate cache
func NewAggregateCache(ttl time.Duration) *AggregateCache {
	cache := &AggregateCache{
		data:    make(map[string]*cacheEntry),
		ttl:     ttl,
		cleanup: time.NewTicker(time.Minute),
		done:    make(chan struct{}),
	}

	// Start cleanup goroutine
	go cache.cleanupLoop()

	return cache
}

// Get retrieves a value from the cache
func (c *AggregateCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.data[key]
	if !ok {
		return nil, false
	}

	if time.Now().After(entry.expiration) {
		return nil, false
	}

	return entry.value, true
}

// Set stores a value in the cache
func (c *AggregateCache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data[key] = &cacheEntry{
		value:      value,
		expiration: time.Now().Add(c.ttl),
	}
}

// SetWithTTL stores a value in the cache with a custom TTL
func (c *AggregateCache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data[key] = &cacheEntry{
		value:      value,
		expiration: time.Now().Add(ttl),
	}
}

// Delete removes a value from the cache
func (c *AggregateCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.data, key)
}

// DeleteByPrefix removes all entries with keys starting with the given prefix
func (c *AggregateCache) DeleteByPrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for key := range c.data {
		if strings.HasPrefix(key, prefix) {
			delete(c.data, key)
		}
	}
}

// Clear removes all entries from the cache
func (c *AggregateCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data = make(map[string]*cacheEntry)
}

// Size returns the number of entries in the cache
func (c *AggregateCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.data)
}

// Keys returns all keys in the cache
func (c *AggregateCache) Keys() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	keys := make([]string, 0, len(c.data))
	for key := range c.data {
		keys = append(keys, key)
	}
	return keys
}

// cleanupLoop periodically removes expired entries
func (c *AggregateCache) cleanupLoop() {
	for {
		select {
		case <-c.cleanup.C:
			c.removeExpired()
		case <-c.done:
			return
		}
	}
}

// removeExpired removes expired entries
func (c *AggregateCache) removeExpired() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	for key, entry := range c.data {
		if now.After(entry.expiration) {
			delete(c.data, key)
		}
	}
}

// Stop stops the cleanup goroutine
func (c *AggregateCache) Stop() {
	c.cleanup.Stop()
	close(c.done)
}

// GetOrSet retrieves a value from the cache, or computes and stores it if not present
func (c *AggregateCache) GetOrSet(key string, compute func() (interface{}, error)) (interface{}, error) {
	// Try to get from cache first
	if value, ok := c.Get(key); ok {
		return value, nil
	}

	// Compute the value
	value, err := compute()
	if err != nil {
		return nil, err
	}

	// Store in cache
	c.Set(key, value)

	return value, nil
}

// Stats returns cache statistics
type CacheStats struct {
	Size        int       `json:"size"`
	Hits        int64     `json:"hits"`
	Misses      int64     `json:"misses"`
	HitRate     float64   `json:"hit_rate"`
	LastCleanup time.Time `json:"last_cleanup"`
}

// StatsCache wraps AggregateCache with statistics
type StatsCache struct {
	*AggregateCache
	hits        int64
	misses      int64
	lastCleanup time.Time
	statsMu     sync.RWMutex
}

// NewStatsCache creates a cache with statistics tracking
func NewStatsCache(ttl time.Duration) *StatsCache {
	return &StatsCache{
		AggregateCache: NewAggregateCache(ttl),
		lastCleanup:    time.Now(),
	}
}

// Get retrieves a value and tracks statistics
func (c *StatsCache) Get(key string) (interface{}, bool) {
	value, ok := c.AggregateCache.Get(key)

	c.statsMu.Lock()
	if ok {
		c.hits++
	} else {
		c.misses++
	}
	c.statsMu.Unlock()

	return value, ok
}

// GetStats returns cache statistics
func (c *StatsCache) GetStats() CacheStats {
	c.statsMu.RLock()
	defer c.statsMu.RUnlock()

	total := c.hits + c.misses
	hitRate := 0.0
	if total > 0 {
		hitRate = float64(c.hits) / float64(total)
	}

	return CacheStats{
		Size:        c.Size(),
		Hits:        c.hits,
		Misses:      c.misses,
		HitRate:     hitRate,
		LastCleanup: c.lastCleanup,
	}
}

// ResetStats resets the statistics
func (c *StatsCache) ResetStats() {
	c.statsMu.Lock()
	defer c.statsMu.Unlock()

	c.hits = 0
	c.misses = 0
}
