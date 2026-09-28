package minting

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
)

// noJitter is a deterministic randFloat returning 0, which makes BackoffFor
// return the full (un-jittered) delay.
func noJitter() float64 { return 0 }

// maxJitter returns the largest value the contract admits, exercising the
// lower bound of the jitter window.
func maxJitter() float64 { return 0.9999999 }

func testPolicy() RetryPolicy {
	return RetryPolicy{
		MaxAttempts:  5,
		BaseBackoff:  time.Second,
		MaxBackoff:   time.Minute,
		JitterFactor: 0.2,
	}
}

// ---------------------------------------------------------------------------
// Backoff growth
// ---------------------------------------------------------------------------

// TestBackoffGrowsExponentially is the core regression against the previous
// linear "attempt * 2s" ramp: each attempt must double, not step.
func TestBackoffGrowsExponentially(t *testing.T) {
	p := testPolicy()

	want := []time.Duration{
		1 * time.Second, // attempt 1 -> base * 2^0
		2 * time.Second, // attempt 2 -> base * 2^1
		4 * time.Second, // attempt 3 -> base * 2^2
		8 * time.Second, // attempt 4 -> base * 2^3
		16 * time.Second,
	}

	for i, expected := range want {
		attempt := i + 1
		got := p.BackoffFor(attempt, noJitter)
		if got != expected {
			t.Errorf("BackoffFor(%d) = %s, want %s", attempt, got, expected)
		}
	}
}

// TestBackoffIsNotLinear guards specifically against a regression to the old
// behaviour, where delays were 2s, 4s, 6s.
func TestBackoffIsNotLinear(t *testing.T) {
	p := RetryPolicy{MaxAttempts: 3, BaseBackoff: 2 * time.Second, MaxBackoff: time.Minute}

	third := p.BackoffFor(3, noJitter)
	if third == 6*time.Second {
		t.Fatalf("third delay = %s, which is the old linear ramp; expected exponential growth", third)
	}
	if third != 8*time.Second {
		t.Errorf("BackoffFor(3) = %s, want 8s (2s * 2^2)", third)
	}
}

func TestBackoffIsCappedAtMax(t *testing.T) {
	p := RetryPolicy{
		MaxAttempts: 20,
		BaseBackoff: time.Second,
		MaxBackoff:  10 * time.Second,
	}

	// 2^20 seconds would vastly exceed the cap.
	for _, attempt := range []int{5, 10, 20} {
		got := p.BackoffFor(attempt, noJitter)
		if got > 10*time.Second {
			t.Errorf("BackoffFor(%d) = %s, exceeds MaxBackoff of 10s", attempt, got)
		}
	}
	if got := p.BackoffFor(20, noJitter); got != 10*time.Second {
		t.Errorf("BackoffFor(20) = %s, want the 10s cap", got)
	}
}

// TestBackoffHugeAttemptDoesNotOverflow ensures a runaway attempt counter
// cannot wrap the duration into a negative sleep.
func TestBackoffHugeAttemptDoesNotOverflow(t *testing.T) {
	p := RetryPolicy{MaxAttempts: 2000, BaseBackoff: time.Second, MaxBackoff: 30 * time.Second}

	got := p.BackoffFor(1000, noJitter)
	if got < 0 {
		t.Fatalf("BackoffFor(1000) = %s, must never be negative", got)
	}
	if got != 30*time.Second {
		t.Errorf("BackoffFor(1000) = %s, want the 30s cap", got)
	}
}

func TestBackoffZeroBaseIsZero(t *testing.T) {
	p := RetryPolicy{MaxAttempts: 3, BaseBackoff: 0, MaxBackoff: time.Minute, JitterFactor: 0.5}

	if got := p.BackoffFor(3, nil); got != 0 {
		t.Errorf("BackoffFor with zero base = %s, want 0", got)
	}
}

// ---------------------------------------------------------------------------
// Jitter
// ---------------------------------------------------------------------------

// TestJitterStaysWithinBounds pins the documented window: a jittered delay
// lands in [d*(1-factor), d] and never exceeds the un-jittered delay.
func TestJitterStaysWithinBounds(t *testing.T) {
	p := testPolicy() // JitterFactor 0.2

	for attempt := 1; attempt <= 4; attempt++ {
		full := p.BackoffFor(attempt, noJitter)
		lowest := p.BackoffFor(attempt, maxJitter)

		minWant := time.Duration(float64(full) * 0.8)
		if lowest > full {
			t.Errorf("attempt %d: jittered delay %s exceeds un-jittered %s", attempt, lowest, full)
		}
		// Allow a nanosecond of float slack at the boundary.
		if lowest < minWant-time.Nanosecond {
			t.Errorf("attempt %d: jittered delay %s below the 20%% floor %s", attempt, lowest, minWant)
		}
	}
}

