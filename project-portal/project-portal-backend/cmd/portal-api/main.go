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

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	"carbon-scribe/project-portal/project-portal-backend/internal/config"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/calculation"
	"carbon-scribe/project-portal/project-portal/backend/internal/financing/tokenization"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/sales"
	"carbon-scribe/project-portal/project-portal/backend/internal/financing/payments"
	"carbon-scribe/project-portal/project-portal-backend/internal/documents"
	"carbon-scribe/project-portal/project-portal-backend/pkg/storage"
	"carbon-scribe/project-portal/project-portal-backend/pkg/pdf"
	"carbon-scribe/project-portal/project-portal-backend/pkg/security"
)

func main() {
	// Load configuration
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config.json"
	}

	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection
	db, err := sqlx.Connect("postgres", cfg.Database.GetDatabaseURL())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run database migrations
	if err := runMigrations(db, cfg.Database.MigrationsPath); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize repositories
	repository := financing.NewSQLRepository(db)

	// Initialize services
	calculationEngine := calculation.NewEngine()
	
	// Initialize Stellar client
	issuerAccount := &tokenization.StellarAccount{
		PublicKey: getStellarPublicKey(cfg.Stellar.IssuerAccount.SecretKey),
		SecretKey: cfg.Stellar.IssuerAccount.SecretKey,
	}

	stellarClient := tokenization.NewStellarClient(
		cfg.Stellar.HorizonURL,
		cfg.Stellar.SorobanURL,
		cfg.Stellar.NetworkPassphrase,
		issuerAccount,
	)

	// Initialize workflow
	workflowConfig := &tokenization.WorkflowConfig{
		MaxRetries:          cfg.Financing.TokenMinting.MaxRetries,
		RetryDelay:          cfg.Financing.TokenMinting.RetryDelay,
		ConfirmationTimeout:   cfg.Financing.TokenMinting.ConfirmationTimeout,
		BatchSize:           cfg.Financing.TokenMinting.MaxBatchSize,
		GasOptimization:     cfg.Financing.TokenMinting.GasOptimization,
	}

	tokenizationWorkflow := tokenization.NewWorkflow(stellarClient, repository, nil, workflowConfig)

	// Initialize managers
	pricingEngine := sales.NewPricingEngine(repository, &sales.PricingConfig{
		DefaultBasePrice:     cfg.Financing.Pricing.DefaultBasePrice,
		PriceVarianceLimit:   cfg.Financing.Pricing.PriceVarianceLimit,
		MinPrice:            cfg.Financing.Pricing.MinPrice,
		MaxPrice:            cfg.Financing.Pricing.MaxPrice,
		QualityWeight:        cfg.Financing.Pricing.QualityWeight,
		VintageWeight:        cfg.Financing.Pricing.VintageWeight,
		RegionWeight:         cfg.Financing.Pricing.RegionWeight,
		MarketWeight:         cfg.Financing.Pricing.MarketWeight,
		OracleWeight:         cfg.Financing.Pricing.OracleWeight,
		PriceUpdateInterval:  cfg.Financing.Pricing.PriceUpdateInterval,
	})

	forwardSaleManager := sales.NewForwardSaleManager(repository, pricingEngine, &sales.ForwardSaleConfig{
		MinDepositPercent:     cfg.Financing.ForwardSales.MinDepositPercent,
		MaxDepositPercent:     cfg.Financing.ForwardSales.MaxDepositPercent,
		DefaultDepositPercent: cfg.Financing.ForwardSales.DefaultDepositPercent,
		MinDeliveryDays:       cfg.Financing.ForwardSales.MinDeliveryDays,
		MaxDeliveryDays:       cfg.Financing.ForwardSales.MaxDeliveryDays,
		ContractValidityDays:  cfg.Financing.ForwardSales.ContractValidityDays,
		AutoCancelDays:        cfg.Financing.ForwardSales.AutoCancelDays,
		PriceAdjustmentRate:   cfg.Financing.ForwardSales.PriceAdjustmentRate,
	})

	auctionManager := sales.NewAuctionManager(repository, pricingEngine, &sales.AuctionConfig{
		MinBidIncrement:      cfg.Financing.Auctions.MinBidIncrement,
		MaxBidIncrement:      cfg.Financing.Auctions.MaxBidIncrement,
		DefaultBidIncrement:  cfg.Financing.Auctions.DefaultBidIncrement,
		MinReservePrice:      cfg.Financing.Auctions.MinReservePrice,
		MaxReservePrice:      cfg.Financing.Auctions.MaxReservePrice,
		DefaultReservePrice:  cfg.Financing.Auctions.DefaultReservePrice,
		AutoExtendMinutes:     cfg.Financing.Auctions.AutoExtendMinutes,
		BidDepositPercent:    cfg.Financing.Auctions.BidDepositPercent,
		MaxActiveAuctions:    cfg.Financing.Auctions.MaxActiveAuctions,
		AuctionDurationHours:  cfg.Financing.Auctions.AuctionDurationHours,
	})

	paymentRegistry := payments.NewPaymentProcessorRegistry(&payments.ProcessorConfig{
		Stripe:      cfg.Payments.Stripe,
		PayPal:      cfg.Payments.PayPal,
		M_Pesa:      cfg.Payments.M_Pesa,
		BankTransfer: cfg.Payments.BankTransfer,
	})

	distributionManager := payments.NewRevenueDistributionManager(repository, &payments.DistributionConfig{
		DefaultPlatformFee:    cfg.Financing.RevenueDistribution.DefaultPlatformFee,
		MinPlatformFee:        cfg.Financing.RevenueDistribution.MinPlatformFee,
		MaxPlatformFee:        cfg.Financing.RevenueDistribution.MaxPlatformFee,
		MinDistributionAmount:  cfg.Financing.RevenueDistribution.MinDistributionAmount,
		MaxBatchSize:          cfg.Financing.RevenueDistribution.MaxBatchSize,
		PaymentTimeoutMinutes:  cfg.Financing.RevenueDistribution.PaymentTimeoutMinutes,
		RetryAttempts:         cfg.Financing.RevenueDistribution.RetryAttempts,
		RetryDelayMinutes:     cfg.Financing.RevenueDistribution.RetryDelayMinutes,
		AutoApproveThreshold:   cfg.Financing.RevenueDistribution.AutoApproveThreshold,
	})

	// Initialize service layer
	financingService := financing.NewService(
		repository,
		calculationEngine,
		tokenizationWorkflow,
		forwardSaleManager,
		pricingEngine,
		auctionManager,
		distributionManager,
		paymentRegistry,
	)

	// Initialize HTTP handlers
	financingHandler := financing.NewHandler(
		calculationEngine,
		tokenizationWorkflow,
		forwardSaleManager,
		pricingEngine,
		auctionManager,
		distributionManager,
		paymentRegistry,
	)

	// Initialize Document Management
	docRepo := documents.NewRepository(db)
	s3Client := storage.NewS3Client()
	ipfsClient := storage.NewIPFSClient()
	storageProvider := documents.NewStorageProvider(s3Client, ipfsClient)
	pdfGenerator := pdf.NewGenerator()
	pdfService := documents.NewPDFService(pdfGenerator)
	signatureValidator := security.NewValidator()
	signatureService := documents.NewSignatureService(signatureValidator)
	workflowService := documents.NewWorkflowService(docRepo)

	docService := documents.NewService(docRepo, storageProvider, pdfService, signatureService, workflowService)
	docHandler := documents.NewHandler(docService)

	// Setup Gin router
	router := setupRouter(cfg, financingHandler, docHandler)

	// Start HTTP server
	server := &http.Server{
		Addr:         cfg.Server.GetServerAddr(),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

		<-sigChan
		log.Println("Shutting down server...")

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
	}()

	log.Printf("Starting server on %s", cfg.Server.GetServerAddr())
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}

	log.Println("Server stopped")
}

