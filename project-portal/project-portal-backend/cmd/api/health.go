package main

import (
	"context"
	"net/http"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/elastic"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

// HealthHandler returns a gin.HandlerFunc that performs live health checks on Postgres, Elasticsearch, and MongoDB.
func HealthHandler(db *gorm.DB, esClient *elastic.Client, mongoClient *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		const probeTimeout = 2 * time.Second

		var (
			pgStatus    = "healthy"
			esStatus    = "healthy"
			mongoStatus = "healthy"
			wg          sync.WaitGroup
			mu          sync.Mutex
		)

		wg.Add(3)

		// Probe PostgreSQL connectivity
		go func() {
			defer wg.Done()
			status := "healthy"
			if db == nil {
				status = "unhealthy"
			} else {
				sqlDB, err := db.DB()
				if err != nil {
					status = "unhealthy"
				} else {
					ctx, cancel := context.WithTimeout(c.Request.Context(), probeTimeout)
					defer cancel()
					if err := sqlDB.PingContext(ctx); err != nil {
						status = "unhealthy"
					}
				}
			}
			mu.Lock()
			pgStatus = status
			mu.Unlock()
		}()

		// Probe Elasticsearch connectivity using existing esClient.Health(ctx)
		go func() {
			defer wg.Done()
			status := "healthy"
			if esClient == nil {
				status = "unhealthy"
			} else {
				ctx, cancel := context.WithTimeout(c.Request.Context(), probeTimeout)
				defer cancel()
				if err := esClient.Health(ctx); err != nil {
					status = "unhealthy"
				}
			}
			mu.Lock()
			esStatus = status
			mu.Unlock()
		}()

		// Probe MongoDB connectivity using mongoClient.Ping(ctx, nil)
		go func() {
			defer wg.Done()
			status := "healthy"
			if mongoClient == nil {
				status = "unhealthy"
			} else {
				ctx, cancel := context.WithTimeout(c.Request.Context(), probeTimeout)
				defer cancel()
				if err := mongoClient.Ping(ctx, nil); err != nil {
					status = "unhealthy"
				}
			}
			mu.Lock()
			mongoStatus = status
			mu.Unlock()
		}()

		wg.Wait()

		allHealthy := pgStatus == "healthy" && esStatus == "healthy" && mongoStatus == "healthy"

		overallStatus := "healthy"
		httpStatus := http.StatusOK
		if !allHealthy {
			overallStatus = "unhealthy"
			httpStatus = http.StatusServiceUnavailable
		}

		c.JSON(httpStatus, gin.H{
			"status":    overallStatus,
			"service":   "carbon-scribe-project-portal",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
			"modules":   []string{"auth", "collaboration", "documents", "integration", "reports", "search", "geospatial", "settings", "financing", "inventory", "notifications", "monitoring"},
			"dependencies": gin.H{
				"postgres":      pgStatus,
				"elasticsearch": esStatus,
				"mongodb":       mongoStatus,
			},
		})
	}
}