// TestJitterProducesSpread confirms jitter actually varies the delay, which is
// the point: identical delays cause synchronised retry storms.
func TestJitterProducesSpread(t *testing.T) {
	p := testPolicy()

	seen := map[time.Duration]struct{}{}
	for i := 0; i < 200; i++ {
		seen[p.BackoffFor(3, nil)] = struct{}{}
	}
	if len(seen) < 2 {
		t.Fatalf("jitter produced %d distinct delay(s) over 200 draws; expected a spread", len(seen))
	}
}

func TestJitterDisabledIsDeterministic(t *testing.T) {
	p := RetryPolicy{MaxAttempts: 3, BaseBackoff: time.Second, MaxBackoff: time.Minute, JitterFactor: 0}

	first := p.BackoffFor(2, nil)
	for i := 0; i < 50; i++ {
		if got := p.BackoffFor(2, nil); got != first {
			t.Fatalf("zero jitter should be deterministic: got %s then %s", first, got)
		}
	}
	if first != 2*time.Second {
		t.Errorf("BackoffFor(2) = %s, want 2s", first)
	}
}

// TestJitterNeverExceedsCap is the reason jitter is subtractive rather than
// additive.
func TestJitterNeverExceedsCap(t *testing.T) {
	p := RetryPolicy{MaxAttempts: 10, BaseBackoff: time.Second, MaxBackoff: 5 * time.Second, JitterFactor: 1}

	for i := 0; i < 200; i++ {
		if got := p.BackoffFor(9, nil); got > 5*time.Second {
			t.Fatalf("jittered delay %s exceeded the 5s cap", got)
		}
	}
}

// ---------------------------------------------------------------------------
// Policy normalisation and configuration
// ---------------------------------------------------------------------------

func TestRetryPolicyFromEnvReadsConfiguration(t *testing.T) {
	t.Setenv(EnvMintingMaxAttempts, "7")
	t.Setenv(EnvMintingBackoffBase, "250ms")
	t.Setenv(EnvMintingBackoffMax, "5s")
	t.Setenv(EnvMintingBackoffJitter, "0.5")

	p := RetryPolicyFromEnv()

	if p.MaxAttempts != 7 {
		t.Errorf("MaxAttempts = %d, want 7", p.MaxAttempts)
	}
	if p.BaseBackoff != 250*time.Millisecond {
		t.Errorf("BaseBackoff = %s, want 250ms", p.BaseBackoff)
	}
	if p.MaxBackoff != 5*time.Second {
		t.Errorf("MaxBackoff = %s, want 5s", p.MaxBackoff)
	}
	if p.JitterFactor != 0.5 {
		t.Errorf("JitterFactor = %v, want 0.5", p.JitterFactor)
	}
}

// TestRetryPolicyFromEnvFallsBackOnGarbage ensures a typo in configuration
// cannot disable retries or produce negative sleeps.
func TestRetryPolicyFromEnvFallsBackOnGarbage(t *testing.T) {
	t.Setenv(EnvMintingMaxAttempts, "not-a-number")
	t.Setenv(EnvMintingBackoffBase, "soon")
	t.Setenv(EnvMintingBackoffMax, "")
	t.Setenv(EnvMintingBackoffJitter, "high")

	p := RetryPolicyFromEnv()
	want := DefaultRetryPolicy()

	if p != want {
		t.Errorf("RetryPolicyFromEnv() = %+v, want defaults %+v", p, want)
	}
}

func TestRetryPolicyNormalisesOutOfRangeValues(t *testing.T) {
	p := RetryPolicy{
		MaxAttempts:  0,
		BaseBackoff:  -time.Second,
		MaxBackoff:   -time.Minute,
		JitterFactor: 4,
	}.normalized()

	if p.MaxAttempts != 1 {
		t.Errorf("MaxAttempts = %d, want at least 1", p.MaxAttempts)
	}
	if p.BaseBackoff < 0 || p.MaxBackoff < 0 {
		t.Errorf("negative backoff survived normalisation: %+v", p)
	}
	if p.JitterFactor != 1 {
		t.Errorf("JitterFactor = %v, want clamped to 1", p.JitterFactor)
	}
}

