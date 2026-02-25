package maps

import "time"

type TileCacheEntry struct {
	Key         string
	ContentType string
	Data        []byte
	ExpiresAt   time.Time
}
