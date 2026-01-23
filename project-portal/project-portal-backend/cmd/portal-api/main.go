package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/lib/pq"

	"github.com/gin-gonic/gin"

	"carbon-scribe/project-portal/project-portal-backend/internal/config"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Initialize database
	dbConfig := cfg.Database
	db, err := sql.Open("postgres", dbConfig.PostgresURL)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	// Ping database connection on startup
	if dbConfig.PingConnectionOnStartup {
		if err := db.Ping(); err != nil {
			log.Fatalf("failed to connect to database: %v", err)
		}
	}

	// Initialize Health Module
	// TODO: Add service and handler
	// healthRepo := health.NewRepository(db)
	// healthService := health.NewService(healthRepo)
	// healthHandler := health.NewHandler(healthService)

	// Setup Gin router
	gin.SetMode(cfg.Server.Mode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "carbonscribe-portal-api",
		})
	})

	// API v1 Group
	// v1 := router.Group("/api/v1")
	// {
	// 	// Register Health Routes
	// 	healthHandler.RegisterRoutes(v1)
	// }

	// Create HTTP server
	server := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on port %s", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create shutdown context with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer shutdownCancel()

	// Gracefully shutdown the server
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}
