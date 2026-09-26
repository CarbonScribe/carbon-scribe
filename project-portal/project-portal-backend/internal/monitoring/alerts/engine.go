package alerts

import (
	"context"
	"fmt"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

// AlertEngine evaluates alert rules against monitoring data.
type AlertEngine struct {
	repo         monitoring.Repository
	notification *NotificationService
	rules        map[string]*AlertRule
	ruleStates   map[string]*RuleState
	mu           sync.RWMutex
	cron         *cron.Cron
	stopCh       chan struct{}
}

// NewAlertEngine creates a new AlertEngine.
func NewAlertEngine(repo monitoring.Repository, notification *NotificationService) *AlertEngine {
	return &AlertEngine{
		repo:         repo,
		notification: notification,
		rules:        make(map[string]*AlertRule),
		ruleStates:   make(map[string]*RuleState),
		cron:         cron.New(cron.WithSeconds()),
		stopCh:       make(chan struct{}),
	}
}

// Start begins the alert evaluation loop.
func (e *AlertEngine) Start(ctx context.Context) error {
	if err := e.loadRules(ctx); err != nil {
		return fmt.Errorf("load rules: %w", err)
	}

	for _, rule := range e.rules {
		if !rule.Enabled {
			continue
		}
		schedule := rule.Schedule
		if schedule == "" {
			schedule = "@every 1m"
		}
		_, err := e.cron.AddFunc(schedule, func() {
			e.evaluateRule(context.Background(), rule.ID)
		})
		if err != nil {
			return fmt.Errorf("schedule rule %s: %w", rule.ID, err)
		}
	}

	e.cron.Start()
	go e.cleanupLoop(ctx)

	<-e.stopCh
	e.cron.Stop()
	return nil
}

// Stop stops the alert engine.
func (e *AlertEngine) Stop() {
	close(e.stopCh)
}

// AddRule adds or updates an alert rule.
func (e *AlertEngine) AddRule(ctx context.Context, rule *AlertRule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if err := rule.Validate(); err != nil {
		return err
	}

	e.rules[rule.ID] = rule
	if _, exists := e.ruleStates[rule.ID]; !exists {
		e.ruleStates[rule.ID] = &RuleState{
			RuleID:      rule.ID,
			Firing:      false,
			Resolved:    false,
			FiringCount: 0,
			LastValues:  []float64{},
		}
	}
	return nil
}

// RemoveRule removes an alert rule.
func (e *AlertEngine) RemoveRule(ruleID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.rules, ruleID)
	delete(e.ruleStates, ruleID)
}

// evaluateRule evaluates a single rule.
func (e *AlertEngine) evaluateRule(ctx context.Context, ruleID string) {
	e.mu.RLock()
	rule, exists := e.rules[ruleID]
	e.mu.RUnlock()
	if !exists {
		return
	}

	state := e.getRuleState(ruleID)
	if state == nil {
		return
	}

	result, err := e.evaluateCondition(ctx, rule, state)
	if err != nil {
		return
	}

	e.updateRuleState(ruleID, result, state)

	if result.Triggered && state.FiringCount >= rule.For {
		if !state.Firing {
			if err := e.triggerAlert(ctx, rule, result); err == nil {
				state.Firing = true
				state.FiredAt = time.Now()
			}
		}
	} else if !result.Triggered && state.Firing {
		if err := e.resolveAlert(ctx, rule, state); err == nil {
			state.Firing = false
			state.ResolvedAt = time.Now()
		}
	}

	state.LastEvaluation = time.Now()
}

// evaluateCondition evaluates a single rule condition.
func (e *AlertEngine) evaluateCondition(ctx context.Context, rule *AlertRule, state *RuleState) (*EvaluationResult, error) {
	switch rule.Condition.Type {
	case ConditionTypeThreshold:
		return e.evaluateThreshold(ctx, rule, state)
	case ConditionTypeAnomaly:
		return e.evaluateAnomaly(ctx, rule, state)
	case ConditionTypeComposite:
		return e.evaluateComposite(ctx, rule, state)
	default:
		return nil, fmt.Errorf("unsupported condition type: %s", rule.Condition.Type)
	}
}

