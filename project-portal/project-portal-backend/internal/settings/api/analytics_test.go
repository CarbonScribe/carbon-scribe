package api

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestKeyUsageTrackerMinuteLimit(t *testing.T) {
	tracker := NewKeyUsageTracker()
	keyID := uuid.New()
	now := time.Date(2026, 2, 24, 12, 0, 0, 0, time.UTC)

	first := tracker.Allow(now, keyID, 1, 10)
	if !first.Allowed {
		t.Fatalf("expected first request allowed")
	}

	second := tracker.Allow(now.Add(10*time.Second), keyID, 1, 10)
	if second.Allowed {
		t.Fatalf("expected second request to be rate limited")
	}
	if second.RetryAfterSec <= 0 {
		t.Fatalf("expected retry_after > 0")
	}
}

func TestKeyUsageTrackerDayReset(t *testing.T) {
	tracker := NewKeyUsageTracker()
	keyID := uuid.New()
	now := time.Date(2026, 2, 24, 23, 59, 0, 0, time.UTC)

	if !tracker.Allow(now, keyID, 10, 1).Allowed {
		t.Fatalf("expected first request allowed")
	}
	afterMidnight := tracker.Allow(now.Add(2*time.Minute), keyID, 10, 1)
	if !afterMidnight.Allowed {
		t.Fatalf("expected day window reset after midnight")
	}
}
