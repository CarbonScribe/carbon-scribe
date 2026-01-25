package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/collaboration"
	"carbon-scribe/project-portal/project-portal-backend/internal/health"
	"carbon-scribe/project-portal/project-portal-backend/internal/integration"
	"carbon-scribe/project-portal/project-portal-backend/internal/reports"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config holds application configuration
type Config struct {
	Port        string
	DatabaseURL string
	Debug       bool
}

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using environment variables")
	}

	// Load configuration
	config := loadConfig()

	// Initialize database connection
	db, err := initDatabase(config)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	log.Println("✅ Database connection established")

	// Run all migrations
	if err := runAllMigrations(db); err != nil {
		log.Printf("⚠️ Migration warnings: %v", err)
	}

	// Initialize all services
	authHandler := &auth.Handler{}

	collabRepo := collaboration.NewRepository(db)
	collabService := collaboration.NewService(collabRepo)
	collabHandler := collaboration.NewHandler(collabService)

	healthRepo := health.NewRepository(db)
	healthService := health.NewService(healthRepo)
	healthHandler := health.NewHandler(healthService)

	integrationRepo := integration.NewRepository(db)
	integrationService := integration.NewService(integrationRepo)
	integrationHandler := integration.NewHandler(integrationService)

	reportsRepo := reports.NewRepository(db)
	reportsService := reports.NewService(reportsRepo, nil) // Exporter can be added later
	reportsHandler := reports.NewHandler(reportsService)

	// Setup Gin
	if !config.Debug {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Add CORS middleware
	router.Use(corsMiddleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "carbon-scribe-project-portal",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
			"modules":   []string{"auth", "collaboration", "integration", "reports"},
		})
	})

	// Root API route
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":    "CarbonScribe Project Portal API",
			"version": "1.0.0",
			"endpoints": gin.H{
				"health":        "/health",
				"auth":          "/api/auth/*",
				"collaboration": "/api/collaboration/*",
				"integration":   "/api/integration/*",
				"reports":       "/api/v1/reports/*",
			},
		})
	})

	// Auth routes
	auth.RegisterRoutes(router, authHandler)

	// Collaboration routes
	collaboration.RegisterRoutes(router, collabHandler)

	// Integration routes
	integration.RegisterRoutes(router, integrationHandler)

	// API v1 routes (for reports and future APIs)
	v1 := router.Group("/api/v1")
	{
		// Register reports routes under v1
		reportsHandler.RegisterRoutes(v1)

		// Register health routes under v1
		healthHandler.RegisterRoutes(v1)

		// Ping endpoint for testing
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong", "timestamp": time.Now().Unix()})
		})
	}

	// Create HTTP server with proper timeouts
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", config.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Channel to listen for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Start server in goroutine
	go func() {
		fmt.Printf("🚀 Server starting on port %s\n", config.Port)
		fmt.Printf("📡 Listening on http://localhost:%s\n", config.Port)
		fmt.Printf("📊 Health check: http://localhost:%s/health\n", config.Port)
		fmt.Println("🔗 Available endpoints:")
		fmt.Println("   - Authentication: /api/auth/*")
		fmt.Println("   - Collaboration: /api/collaboration/*")
		fmt.Println("   - System health metrics: /api/v1/health/*")
		fmt.Println("   - Integrations: /api/integration/*")
		fmt.Println("   - Reports: /api/v1/reports/*")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-quit
	fmt.Println("\n🛑 Shutdown signal received...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("❌ Server forced to shutdown: %v", err)
	}

	fmt.Println("✅ Server exited gracefully")
}

// loadConfig loads configuration from environment variables
func loadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://romeoscript@localhost:5432/carbonscribe_portal?sslmode=disable"
	}

	debug := os.Getenv("DEBUG") == "true" || os.Getenv("SERVER_MODE") == "development"

	return &Config{
		Port:        port,
		DatabaseURL: databaseURL,
		Debug:       debug,
	}
}

// initDatabase initializes the GORM database connection
func initDatabase(config *Config) (*gorm.DB, error) {
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	}

	if config.Debug {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	}

	db, err := gorm.Open(postgres.Open(config.DatabaseURL), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL DB and configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	return db, nil
}

// runAllMigrations runs migrations for all modules
func runAllMigrations(db *gorm.DB) error {
	// Auto-migrate all models from all modules
	err := db.AutoMigrate(
		// Collaboration models
		&collaboration.ProjectMember{},
		&collaboration.ProjectInvitation{},
		&collaboration.ActivityLog{},
		&collaboration.Comment{},
		&collaboration.Task{},
		&collaboration.SharedResource{},

		// Health models
		&health.SystemMetric{},
		&health.ServiceHealthCheck{},
		&health.HealthCheckResult{},
		&health.SystemAlert{},
		&health.ServiceDependency{},
		&health.SystemStatusSnapshot{},

		// Integration models
		&integration.IntegrationConnection{},
		&integration.WebhookConfig{},
		&integration.WebhookDelivery{},
		&integration.EventSubscription{},
		&integration.OAuthToken{},
		&integration.IntegrationHealth{},

		// Report models
		&reports.ReportDefinition{},
		&reports.ReportSchedule{},
		&reports.ReportExecution{},
		&reports.BenchmarkDataset{},
		&reports.DashboardWidget{},
	)

	if err != nil {
		return err
	}

	// Enable TimescaleDB extension and create hypertables
	db.Exec("CREATE EXTENSION IF NOT EXISTS timescaledb")

	// Helper to create hypertable if it doesn't exist
	createHypertable := func(tableName, timeCol string) error {
		var exists bool
		db.Raw("SELECT EXISTS (SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = ?)", tableName).Scan(&exists)
		if !exists {
			if err := db.Exec(fmt.Sprintf("SELECT create_hypertable('%s', '%s')", tableName, timeCol)).Error; err != nil {
				return fmt.Errorf("failed to create hypertable %s: %w", tableName, err)
			}
		}
		return nil
	}

	if err := createHypertable("system_metrics", "time"); err != nil {
		return err
	}
	if err := createHypertable("health_check_results", "check_time"); err != nil {
		return err
	}
	if err := createHypertable("system_status_snapshots", "snapshot_time"); err != nil {
		return err
	}

	return nil
}

// corsMiddleware adds CORS headers
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "*"
		}

		c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigins)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-User-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