// evaluateThreshold evaluates a threshold condition.
func (e *AlertEngine) evaluateThreshold(ctx context.Context, rule *AlertRule, state *RuleState) (*EvaluationResult, error) {
	cond := rule.Condition

	// FIX: fetchMetrics expects (ctx, metricName, service, timeWindow)
	metrics, err := e.fetchMetrics(ctx, cond.MetricName, cond.Service, cond.TimeWindow)
	if err != nil {
		return nil, err
	}

	if len(metrics) == 0 {
		return &EvaluationResult{
			Triggered: false,
			Value:     0,
			Message:   "No metrics found",
		}, nil
	}

	value := calculateAggregate(metrics, cond.Aggregation)
	triggered := false

	switch cond.Operator {
	case "gt":
		triggered = value > cond.Threshold
	case "gte":
		triggered = value >= cond.Threshold
	case "lt":
		triggered = value < cond.Threshold
	case "lte":
		triggered = value <= cond.Threshold
	case "eq":
		triggered = value == cond.Threshold
	case "neq":
		triggered = value != cond.Threshold
	}

	return &EvaluationResult{
		Triggered: triggered,
		Value:     value,
		Threshold: cond.Threshold,
		Operator:  cond.Operator,
		Message:   fmt.Sprintf("%s %.2f %s %.2f", cond.MetricName, value, cond.Operator, cond.Threshold),
	}, nil
}

// evaluateAnomaly evaluates an anomaly detection condition.
func (e *AlertEngine) evaluateAnomaly(ctx context.Context, rule *AlertRule, state *RuleState) (*EvaluationResult, error) {
	cond := rule.Condition

	// FIX: fetchMetrics expects (ctx, metricName, service, timeWindow)
	historical, err := e.fetchMetrics(ctx, cond.MetricName, cond.Service, cond.AnomalyLookback)
	if err != nil {
		return nil, err
	}

	if len(historical) < 10 {
		return &EvaluationResult{
			Triggered: false,
			Value:     0,
			Message:   "Insufficient historical data",
		}, nil
	}

	current, err := e.fetchMetrics(ctx, cond.MetricName, cond.Service, cond.TimeWindow)
	if err != nil {
		return nil, err
	}

	if len(current) == 0 {
		return &EvaluationResult{
			Triggered: false,
			Value:     0,
			Message:   "No current metrics found",
		}, nil
	}

	baseline, stdDev := calculateBaseline(historical)
	currentValue := calculateAggregate(current, cond.Aggregation)

	zScore := 0.0
	if stdDev > 0 {
		zScore = (currentValue - baseline) / stdDev
	}

	triggered := false
	if cond.AnomalyDirection == "both" {
		triggered = zScore > cond.AnomalyThreshold || zScore < -cond.AnomalyThreshold
	} else if cond.AnomalyDirection == "up" {
		triggered = zScore > cond.AnomalyThreshold
	} else if cond.AnomalyDirection == "down" {
		triggered = zScore < -cond.AnomalyThreshold
	}

	return &EvaluationResult{
		Triggered: triggered,
		Value:     currentValue,
		Baseline:  baseline,
		ZScore:    zScore,
		Message:   fmt.Sprintf("Anomaly detected: value %.2f (z-score: %.2f)", currentValue, zScore),
	}, nil
}

