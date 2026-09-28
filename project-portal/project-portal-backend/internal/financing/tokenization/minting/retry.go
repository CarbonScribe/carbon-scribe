package minting

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"os"
	"strconv"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
)

// Environment variables tuning the minting retry policy. They exist so the
// policy can be adjusted per environment, and tightened or relaxed during an
// incident, without a redeploy.
const (
	EnvMintingMaxAttempts   = "MINTING_MAX_ATTEMPTS"
	EnvMintingBackoffBase   = "MINTING_BACKOFF_BASE"
	EnvMintingBackoffMax    = "MINTING_BACKOFF_MAX"
	EnvMintingBackoffJitter = "MINTING_BACKOFF_JITTER"
)

// Defaults for the minting retry policy.
const (
	DefaultMintMaxAttempts  = 3
	DefaultMintBaseBackoff  = 2 * time.Second
	DefaultMintMaxBackoff   = 60 * time.Second
	DefaultMintJitterFactor = 0.2
)

// RetryPolicy describes how a failed minting attempt is retried.
//
// Delay grows exponentially — BaseBackoff * 2^(attempt-1) — and is clamped at
// MaxBackoff, then reduced by a random fraction of up to JitterFactor. Jitter
// is subtractive rather than additive so a delay can never exceed MaxBackoff.
type RetryPolicy struct {
	// MaxAttempts is the total number of attempts, including the first.
	// Values below 1 are treated as 1.
	MaxAttempts int
	// BaseBackoff is the delay after the first failed attempt.
	BaseBackoff time.Duration
	// MaxBackoff caps the computed delay before jitter is applied.
	MaxBackoff time.Duration
	// JitterFactor is the fraction of a delay that is randomised, in [0,1].
	// 0.2 spreads the delay across [0.8d, d]; 0 disables jitter.
	JitterFactor float64
}

// DefaultRetryPolicy returns the policy used when nothing is configured.
func DefaultRetryPolicy() RetryPolicy {
	return RetryPolicy{
		MaxAttempts:  DefaultMintMaxAttempts,
		BaseBackoff:  DefaultMintBaseBackoff,
		MaxBackoff:   DefaultMintMaxBackoff,
		JitterFactor: DefaultMintJitterFactor,
	}
}

// RetryPolicyFromEnv builds a RetryPolicy from environment variables, falling
// back to DefaultRetryPolicy for any value that is unset or unparsable.
func RetryPolicyFromEnv() RetryPolicy {
	p := DefaultRetryPolicy()

	if v := os.Getenv(EnvMintingMaxAttempts); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			p.MaxAttempts = parsed
		}
	}
	if v := os.Getenv(EnvMintingBackoffBase); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			p.BaseBackoff = parsed
		}
	}
	if v := os.Getenv(EnvMintingBackoffMax); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			p.MaxBackoff = parsed
		}
	}
	if v := os.Getenv(EnvMintingBackoffJitter); v != "" {
		if parsed, err := strconv.ParseFloat(v, 64); err == nil {
			p.JitterFactor = parsed
		}
	}

	return p.normalized()
}

// normalized clamps a policy into a usable range, so a malformed configuration
// degrades to sane behaviour instead of producing negative sleeps or an
// unbounded retry loop.
func (p RetryPolicy) normalized() RetryPolicy {
	if p.MaxAttempts < 1 {
		p.MaxAttempts = 1
	}
	if p.BaseBackoff < 0 {
		p.BaseBackoff = 0
	}
	if p.MaxBackoff < p.BaseBackoff {
		p.MaxBackoff = p.BaseBackoff
	}
	if p.JitterFactor < 0 {
		p.JitterFactor = 0
	}
	if p.JitterFactor > 1 {
		p.JitterFactor = 1
	}
	return p
}

// BackoffFor returns the delay to wait after the given 1-based attempt number,
// before the attempt that follows it. randFloat supplies a value in [0,1);
// passing nil uses the package's shared source.
//
// The returned delay is always within [d*(1-JitterFactor), d], where d is the
// capped exponential delay for that attempt.
func (p RetryPolicy) BackoffFor(attempt int, randFloat func() float64) time.Duration {
	p = p.normalized()
	if attempt < 1 {
		attempt = 1
	}
	if p.BaseBackoff == 0 {
		return 0
	}

	// Compute base * 2^(attempt-1) in float to detect overflow before it
	// wraps a time.Duration into a negative sleep.
	growth := math.Pow(2, float64(attempt-1))
	delay := float64(p.BaseBackoff) * growth
	if delay > float64(p.MaxBackoff) || math.IsInf(delay, 0) {
		delay = float64(p.MaxBackoff)
	}

	if p.JitterFactor > 0 {
		if randFloat == nil {
			randFloat = rand.Float64
		}
		// Subtractive jitter keeps the delay inside the cap.
		delay -= delay * p.JitterFactor * randFloat()
	}

	if delay < 0 {
		delay = 0
	}
	return time.Duration(delay)
}

// ============================================================================
// Error classification
// ============================================================================

// PermanentError marks a failure that will recur identically on retry —
// a rejected transaction, a breached methodology cap, a malformed request.
// Retrying one wastes attempts and delays the terminal "failed" status.
type PermanentError struct{ Err error }

func (e *PermanentError) Error() string {
	if e == nil || e.Err == nil {
		return "permanent minting error"
	}
	return e.Err.Error()
}
func (e *PermanentError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// Permanent wraps err as non-retryable. It returns nil for a nil err so it can
// be applied directly to a function result.
func Permanent(err error) error {
	if err == nil {
		return nil
	}
	return &PermanentError{Err: err}
}

// TransientError marks a failure that may succeed on retry — an RPC timeout,
// a connection reset, a temporarily unavailable endpoint.
type TransientError struct{ Err error }

func (e *TransientError) Error() string {
	if e == nil || e.Err == nil {
		return "transient minting error"
	}
	return e.Err.Error()
}
func (e *TransientError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// Transient wraps err as retryable. It returns nil for a nil err.
func Transient(err error) error {
	if err == nil {
		return nil
	}
	return &TransientError{Err: err}
}

// IsRetryable reports whether a failed minting attempt is worth retrying.
//
// Classification order:
//  1. An explicit PermanentError is never retried.
//  2. An explicit TransientError always is.
//  3. Methodology cap violations are business outcomes, not faults, and are
//     never retried.
//  4. A cancelled or expired context is not retried — the caller has gone.
//  5. Anything unclassified is treated as retryable, so an unrecognised
//     transport fault still gets its attempts.
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}

	var permanent *PermanentError
	if errors.As(err, &permanent) {
		return false
	}
	var transient *TransientError
	if errors.As(err, &transient) {
		return true
	}

	// Methodology cap decisions are deterministic: the same request will be
	// rejected the same way every time until the cap itself changes.
	for _, capErr := range []error{
		methodology.ErrCapExceeded,
		methodology.ErrProjectCapExceeded,
		methodology.ErrVintageCapExceeded,
		methodology.ErrCapNotConfigured,
	} {
		if errors.Is(err, capErr) {
			return false
		}
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}

	return true
}

// classifyMintError is used by the contract client to label a failure at the
// point where the cause is known, so the retry loop does not have to infer it
// from an error string.
func classifyMintError(stage string, err error, permanent bool) error {
	if err == nil {
		return nil
	}
	wrapped := fmt.Errorf("%s: %w", stage, err)
	if permanent {
		return Permanent(wrapped)
	}
	return Transient(wrapped)
}