func TestDefaultRetryPolicyUsedWhenUnset(t *testing.T) {
	s := &service{}
	if got := s.retryPolicy(); got != DefaultRetryPolicy() {
		t.Errorf("retryPolicy() = %+v, want defaults", got)
	}
}

func TestSetRetryPolicyOverridesAndNormalises(t *testing.T) {
	s := &service{}
	s.SetRetryPolicy(RetryPolicy{MaxAttempts: 0, BaseBackoff: time.Second, MaxBackoff: time.Second, JitterFactor: 9})

	got := s.retryPolicy()
	if got.MaxAttempts != 1 {
		t.Errorf("MaxAttempts = %d, want normalised to 1", got.MaxAttempts)
	}
	if got.JitterFactor != 1 {
		t.Errorf("JitterFactor = %v, want normalised to 1", got.JitterFactor)
	}
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

func TestIsRetryableNilIsFalse(t *testing.T) {
	if IsRetryable(nil) {
		t.Error("IsRetryable(nil) should be false")
	}
}

// TestCapErrorsAreNotRetryable is the acceptance criterion: a cap breach must
// fail the job without consuming further attempts.
func TestCapErrorsAreNotRetryable(t *testing.T) {
	for name, err := range map[string]error{
		"supply cap":       methodology.ErrCapExceeded,
		"per-project cap":  methodology.ErrProjectCapExceeded,
		"per-vintage cap":  methodology.ErrVintageCapExceeded,
		"cap unconfigured": methodology.ErrCapNotConfigured,
	} {
		t.Run(name, func(t *testing.T) {
			if IsRetryable(err) {
				t.Errorf("%v should not be retryable", err)
			}
			// Wrapped, as the cap validator returns it in practice.
			wrapped := fmt.Errorf("validate and execute mint: %w", err)
			if IsRetryable(wrapped) {
				t.Errorf("wrapped %v should not be retryable", err)
			}
		})
	}
}

func TestPermanentErrorIsNotRetryable(t *testing.T) {
	err := Permanent(errors.New("mint simulation failed: contract panicked"))

	if IsRetryable(err) {
		t.Error("PermanentError should not be retryable")
	}
	if IsRetryable(fmt.Errorf("attempt 1: %w", err)) {
		t.Error("wrapped PermanentError should not be retryable")
	}
}

func TestTransientErrorIsRetryable(t *testing.T) {
	err := Transient(errors.New("connection reset by peer"))

	if !IsRetryable(err) {
		t.Error("TransientError should be retryable")
	}
	if !IsRetryable(fmt.Errorf("attempt 2: %w", err)) {
		t.Error("wrapped TransientError should be retryable")
	}
}

func TestContextErrorsAreNotRetryable(t *testing.T) {
	if IsRetryable(context.Canceled) {
		t.Error("context.Canceled should not be retryable")
	}
	if IsRetryable(context.DeadlineExceeded) {
		t.Error("context.DeadlineExceeded should not be retryable")
	}
}

// TestUnclassifiedErrorsAreRetryable documents the default: an unrecognised
// transport fault still gets its attempts rather than failing the job outright.
func TestUnclassifiedErrorsAreRetryable(t *testing.T) {
	if !IsRetryable(errors.New("i/o timeout")) {
		t.Error("an unclassified error should default to retryable")
	}
}

func TestPermanentAndTransientPreserveNil(t *testing.T) {
	if Permanent(nil) != nil {
		t.Error("Permanent(nil) should be nil")
	}
	if Transient(nil) != nil {
		t.Error("Transient(nil) should be nil")
	}
}

func TestPermanentErrorUnwrapsToCause(t *testing.T) {
	cause := errors.New("cap exceeded")
	err := Permanent(fmt.Errorf("mint: %w", cause))

	if !errors.Is(err, cause) {
		t.Error("PermanentError should unwrap to its cause")
	}
	if err.Error() != "mint: cap exceeded" {
		t.Errorf("Error() = %q, want %q", err.Error(), "mint: cap exceeded")
	}
}

func TestClassifyMintErrorLabelsStageAndKind(t *testing.T) {
	cause := errors.New("dial tcp: timeout")

	transient := classifyMintError("simulate mint transaction", cause, false)
	if !IsRetryable(transient) {
		t.Error("classifyMintError(permanent=false) should be retryable")
	}
	if !errors.Is(transient, cause) {
		t.Error("classified error should unwrap to its cause")
	}

	permanent := classifyMintError("submit mint transaction", cause, true)
	if IsRetryable(permanent) {
		t.Error("classifyMintError(permanent=true) should not be retryable")
	}

	if classifyMintError("stage", nil, true) != nil {
		t.Error("classifyMintError with a nil cause should be nil")
	}
}

// ---------------------------------------------------------------------------
// Retry loop behaviour
// ---------------------------------------------------------------------------

// attemptCounter records how many times a mint was attempted, so the loop's
// branching can be asserted without a database.
type attemptCounter struct {
	calls int
	err   error
}

func (a *attemptCounter) run() error {
	a.calls++
	return a.err
}

// simulateRetryLoop mirrors processMintingJob's retry decision logic over an
// injectable attempt function. It exercises the same policy and classification
// the service uses, without requiring a gorm database.
func simulateRetryLoop(p RetryPolicy, attemptFn func() error) (attempts int, lastErr error) {
	p = p.normalized()
	for attempt := 1; attempt <= p.MaxAttempts; attempt++ {
		attempts++
		err := attemptFn()
		if err == nil {
			return attempts, nil
		}
		lastErr = err
		if !IsRetryable(err) {
			return attempts, lastErr
		}
		if attempt == p.MaxAttempts {
			return attempts, lastErr
		}
		// Backoff computed but not slept, keeping the test fast.
		_ = p.BackoffFor(attempt, noJitter)
	}
	return attempts, lastErr
}

// TestNonRetryableErrorFailsOnFirstAttempt is the headline acceptance
// criterion for issue #618.
func TestNonRetryableErrorFailsOnFirstAttempt(t *testing.T) {
	counter := &attemptCounter{err: fmt.Errorf("mint blocked: %w", methodology.ErrCapExceeded)}
	policy := RetryPolicy{MaxAttempts: 5, BaseBackoff: time.Millisecond, MaxBackoff: time.Second}

	attempts, err := simulateRetryLoop(policy, counter.run)

	if attempts != 1 {
		t.Errorf("attempts = %d, want 1 (a cap breach must not consume retries)", attempts)
	}
	if counter.calls != 1 {
		t.Errorf("mint called %d times, want 1", counter.calls)
	}
	if !errors.Is(err, methodology.ErrCapExceeded) {
		t.Errorf("err = %v, want the cap error preserved", err)
	}
}

func TestRetryableErrorExhaustsAllAttempts(t *testing.T) {
	counter := &attemptCounter{err: Transient(errors.New("rpc unavailable"))}
	policy := RetryPolicy{MaxAttempts: 4, BaseBackoff: time.Millisecond, MaxBackoff: time.Second}

	attempts, err := simulateRetryLoop(policy, counter.run)

	if attempts != 4 {
		t.Errorf("attempts = %d, want 4", attempts)
	}
	if counter.calls != 4 {
		t.Errorf("mint called %d times, want 4", counter.calls)
	}
	if err == nil {
		t.Error("expected the final error to be reported")
	}
}

func TestSuccessStopsRetrying(t *testing.T) {
	calls := 0
	attemptFn := func() error {
		calls++
		if calls < 2 {
			return Transient(errors.New("temporary rpc failure"))
		}
		return nil
	}
	policy := RetryPolicy{MaxAttempts: 5, BaseBackoff: time.Millisecond, MaxBackoff: time.Second}

	attempts, err := simulateRetryLoop(policy, attemptFn)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if attempts != 2 {
		t.Errorf("attempts = %d, want 2 (succeeded on the retry)", attempts)
	}
}

// TestMaxAttemptsIsHonoured verifies the ceiling comes from configuration
// rather than the previously hardcoded 3.
func TestMaxAttemptsIsHonoured(t *testing.T) {
	for _, maxAttempts := range []int{1, 2, 7} {
		counter := &attemptCounter{err: Transient(errors.New("boom"))}
		policy := RetryPolicy{MaxAttempts: maxAttempts, BaseBackoff: time.Millisecond, MaxBackoff: time.Second}

		attempts, _ := simulateRetryLoop(policy, counter.run)
		if attempts != maxAttempts {
			t.Errorf("MaxAttempts %d: attempts = %d, want %d", maxAttempts, attempts, maxAttempts)
		}
	}
}