// evaluateComposite evaluates a composite condition (AND/OR logic).
func (e *AlertEngine) evaluateComposite(ctx context.Context, rule *AlertRule, state *RuleState) (*EvaluationResult, error) {
	cond := rule.Condition
	results := []bool{}
	messages := []string{}

	for _, childCond := range cond.Conditions {
		tempRule := &AlertRule{
			ID:        rule.ID + "-sub",
			Condition: childCond,
		}
		subResult, err := e.evaluateCondition(ctx, tempRule, state)
		if err != nil {
			return nil, err
		}
		results = append(results, subResult.Triggered)
		messages = append(messages, subResult.Message)
	}

	triggered := false
	if cond.LogicOperator == "AND" {
		triggered = true
		for _, r := range results {
			if !r {
				triggered = false
				break
			}
		}
	} else if cond.LogicOperator == "OR" {
		for _, r := range results {
			if r {
				triggered = true
				break
			}
		}
	}

	return &EvaluationResult{
		Triggered: triggered,
		Message:   fmt.Sprintf("Composite condition %s: %v", cond.LogicOperator, messages),
	}, nil
}

// triggerAlert creates and triggers an alert.
func (e *AlertEngine) triggerAlert(ctx context.Context, rule *AlertRule, result *EvaluationResult) error {
	existing, err := e.repo.ListAlerts(ctx, monitoring.AlertStatusActive, "", 1)
	if err != nil {
		return err
	}

	for _, alert := range existing {
		// FIX: Use Title field (SystemAlert has Title, not AlertName)
		if alert.Title == rule.Name && alert.ServiceName == rule.Service {
			return nil
		}
	}

	alert := &monitoring.SystemAlert{
		ID:          uuid.NewString(),
		ServiceName: rule.Service,
		Severity:    rule.Severity,
		Status:      monitoring.AlertStatusActive,
		Title:       rule.Name,
		Message:     result.Message,
		Details: map[string]interface{}{
			"rule_id":      rule.ID,
			"condition":    rule.Condition,
			"evaluation":   result,
			"triggered_at": time.Now().Format(time.RFC3339),
		},
		TriggeredBy: "alert_engine",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := e.repo.SaveAlert(ctx, alert); err != nil {
		return fmt.Errorf("save alert: %w", err)
	}

	if rule.Notification != nil {
		go e.notification.SendAlert(ctx, alert, rule)
	}

	return nil
}

// resolveAlert resolves a firing alert.
func (e *AlertEngine) resolveAlert(ctx context.Context, rule *AlertRule, state *RuleState) error {
	alerts, err := e.repo.ListAlerts(ctx, monitoring.AlertStatusActive, "", 10)
	if err != nil {
		return err
	}

	for _, alert := range alerts {
		// FIX: Use Title field (SystemAlert has Title, not AlertName)
		if alert.Title == rule.Name && alert.ServiceName == rule.Service {
			if err := e.repo.ResolveAlert(ctx, alert.ID, "alert_engine"); err != nil {
				return err
			}

			if rule.Notification != nil {
				// FIX: Pass pointer to alert
				go e.notification.SendAlertResolution(ctx, &alert, rule)
			}
			break
		}
	}

	return nil
}

// fetchMetrics retrieves metrics for evaluation.
// Signature: (ctx, metricName, service string, timeWindow time.Duration)
func (e *AlertEngine) fetchMetrics(ctx context.Context, metricName, service string, timeWindow time.Duration) ([]monitoring.SystemMetric, error) {
	endTime := time.Now()
	startTime := endTime.Add(-timeWindow)

	req := monitoring.MetricQueryRequest{
		MetricName: metricName,
		Service:    service,
		StartTime:  startTime,
		EndTime:    endTime,
		Limit:      1000,
	}

	return e.repo.QueryMetrics(ctx, req)
}

// getRuleState returns the state for a rule.
func (e *AlertEngine) getRuleState(ruleID string) *RuleState {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.ruleStates[ruleID]
}

// updateRuleState updates the state for a rule.
func (e *AlertEngine) updateRuleState(ruleID string, result *EvaluationResult, state *RuleState) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if result.Triggered {
		state.FiringCount++
		state.LastValues = append(state.LastValues, result.Value)
		if len(state.LastValues) > 100 {
			state.LastValues = state.LastValues[1:]
		}
	} else {
		state.FiringCount = 0
	}
}

