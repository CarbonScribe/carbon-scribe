package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"go.uber.org/zap"

	"carbon-scribe/project-portal/project-portal-backend/internal/config"
	"carbon-scribe/project-portal/project-portal-backend/internal/reports"
)

func main() {
	// Initialize logger
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	// Load configuration
	cfg, err := config.LoadConfig("config.json")
	if err != nil {
		logger.Warn("Failed to load config file, using environment variables", zap.Error(err))
		cfg = &config.Config{
			Server: config.ServerConfig{
				Host: "0.0.0.0",
				Port: 8080,
			},
			Database: config.DatabaseConfig{
				// Fallback defaults if env vars missing
				Host:           os.Getenv("DATABASE_HOST"),
				Port:           5432,
				User:           os.Getenv("DATABASE_USER"),
				Password:       os.Getenv("DATABASE_PASSWORD"),
				DBName:         os.Getenv("DATABASE_DBNAME"),
				SSLMode:        "disable",
				MaxConnections: 25,
				MaxIdleConns:   5,
			},
		}
		if cfg.Database.Host == "" {
			cfg.Database.Host = "localhost"
		}
		cfg.Database.User = os.Getenv("USER")

		if cfg.Database.DBName == "" {
			cfg.Database.DBName = "carbonscribe_portal"
		}
	}

	// Connect to database
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
		cfg.Database.SSLMode,
	)

	logger.Info("Connecting to database", zap.String("url", dbURL))
	db, err := sqlx.Connect("postgres", dbURL)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Initialize Reporting Module
	reportsRepo := reports.NewPostgresRepository(db)
	reportsService := reports.NewService(reportsRepo, logger)
	reportsHandler := reports.NewHandler(reportsService, logger)

	// Setup Router
	gin.SetMode(gin.DebugMode)
	router := gin.Default()

	// CORS Middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Register Routes
	api := router.Group("/api/v1")
	{
		reportsHandler.RegisterRoutes(api)
	}

	// Health Check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "healthy",
			"timestamp": time.Now(),
		})
	})

	// Start Server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("listen: %s\n", zap.Error(err))
		}
	}()

	logger.Info("Server started", zap.Int("port", cfg.Server.Port))

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown:", zap.Error(err))
	}

	logger.Info("Server exiting")
}
