package monitoring

import (
	"sync"
	"time"
)

// TileCache provides a simple thread-safe TTL cache for map tiles.
type TileCache struct {
	mu    sync.RWMutex
	items map[string]tileCacheItem
	ttl   time.Duration
}

type tileCacheItem struct {
	Data      []byte
	ExpiresAt time.Time
}

// NewTileCache creates a new TileCache with the specified TTL.
func NewTileCache(ttl time.Duration) *TileCache {
	return &TileCache{
		items: make(map[string]tileCacheItem),
		ttl:   ttl,
	}
}

// Get retrieves a tile from the cache. Returns false if not found or expired.
func (c *TileCache) Get(key string) ([]byte, bool) {
	c.mu.RLock()
	item, found := c.items[key]
	c.mu.RUnlock()

	if !found {
		return nil, false
	}
	if time.Now().After(item.ExpiresAt) {
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
		return nil, false
	}
	return item.Data, true
}

// Set stores a tile in the cache with the configured TTL.
func (c *TileCache) Set(key string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = tileCacheItem{
		Data:      data,
		ExpiresAt: time.Now().Add(c.ttl),
	}
}