// loadRules loads rules from database or configuration.
func (e *AlertEngine) loadRules(ctx context.Context) error {
	rules := getDefaultRules()
	for _, rule := range rules {
		if err := e.AddRule(ctx, rule); err != nil {
			return err
		}
	}
	return nil
}

// cleanupLoop periodically cleans up old rule states.
func (e *AlertEngine) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			e.mu.Lock()
			for id, state := range e.ruleStates {
				if time.Since(state.LastEvaluation) > 24*time.Hour && !state.Firing {
					delete(e.ruleStates, id)
				}
			}
			e.mu.Unlock()
		case <-e.stopCh:
			return
		}
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

func calculateAggregate(metrics []monitoring.SystemMetric, agg string) float64 {
	if len(metrics) == 0 {
		return 0
	}

	switch agg {
	case "avg":
		sum := 0.0
		for _, m := range metrics {
			sum += m.Value
		}
		return sum / float64(len(metrics))
	case "min":
		min := metrics[0].Value
		for _, m := range metrics {
			if m.Value < min {
				min = m.Value
			}
		}
		return min
	case "max":
		max := metrics[0].Value
		for _, m := range metrics {
			if m.Value > max {
				max = m.Value
			}
		}
		return max
	case "last":
		return metrics[len(metrics)-1].Value
	default:
		if len(metrics) > 0 {
			return metrics[len(metrics)-1].Value
		}
		return 0
	}
}

func calculateBaseline(metrics []monitoring.SystemMetric) (mean, stdDev float64) {
	if len(metrics) == 0 {
		return 0, 0
	}

	sum := 0.0
	for _, m := range metrics {
		sum += m.Value
	}
	mean = sum / float64(len(metrics))

	sumSq := 0.0
	for _, m := range metrics {
		diff := m.Value - mean
		sumSq += diff * diff
	}
	stdDev = sumSq / float64(len(metrics))
	if stdDev > 0 {
		z := stdDev / 2
		for i := 0; i < 10; i++ {
			z = z - (z*z-stdDev)/(2*z)
		}
		stdDev = z
	}
	return mean, stdDev
}

// ============================================================================
// Types
// ============================================================================

// AlertRule defines a rule for alert evaluation.
type AlertRule struct {
	ID           string                   `json:"id"`
	Name         string                   `json:"name"`
	Description  string                   `json:"description"`
	Service      string                   `json:"service"`
	Severity     monitoring.AlertSeverity `json:"severity"`
	Enabled      bool                     `json:"enabled"`
	Schedule     string                   `json:"schedule"`
	For          int                      `json:"for"`
	Condition    Condition                `json:"condition"`
	Notification *NotificationConfig      `json:"notification,omitempty"`
	Labels       map[string]string        `json:"labels"`
	CreatedAt    time.Time                `json:"created_at"`
	UpdatedAt    time.Time                `json:"updated_at"`
}

// Validate validates the alert rule.
func (r *AlertRule) Validate() error {
	if r.ID == "" {
		return fmt.Errorf("rule ID is required")
	}
	if r.Name == "" {
		return fmt.Errorf("rule name is required")
	}
	if r.Service == "" {
		return fmt.Errorf("service is required")
	}
	if err := r.Condition.Validate(); err != nil {
		return err
	}
	return nil
}

// Condition represents a rule condition.
type Condition struct {
	Type             ConditionType `json:"type"`
	MetricName       string        `json:"metric_name"`
	Service          string        `json:"service"`
	Threshold        float64       `json:"threshold"`
	Operator         string        `json:"operator"`
	Aggregation      string        `json:"aggregation"`
	TimeWindow       time.Duration `json:"time_window"`
	AnomalyLookback  time.Duration `json:"anomaly_lookback"`
	AnomalyThreshold float64       `json:"anomaly_threshold"`
	AnomalyDirection string        `json:"anomaly_direction"`
	LogicOperator    string        `json:"logic_operator"`
	Conditions       []Condition   `json:"conditions"`
}

