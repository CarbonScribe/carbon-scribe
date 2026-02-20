package analytics

import (
	"context"
	"log"
	"time"
)

// Tracker tracks search analytics
type Tracker interface {
	TrackSearch(ctx context.Context, query string, resultsCount int64, took int64)
}

// LogTracker logs search queries to stdout/logger
type LogTracker struct{}

// NewLogTracker creates a new log tracker
func NewLogTracker() *LogTracker {
	return &LogTracker{}
}

// TrackSearch logs the search event
func (t *LogTracker) TrackSearch(ctx context.Context, query string, resultsCount int64, took int64) {
	event := map[string]interface{}{
		"event":     "search",
		"query":     query,
		"hits":      resultsCount,
		"took_ms":   took,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	// logging for observability
	log.Printf("SEARCH_ANALYTICS: %v", event)
}
