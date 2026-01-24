package main

import (
	"log"
	"os"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/collaboration"
	"carbon-scribe/project-portal/project-portal-backend/internal/integration"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Database connection
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=carbonscribe_portal port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
	} else {
		// Auto Migrate
		err = db.AutoMigrate(
			&collaboration.ProjectMember{},
			&collaboration.ProjectInvitation{},
			&collaboration.ActivityLog{},
			&collaboration.Comment{},
			&collaboration.Task{},
			&collaboration.SharedResource{},
			// Integrations
			&integration.IntegrationConnection{},
			&integration.WebhookConfig{},
			&integration.WebhookDelivery{},
			&integration.EventSubscription{},
			&integration.OAuthToken{},
			&integration.IntegrationHealth{},
		)
		if err != nil {
			log.Printf("Failed to migrate database: %v", err)
		}
	}

	r := gin.Default()

	// Auth
	authHandler := &auth.Handler{}
	auth.RegisterRoutes(r, authHandler)

	// Collaboration
	collabRepo := collaboration.NewRepository(db)
	collabService := collaboration.NewService(collabRepo)
	collabHandler := collaboration.NewHandler(collabService)
	collaboration.RegisterRoutes(r, collabHandler)

	// Integrations
	integrationRepo := integration.NewRepository(db)
	integrationService := integration.NewService(integrationRepo)
	integrationHandler := integration.NewHandler(integrationService)
	integration.RegisterRoutes(r, integrationHandler)

	r.Run(":8080") // Server on port 8080
}
