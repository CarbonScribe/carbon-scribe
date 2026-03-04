package encryption

import "time"

type RotationPolicy struct {
	Enabled  bool
	Interval time.Duration
}

type RotationManager struct {
	policy RotationPolicy
}

func NewRotationManager(policy RotationPolicy) *RotationManager {
	return &RotationManager{policy: policy}
}

func (r *RotationManager) ShouldRotate(lastRotated time.Time, now time.Time) bool {
	if !r.policy.Enabled || r.policy.Interval <= 0 {
		return false
	}
	return now.Sub(lastRotated) >= r.policy.Interval
}