// Validate validates the condition.
func (c *Condition) Validate() error {
	switch c.Type {
	case ConditionTypeThreshold:
		if c.MetricName == "" {
			return fmt.Errorf("metric_name is required for threshold condition")
		}
	case ConditionTypeAnomaly:
		if c.MetricName == "" {
			return fmt.Errorf("metric_name is required for anomaly condition")
		}
	case ConditionTypeComposite:
		if len(c.Conditions) < 2 {
			return fmt.Errorf("composite condition requires at least 2 sub-conditions")
		}
		for _, cond := range c.Conditions {
			if err := cond.Validate(); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("unsupported condition type: %s", c.Type)
	}
	return nil
}

// ConditionType represents the type of condition.
type ConditionType string

const (
	ConditionTypeThreshold ConditionType = "threshold"
	ConditionTypeAnomaly   ConditionType = "anomaly"
	ConditionTypeComposite ConditionType = "composite"
)

// NotificationConfig configures notifications for an alert rule.
type NotificationConfig struct {
	Channels []string       `json:"channels"`
	Email    *EmailConfig   `json:"email,omitempty"`
	Webhook  *WebhookConfig `json:"webhook,omitempty"`
}

// EmailConfig configures email notifications.
type EmailConfig struct {
	To       []string `json:"to"`
	Subject  string   `json:"subject"`
	Template string   `json:"template"`
}

// WebhookConfig configures webhook notifications.
type WebhookConfig struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
}

// RuleState tracks the state of a rule.
type RuleState struct {
	RuleID         string
	LastEvaluation time.Time
	Firing         bool
	Resolved       bool
	FiredAt        time.Time
	ResolvedAt     time.Time
	FiringCount    int
	LastValues     []float64
}

// EvaluationResult contains the result of a condition evaluation.
type EvaluationResult struct {
	Triggered bool
	Value     float64
	Threshold float64
	Operator  string
	Baseline  float64
	ZScore    float64
	Message   string
}

// getDefaultRules returns default alert rules.
func getDefaultRules() []*AlertRule {
	return []*AlertRule{
		{
			ID:          "system-cpu-high",
			Name:        "High CPU Usage",
			Description: "CPU usage exceeds 80% for 5 minutes",
			Service:     "system",
			Severity:    monitoring.AlertSeverityWarning,
			Enabled:     true,
			Schedule:    "@every 1m",
			For:         5,
			Condition: Condition{
				Type:        ConditionTypeThreshold,
				MetricName:  "cpu_usage",
				Operator:    "gt",
				Threshold:   80,
				Aggregation: "avg",
				TimeWindow:  5 * time.Minute,
			},
			Notification: &NotificationConfig{
				Channels: []string{"email", "websocket"},
			},
		},
		{
			ID:          "system-memory-high",
			Name:        "High Memory Usage",
			Description: "Memory usage exceeds 90% for 5 minutes",
			Service:     "system",
			Severity:    monitoring.AlertSeverityCritical,
			Enabled:     true,
			Schedule:    "@every 1m",
			For:         5,
			Condition: Condition{
				Type:        ConditionTypeThreshold,
				MetricName:  "memory_usage",
				Operator:    "gt",
				Threshold:   90,
				Aggregation: "avg",
				TimeWindow:  5 * time.Minute,
			},
		},
		{
			ID:          "api-error-rate",
			Name:        "High API Error Rate",
			Description: "API error rate exceeds 5% for 2 minutes",
			Service:     "api",
			Severity:    monitoring.AlertSeverityWarning,
			Enabled:     true,
			Schedule:    "@every 1m",
			For:         2,
			Condition: Condition{
				Type:        ConditionTypeThreshold,
				MetricName:  "api_error_rate",
				Operator:    "gt",
				Threshold:   5,
				Aggregation: "avg",
				TimeWindow:  2 * time.Minute,
			},
		},
	}
}
