package main

import (
	"database/sql"
	"log"
	"net/http"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/settings"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", "postgres://user:pass@localhost:5432/carbon_scribe?sslmode=disable")
	if err != nil {
		log.Fatal("Failed to connect to DB:", err)
	}
	defer db.Close()

	r := gin.Default()

	// ---------------- AUTH ----------------
	authService := auth.NewService()
	authHandler := auth.NewHandler(authService)
	auth.RegisterRoutes(r, authHandler)

	// ---------------- SETTINGS ----------------
	settingsRepo := settings.NewRepository(db)
	settingsService := settings.NewService(settingsRepo)
	_ = settings.NewHandler(settingsService)

	settingsGroup := r.Group("/settings")
	settings.RegisterRoutes(settingsGroup) // router group only

	// ---------------- PING ----------------
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "API alive!"})
	})

	log.Println("Server running on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
