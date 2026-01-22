package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// SatelliteWorker periodically fetches satellite data for registered projects
type SatelliteWorker struct {
	db               *sqlx.DB
	satelliteFetcher *ingestion.SatelliteDataFetcher
	interval         time.Duration
	projects         []string
	sources          []string
}

// NewSatelliteWorker creates a new satellite data worker
func NewSatelliteWorker(db *sqlx.DB, interval time.Duration) *SatelliteWorker {
	// Initialize repository
	repo := monitoring.NewPostgresRepository(db)
	
	// Initialize satellite ingestion
	satelliteIngestion := ingestion.NewSatelliteIngestion(repo)
	
	// Initialize fetcher
	fetcher := ingestion.NewSatelliteDataFetcher(satelliteIngestion)
	
	// TODO: Register actual API clients for each satellite source
	// fetcher.RegisterAPIClient("sentinel2", &Sentinel2Client{})
	// fetcher.RegisterAPIClient("planet", &PlanetLabsClient{})
	
	return &SatelliteWorker{
		db:               db,
		satelliteFetcher: fetcher,
		interval:         interval,
		projects:         []string{}, // Will be populated from DB
		sources:          []string{"sentinel2", "planet"},
	}
}

// Start begins the satellite data fetching loop
func (w *SatelliteWorker) Start(ctx context.Context) error {
	fmt.Printf("Starting satellite worker with %v interval\n", w.interval)
	
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	
	// Initial fetch
	if err := w.fetchData(ctx); err != nil {
		fmt.Printf("Initial fetch failed: %v\n", err)
	}
	
	for {
		select {
		case <-ctx.Done():
			fmt.Println("Satellite worker stopping...")
			return nil
			
		case <-ticker.C:
			if err := w.fetchData(ctx); err != nil {
				fmt.Printf("Scheduled fetch failed: %v\n", err)
			}
		}
	}
}

// fetchData fetches satellite data for all projects
func (w *SatelliteWorker) fetchData(ctx context.Context) error {
	fmt.Printf("[%s] Starting satellite data fetch for %d projects\n", 
		time.Now().Format("2006-01-02 15:04:05"), len(w.projects))
	
	// Look back 30 days for new data
	lookbackDays := 30
	
	if err := w.satelliteFetcher.ScheduledFetch(ctx, w.projects, w.sources, lookbackDays); err != nil {
		return fmt.Errorf("failed to fetch satellite data: %w", err)
	}
	
	fmt.Printf("[%s] Satellite data fetch completed\n", time.Now().Format("2006-01-02 15:04:05"))
	return nil
}

// loadProjects loads project IDs from database
func (w *SatelliteWorker) loadProjects(ctx context.Context) error {
	// Query active projects that have satellite monitoring enabled
	query := `
		SELECT DISTINCT project_id 
		FROM satellite_observations 
		WHERE time > NOW() - INTERVAL '90 days'
	`
	
	rows, err := w.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query projects: %w", err)
	}
	defer rows.Close()
	
	var projects []string
	for rows.Next() {
		var projectID string
		if err := rows.Scan(&projectID); err != nil {
			return fmt.Errorf("failed to scan project ID: %w", err)
		}
		projects = append(projects, projectID)
	}
	
	w.projects = projects
	fmt.Printf("Loaded %d projects for satellite monitoring\n", len(projects))
	return nil
}

func main() {
	// Load configuration
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://user:password@localhost:5432/carbon_scribe?sslmode=disable"
	}
	
	intervalStr := os.Getenv("FETCH_INTERVAL")
	if intervalStr == "" {
		intervalStr = "24h" // Default to once per day
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
	worker := NewSatelliteWorker(db, interval)
	
	// Load projects
	ctx := context.Background()
	if err := worker.loadProjects(ctx); err != nil {
		fmt.Printf("Failed to load projects: %v\n", err)
		os.Exit(1)
	}

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
	time.Sleep(2 * time.Second)
	fmt.Println("Satellite worker stopped")
}