// setupRouter sets up the Gin router with middleware and routes
func setupRouter(cfg *config.Config, financingHandler *financing.Handler, docHandler *documents.Handler) *gin.Engine {
	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)

	// Create router
	router := gin.New()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())
	router.Use(corsMiddleware(cfg.Security.CORS))
	router.Use(rateLimitMiddleware(cfg.Security.RateLimiting))
	router.Use(requestIDMiddleware())

	// Health check endpoint
	router.GET("/health", healthCheck)

	// API version 1 routes
	v1 := router.Group("/api/v1")
	{
		// Register financing routes
		financingHandler.RegisterRoutes(v1)

		// Register document routes
		docHandler.RegisterRoutes(v1)

		// TODO: Add other module routes (projects, users, etc.)
	}

	return router
}

// corsMiddleware adds CORS headers
func corsMiddleware(corsConfig config.CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		
		// Check if origin is allowed
		allowed := false
		for _, allowedOrigin := range corsConfig.AllowedOrigins {
			if allowedOrigin == "*" || allowedOrigin == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Expose-Headers", "Content-Length")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
	"carbon-scribe/project-portal/project-portal-backend/internal/config"
	"carbon-scribe/project-portal/project-portal-backend/internal/geospatial"
	"carbon-scribe/project-portal/project-portal-backend/pkg/postgis"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
	"gorm.io/gorm/logger"
)

func main() {
	// Load .env file (ignore error if not found - will use system env vars)
	_ = godotenv.Load()

	// Initialize logger
	zapLogger, err := initLogger()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer zapLogger.Sync()

	zapLogger.Info("Starting CarbonScribe Project Portal API")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		zapLogger.Fatal("Failed to load configuration", zap.Error(err))
	}

	zapLogger.Info("Configuration loaded",
		zap.String("mode", cfg.Server.Mode),
		zap.Int("port", cfg.Server.Port))

	// Initialize database
	dbClient, err := initDatabase(cfg, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer dbClient.Close()

	zapLogger.Info("Database connection established")

	// Initialize services
	geospatialService := geospatial.NewService(dbClient.DB, zapLogger)

	// Initialize handlers
	geospatialHandler := geospatial.NewHandler(geospatialService, zapLogger)

	// Setup Gin
	if cfg.Server.Mode == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())

	// Health check endpoint
	router.GET("/health", healthHandler(dbClient))

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		geospatialHandler.RegisterRoutes(v1)
	}

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start server in goroutine
	go func() {
		zapLogger.Info("Server starting",
			zap.String("address", srv.Addr))

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Error("Server forced to shutdown", zap.Error(err))
	}

	zapLogger.Info("Server exited")
}

