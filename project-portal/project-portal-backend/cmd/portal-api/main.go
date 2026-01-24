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

	"carbon-scribe/project-portal/project-portal-backend/internal/reports"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
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
	// Load configuration
	config := loadConfig()

	// Initialize database connection
	db, err := initDatabase(config)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Println("✅ Database connection established")

	// Run migrations for reports module
	if err := runMigrations(db); err != nil {
		log.Printf("Warning: Migration check failed: %v", err)
	}

	// Initialize services
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
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Register reports routes
		reportsHandler.RegisterRoutes(v1)

		// Ping endpoint for testing
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong"})
		})
	}

	// Create HTTP server
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
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	fmt.Println("✅ CarbonScribe Portal API server started")
	fmt.Printf("📡 Listening on http://localhost:%s\n", config.Port)
	fmt.Printf("📊 Health check: http://localhost:%s/health\n", config.Port)
	fmt.Println("📈 Reports API: /api/v1/reports")

	// Wait for interrupt signal
	<-quit
	fmt.Println("\n🛑 Shutdown signal received...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
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

// runMigrations runs automatic migrations for report models
func runMigrations(db *gorm.DB) error {
	// Auto-migrate the reports models
	return db.AutoMigrate(
		&reports.ReportDefinition{},
		&reports.ReportSchedule{},
		&reports.ReportExecution{},
		&reports.BenchmarkDataset{},
		&reports.DashboardWidget{},
	)
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
