package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/alerts"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// AlertWorker periodically evaluates alert rules and sends notifications
type AlertWorker struct {
	repo              monitoring.Repository
	engine            *alerts.Engine
	notificationSvc   *alerts.NotificationService
	evaluationInterval time.Duration
}

// NewAlertWorker creates a new alert evaluation worker
func NewAlertWorker(db *sqlx.DB, evaluationInterval time.Duration) *AlertWorker {
	// Initialize repository
	repo := monitoring.NewPostgresRepository(db)
	
	// Initialize alert engine
	engine := alerts.NewEngine(repo)
	
	// Initialize notification service
	notificationSvc := alerts.NewNotificationService(
		&alerts.EmailConfig{
			SMTPHost:    os.Getenv("SMTP_HOST"),
			SMTPPort:    587,
			Username:    os.Getenv("SMTP_USERNAME"),
			Password:    os.Getenv("SMTP_PASSWORD"),
			FromAddress: os.Getenv("SMTP_FROM_ADDRESS"),
			FromName:    "CarbonScribe Monitoring",
		},
		&alerts.SMSConfig{
			Provider:   os.Getenv("SMS_PROVIDER"),
			AccountID:  os.Getenv("SMS_ACCOUNT_ID"),
			AuthToken:  os.Getenv("SMS_AUTH_TOKEN"),
			FromNumber: os.Getenv("SMS_FROM_NUMBER"),
		},
		&alerts.WebhookConfig{
			URL:     os.Getenv("WEBHOOK_URL"),
			Headers: map[string]string{"Content-Type": "application/json"},
			Timeout: 30 * time.Second,
		},
	)
	
	return &AlertWorker{
		repo:              repo,
		engine:            engine,
		notificationSvc:   notificationSvc,
		evaluationInterval: evaluationInterval,
	}
}

// Start begins the alert evaluation loop
func (w *AlertWorker) Start(ctx context.Context) error {
	fmt.Printf("Starting alert worker with %v evaluation interval\n", w.evaluationInterval)
	
	// Start notification worker
	notificationWorker := alerts.NewNotificationWorker(w.repo, w.notificationSvc, w.engine.GetNotificationQueue())
	go notificationWorker.Start(ctx)
	
	ticker := time.NewTicker(w.evaluationInterval)
	defer ticker.Stop()
	
	// Initial evaluation
	if err := w.evaluateAllProjects(ctx); err != nil {
		fmt.Printf("Initial evaluation failed: %v\n", err)
	}
	
	for {
		select {
		case <-ctx.Done():
			fmt.Println("Alert worker stopping...")
			return nil
			
		case <-ticker.C:
			if err := w.evaluateAllProjects(ctx); err != nil {
				fmt.Printf("Scheduled evaluation failed: %v\n", err)
			}
		}
	}
}

// evaluateAllProjects evaluates alert rules for all projects with recent activity
func (w *AlertWorker) evaluateAllProjects(ctx context.Context) error {
	fmt.Printf("[%s] Starting alert evaluation\n", time.Now().Format("2006-01-02 15:04:05"))
	
	// Get projects with recent monitoring activity (last 7 days)
	projects, err := w.getActiveProjects(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active projects: %w", err)
	}
	
	evaluated := 0
	for _, projectID := range projects {
		if err := w.engine.EvaluateRules(ctx, projectID); err != nil {
			fmt.Printf("Failed to evaluate rules for project %s: %v\n", projectID, err)
			continue
		}
		evaluated++
	}
	
	fmt.Printf("[%s] Alert evaluation completed. Evaluated %d projects\n", 
		time.Now().Format("2006-01-02 15:04:05"), evaluated)
	
	return nil
}

// getActiveProjects retrieves projects that have had recent monitoring activity
func (w *AlertWorker) getActiveProjects(ctx context.Context) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT project_id 
		FROM (
			SELECT project_id FROM satellite_observations WHERE time > NOW() - INTERVAL '7 days'
			UNION
			SELECT project_id FROM sensor_readings WHERE time > NOW() - INTERVAL '7 days'
			UNION
			SELECT project_id FROM project_metrics WHERE time > NOW() - INTERVAL '7 days'
		) AS active_projects
	`
	
	rows, err := w.repo.(*monitoring.PostgresRepository).(*sqlx.DB).QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active projects: %w", err)
	}
	defer rows.Close()
	
	var projects []uuid.UUID
	for rows.Next() {
		var projectIDStr string
		if err := rows.Scan(&projectIDStr); err != nil {
			return nil, fmt.Errorf("failed to scan project ID: %w", err)
		}
		
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			fmt.Printf("Invalid project ID %s: %v\n", projectIDStr, err)
			continue
		}
		
		projects = append(projects, projectID)
	}
	
	return projects, nil
}

func main() {
	// Load configuration
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://user:password@localhost:5432/carbon_scribe?sslmode=disable"
	}
	
	intervalStr := os.Getenv("EVALUATION_INTERVAL")
	if intervalStr == "" {
		intervalStr = "5m" // Default to every 5 minutes
	}
	
	interval, err := time.ParseDuration(intervalStr)
	if err != nil {
		fmt.Printf("Invalid interval: %v\n", err)
		os.Exit(1)
	}

	// Connect to database
	db, err := sqlx.Connect("postgres", dbURL)
	if err != nil {
		fmt.Printf("Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create worker
	worker := NewAlertWorker(db, interval)

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start worker in goroutine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := worker.Start(ctx); err != nil {
			fmt.Printf("Worker error: %v\n", err)
			cancel()
		}
	}()

	// Wait for shutdown signal
	<-sigChan
	fmt.Println("\nReceived shutdown signal, stopping worker...")
	cancel()
	
	// Give some time for graceful shutdown
	time.Sleep(5 * time.Second)
	fmt.Println("Alert worker stopped")
}
