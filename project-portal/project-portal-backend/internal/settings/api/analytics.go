package api

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type UsageSummary struct {
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
}

type RateLimitDecision struct {
	Allowed       bool
	RetryAfterSec int
	MinuteCount   int
	DayCount      int
}

type KeyUsageTracker struct {
	mu     sync.Mutex
	states map[uuid.UUID]*usageState
}

type usageState struct {
	MinuteWindowStart time.Time
	DayWindowStart    time.Time
	MinuteCount       int
	DayCount          int
}

func NewKeyUsageTracker() *KeyUsageTracker {
	return &KeyUsageTracker{
		states: map[uuid.UUID]*usageState{},
	}
}

func (t *KeyUsageTracker) Allow(now time.Time, keyID uuid.UUID, perMinute, perDay int) RateLimitDecision {
	t.mu.Lock()
	defer t.mu.Unlock()

	if perMinute <= 0 {
		perMinute = 60
	}
	if perDay <= 0 {
		perDay = 1000
	}
	state := t.states[keyID]
	if state == nil {
		state = &usageState{
			MinuteWindowStart: now.UTC(),
			DayWindowStart:    startOfDayUTC(now.UTC()),
		}
		t.states[keyID] = state
	}

	now = now.UTC()
	if now.Sub(state.MinuteWindowStart) >= time.Minute {
		state.MinuteWindowStart = now
		state.MinuteCount = 0
	}
	if !sameUTCDay(state.DayWindowStart, now) {
		state.DayWindowStart = startOfDayUTC(now)
		state.DayCount = 0
	}

	if state.MinuteCount >= perMinute {
		retry := int(time.Until(state.MinuteWindowStart.Add(time.Minute)).Seconds())
		if retry < 1 {
			retry = 1
		}
		return RateLimitDecision{
			Allowed:       false,
			RetryAfterSec: retry,
			MinuteCount:   state.MinuteCount,
			DayCount:      state.DayCount,
		}
	}
	if state.DayCount >= perDay {
		retry := int(time.Until(startOfDayUTC(now).Add(24 * time.Hour)).Seconds())
		if retry < 1 {
			retry = 1
		}
		return RateLimitDecision{
			Allowed:       false,
			RetryAfterSec: retry,
			MinuteCount:   state.MinuteCount,
			DayCount:      state.DayCount,
		}
	}

	state.MinuteCount++
	state.DayCount++
	return RateLimitDecision{
		Allowed:     true,
		MinuteCount: state.MinuteCount,
		DayCount:    state.DayCount,
	}
}

func (t *KeyUsageTracker) Snapshot(keyID uuid.UUID) (minuteCount, dayCount int, ok bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	s, ok := t.states[keyID]
	if !ok {
		return 0, 0, false
	}
	return s.MinuteCount, s.DayCount, true
}

func (d RateLimitDecision) Error() error {
	if d.Allowed {
		return nil
	}
	return fmt.Errorf("rate limit exceeded")
}

func startOfDayUTC(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func sameUTCDay(a, b time.Time) bool {
	a = a.UTC()
	b = b.UTC()
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}
