package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"carbon-scribe/project-portal/project-portal-backend/internal/reports"
)

// ReportsAPI holds the reports API dependencies
type ReportsAPI struct {
	Handler    *reports.Handler
	Service    *reports.Service
	Repository reports.Repository
}

// SetupReportsAPI sets up the reports API with all dependencies
func SetupReportsAPI(db *sqlx.DB, logger *zap.Logger) (*ReportsAPI, error) {
	// Create repository
	repository := reports.NewPostgresRepository(db)

	// Create service
	service := reports.NewService(repository, logger)

	// Create handler
	handler := reports.NewHandler(service, logger)

	return &ReportsAPI{
		Handler:    handler,
		Service:    service,
		Repository: repository,
	}, nil
}

// RegisterReportsRoutes registers the reports routes on the router group
func RegisterReportsRoutes(router *gin.RouterGroup, api *ReportsAPI) {
	api.Handler.RegisterRoutes(router)
}

// ReportsConfig holds configuration for the reports API
type ReportsConfig struct {
	// S3 configuration for file storage
	S3Bucket    string `json:"s3_bucket"`
	S3Region    string `json:"s3_region"`
	S3AccessKey string `json:"s3_access_key"`
	S3SecretKey string `json:"s3_secret_key"`

	// Email configuration for report delivery
	SMTPHost         string `json:"smtp_host"`
	SMTPPort         int    `json:"smtp_port"`
	SMTPUsername     string `json:"smtp_username"`
	SMTPPassword     string `json:"smtp_password"`
	EmailFromAddress string `json:"email_from_address"`
	EmailFromName    string `json:"email_from_name"`

	// Cache configuration
	CacheTTLSeconds int `json:"cache_ttl_seconds"`

	// Worker configuration
	MaxConcurrentJobs int `json:"max_concurrent_jobs"`
	JobTimeoutMinutes int `json:"job_timeout_minutes"`
}

// DefaultReportsConfig returns default reports configuration
func DefaultReportsConfig() ReportsConfig {
	return ReportsConfig{
		S3Bucket:          "carbonscribe-reports",
		S3Region:          "us-east-1",
		CacheTTLSeconds:   300,
		MaxConcurrentJobs: 10,
		JobTimeoutMinutes: 30,
	}
}
