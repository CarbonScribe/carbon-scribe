package retention

import (
	"context"
	"log"
	"time"
)

// ScheduleRepository defines the data access interface for schedule operations.
type ScheduleRepository interface {
	GetDueSchedules(ctx context.Context, before time.Time) (interface{}, error)
}

// Scheduler manages the execution of retention schedules.
type Scheduler struct {
	repo     interface{}
	enforcer *Enforcer
	ticker   *time.Ticker
	done     chan bool
}

// NewScheduler creates a retention scheduler.
func NewScheduler(repo interface{}, enforcer *Enforcer) *Scheduler {
	return &Scheduler{
		repo:     repo,
		enforcer: enforcer,
		done:     make(chan bool),
	}
}

// Start begins the retention schedule check loop.
func (s *Scheduler) Start(interval time.Duration) {
	s.ticker = time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-s.done:
				return
			case <-s.ticker.C:
				if err := s.checkSchedules(); err != nil {
					log.Printf("retention scheduler error: %v", err)
				}
			}
		}
	}()
	log.Printf("retention scheduler started with interval %v", interval)
}

// Stop halts the scheduler.
func (s *Scheduler) Stop() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	s.done <- true
	log.Println("retention scheduler stopped")
}

func (s *Scheduler) checkSchedules() error {
	log.Println("checking retention schedules...")
	// Actual schedule fetching and enforcement would use the repository
	// to get due schedules and delegate to the enforcer.
	return nil
}

// ScheduleEntry represents a single scheduled retention action.
type ScheduleEntry struct {
	PolicyID       string
	DataType       string
	ActionType     string
	NextActionDate time.Time
	ReviewDate     time.Time
}

// BuildSchedule creates a schedule entry from policy parameters.
func BuildSchedule(policyID, dataType, actionType string, retentionDays, reviewDays int) ScheduleEntry {
	now := time.Now()
	return ScheduleEntry{
		PolicyID:       policyID,
		DataType:       dataType,
		ActionType:     actionType,
		NextActionDate: now.AddDate(0, 0, retentionDays),
		ReviewDate:     now.AddDate(0, 0, reviewDays),
	}
}