// initLogger initializes the zap logger
func initLogger() (*zap.Logger, error) {
	env := os.Getenv("SERVER_MODE")
	if env == "production" {
		return zap.NewProduction()
	}
	return zap.NewDevelopment()
}

// initDatabase initializes the database connection
func initDatabase(cfg *config.Config, logger *zap.Logger) (*postgis.Client, error) {
	logLevel := logger.Info
	if cfg.Logging.Level == "debug" {
		logLevel = logger.Debug
	}

	gormLogLevel := logger.Default
	if cfg.Server.Mode == "production" {
		gormLogLevel = logger.Error
	}

	dbConfig := &postgis.Config{
		Host:         cfg.Database.Host,
		Port:         cfg.Database.Port,
		User:         cfg.Database.User,
		Password:     cfg.Database.Password,
		DBName:       cfg.Database.DBName,
		SSLMode:      cfg.Database.SSLMode,
		MaxOpenConns: cfg.Database.MaxOpenConns,
		MaxIdleConns: cfg.Database.MaxIdleConns,
		LogLevel:     gormLogLevel,
	}

	client, err := postgis.NewClient(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Test connection
	if err := client.Health(); err != nil {
		return nil, fmt.Errorf("database health check failed: %w", err)
	}

	logLevel("Database connection successful")

	return client, nil
}

// healthHandler returns a health check handler
func healthHandler(dbClient *postgis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check database
		if err := dbClient.Health(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":   "unhealthy",
				"database": "disconnected",
				"error":    err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"database":  "connected",
			"timestamp": time.Now().Unix(),
			"service":   "carbonscribe-project-portal",
		})
	}
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
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// rateLimitMiddleware adds rate limiting
func rateLimitMiddleware(rateLimitConfig config.RateLimitConfig) gin.HandlerFunc {
	if !rateLimitConfig.Enabled {
		return gin.HandlerFunc(func(c *gin.Context) {
			c.Next()
		})
	}

	// TODO: Implement actual rate limiting
	// For now, just pass through
	return gin.HandlerFunc(func(c *gin.Context) {
		c.Next()
	})
}

// requestIDMiddleware adds a unique request ID
func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// healthCheck returns the health status of the service
func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
		"service":   "carbon-scribe-financing",
	})
}

// runMigrations runs database migrations
func runMigrations(db *sqlx.DB, migrationsPath string) error {
	// TODO: Implement proper migration runner
	// For now, just log that migrations would run
	log.Printf("Would run migrations from: %s", migrationsPath)
	return nil
}

// getStellarPublicKey extracts public key from secret seed
func getStellarPublicKey(secretSeed string) string {
	// In a real implementation, this would properly decode the Stellar secret seed
	// For now, return a mock public key
	return "GABCDEF1234567890ABCDEF1234567890ABCDEF12"
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	// Simple request ID generation
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}
	v1 "carbon-scribe/project-portal/project-portal-backend/api/v1"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func main() {
	// Load configuration
	config := loadConfig()

	// Connect to database
	db, err := sqlx.Connect("postgres", config.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}
	fmt.Println("✅ Connected to database")

	// Initialize repository
	repo := monitoring.NewPostgresRepository(db)

	// Setup monitoring dependencies
	handler, satelliteIngestion, iotIngestion, alertEngine, err := v1.SetupDependencies(repo)
	if err != nil {
		log.Fatalf("Failed to setup monitoring dependencies: %v", err)
	}
	fmt.Println("✅ Monitoring dependencies initialized")

	// Create Gin router
	router := gin.Default()

	// Add CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	})

	// Register API routes
	api := router.Group("/api/v1")
	v1.RegisterMonitoringRoutes(api, handler)

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"service": "carbon-scribe-monitoring",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// Start HTTP server
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", config.Port),
		Handler: router,
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

	fmt.Println("✅ Monitoring API server started")
	fmt.Printf("📡 Listening on http://localhost:%s\n", config.Port)
	fmt.Println("📊 Health check: http://localhost:" + config.Port + "/health")

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

// Config holds application configuration
type Config struct {
	Port        string
	DatabaseURL string
	Debug       bool
}

// loadConfig loads configuration from environment variables
func loadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@localhost:5432/carbon_scribe?sslmode=disable"
	}

	debug := os.Getenv("DEBUG") == "true"

	return &Config{
		Port:        port,
		DatabaseURL: databaseURL,
		Debug:       debug,
	}
}
