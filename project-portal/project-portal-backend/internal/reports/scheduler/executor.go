package scheduler

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Executor handles report execution
type Executor struct {
	reportExecutor ReportExecutor
	delivery       *DeliveryManager
	storage        StorageService
	logger         *zap.Logger
	config         ExecutorConfig
}

// ReportExecutor interface for report generation
type ReportExecutor interface {
	GenerateReport(ctx context.Context, reportID uuid.UUID, format string, params map[string]any) (*GeneratedReport, error)
}

// StorageService interface for file storage
type StorageService interface {
	Upload(ctx context.Context, key string, data []byte, contentType string) (string, error)
	GetSignedURL(ctx context.Context, key string, expiry time.Duration) (string, error)
}

// GeneratedReport represents a generated report
type GeneratedReport struct {
	Data        []byte    `json:"data"`
	ContentType string    `json:"content_type"`
	FileName    string    `json:"file_name"`
	RecordCount int       `json:"record_count"`
	GeneratedAt time.Time `json:"generated_at"`
}

// ExecutionRequest represents a report execution request
type ExecutionRequest struct {
	ReportDefinitionID uuid.UUID        `json:"report_definition_id"`
	ScheduleID         *uuid.UUID       `json:"schedule_id,omitempty"`
	TriggeredBy        *uuid.UUID       `json:"triggered_by,omitempty"`
	Format             string           `json:"format"`
	DeliveryMethod     string           `json:"delivery_method"`
	DeliveryConfig     map[string]any   `json:"delivery_config"`
	RecipientEmails    []string         `json:"recipient_emails,omitempty"`
	RecipientUserIDs   []uuid.UUID      `json:"recipient_user_ids,omitempty"`
	WebhookURL         *string          `json:"webhook_url,omitempty"`
	Parameters         map[string]any   `json:"parameters,omitempty"`
}

// ExecutionResult represents the result of report execution
type ExecutionResult struct {
	ExecutionID    uuid.UUID         `json:"execution_id"`
	Status         string            `json:"status"`
	RecordCount    int               `json:"record_count"`
	FileSizeBytes  int64             `json:"file_size_bytes"`
	FileKey        string            `json:"file_key,omitempty"`
	DownloadURL    string            `json:"download_url,omitempty"`
	DeliveryStatus map[string]string `json:"delivery_status,omitempty"`
	StartedAt      time.Time         `json:"started_at"`
	CompletedAt    time.Time         `json:"completed_at"`
	DurationMs     int64             `json:"duration_ms"`
	Error          string            `json:"error,omitempty"`
}

// ExecutorConfig configuration for the executor
type ExecutorConfig struct {
	MaxConcurrent       int           `json:"max_concurrent"`
	Timeout             time.Duration `json:"timeout"`
	RetryAttempts       int           `json:"retry_attempts"`
	RetryDelay          time.Duration `json:"retry_delay"`
	DownloadURLExpiry   time.Duration `json:"download_url_expiry"`
	MaxFileSizeBytes    int64         `json:"max_file_size_bytes"`
}

// DefaultExecutorConfig returns default configuration
func DefaultExecutorConfig() ExecutorConfig {
	return ExecutorConfig{
		MaxConcurrent:     10,
		Timeout:           30 * time.Minute,
		RetryAttempts:     3,
		RetryDelay:        time.Minute,
		DownloadURLExpiry: 24 * time.Hour,
		MaxFileSizeBytes:  100 * 1024 * 1024, // 100MB
	}
}

// NewExecutor creates a new executor
func NewExecutor(
	reportExecutor ReportExecutor,
	delivery *DeliveryManager,
	storage StorageService,
	logger *zap.Logger,
	config ExecutorConfig,
) *Executor {
	return &Executor{
		reportExecutor: reportExecutor,
		delivery:       delivery,
		storage:        storage,
		logger:         logger,
		config:         config,
	}
}

// Execute executes a report and delivers it
func (e *Executor) Execute(ctx context.Context, req *ExecutionRequest) (*ExecutionResult, error) {
	executionID := uuid.New()
	startTime := time.Now()

	e.logger.Info("Starting report execution",
		zap.String("execution_id", executionID.String()),
		zap.String("report_id", req.ReportDefinitionID.String()),
		zap.String("format", req.Format))

	result := &ExecutionResult{
		ExecutionID:    executionID,
		Status:         "processing",
		StartedAt:      startTime,
		DeliveryStatus: make(map[string]string),
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, e.config.Timeout)
	defer cancel()

	// Generate the report
	report, err := e.reportExecutor.GenerateReport(ctx, req.ReportDefinitionID, req.Format, req.Parameters)
	if err != nil {
		result.Status = "failed"
		result.Error = err.Error()
		result.CompletedAt = time.Now()
		result.DurationMs = time.Since(startTime).Milliseconds()
		return result, fmt.Errorf("report generation failed: %w", err)
	}

	result.RecordCount = report.RecordCount
	result.FileSizeBytes = int64(len(report.Data))

	// Check file size limit
	if result.FileSizeBytes > e.config.MaxFileSizeBytes {
		result.Status = "failed"
		result.Error = "report exceeds maximum file size"
		result.CompletedAt = time.Now()
		result.DurationMs = time.Since(startTime).Milliseconds()
		return result, fmt.Errorf("report exceeds maximum file size")
	}

	// Upload to storage
	fileKey := fmt.Sprintf("reports/%s/%s/%s", req.ReportDefinitionID.String(), time.Now().Format("2006-01-02"), report.FileName)
	uploadURL, err := e.storage.Upload(ctx, fileKey, report.Data, report.ContentType)
	if err != nil {
		e.logger.Error("Failed to upload report", zap.Error(err))
		result.Status = "failed"
		result.Error = fmt.Sprintf("upload failed: %v", err)
		result.CompletedAt = time.Now()
		result.DurationMs = time.Since(startTime).Milliseconds()
		return result, err
	}

	result.FileKey = fileKey

	// Generate download URL
	downloadURL, err := e.storage.GetSignedURL(ctx, fileKey, e.config.DownloadURLExpiry)
	if err != nil {
		e.logger.Warn("Failed to generate download URL", zap.Error(err))
	} else {
		result.DownloadURL = downloadURL
	}

	// Deliver the report
	deliveryResult, err := e.deliver(ctx, req, report, downloadURL)
	if err != nil {
		e.logger.Error("Failed to deliver report", zap.Error(err))
		result.DeliveryStatus["error"] = err.Error()
	} else {
		result.DeliveryStatus = deliveryResult
	}

	result.Status = "completed"
	result.CompletedAt = time.Now()
	result.DurationMs = time.Since(startTime).Milliseconds()

	e.logger.Info("Report execution completed",
		zap.String("execution_id", executionID.String()),
		zap.Int("record_count", result.RecordCount),
		zap.Int64("duration_ms", result.DurationMs))

	return result, nil
}

// deliver delivers the report using the specified method
func (e *Executor) deliver(ctx context.Context, req *ExecutionRequest, report *GeneratedReport, downloadURL string) (map[string]string, error) {
	status := make(map[string]string)

	switch req.DeliveryMethod {
	case "email":
		if len(req.RecipientEmails) > 0 {
			err := e.delivery.DeliverByEmail(ctx, &EmailDelivery{
				To:          req.RecipientEmails,
				Subject:     fmt.Sprintf("Report: %s", report.FileName),
				Body:        fmt.Sprintf("Your scheduled report is ready.\n\nDownload link: %s", downloadURL),
				Attachments: []Attachment{{Name: report.FileName, Data: report.Data, ContentType: report.ContentType}},
			})
			if err != nil {
				status["email"] = fmt.Sprintf("failed: %v", err)
			} else {
				status["email"] = "sent"
			}
		}

	case "s3":
		// Already uploaded, just record success
		status["s3"] = "uploaded"

	case "webhook":
		if req.WebhookURL != nil && *req.WebhookURL != "" {
			err := e.delivery.DeliverByWebhook(ctx, &WebhookDelivery{
				URL:         *req.WebhookURL,
				Payload: map[string]any{
					"report_id":    req.ReportDefinitionID.String(),
					"download_url": downloadURL,
					"record_count": report.RecordCount,
					"generated_at": report.GeneratedAt.Format(time.RFC3339),
				},
			})
			if err != nil {
				status["webhook"] = fmt.Sprintf("failed: %v", err)
			} else {
				status["webhook"] = "sent"
			}
		}

	case "notification":
		// Send internal notification (implementation depends on notification system)
		status["notification"] = "sent"

	default:
		status["method"] = fmt.Sprintf("unknown delivery method: %s", req.DeliveryMethod)
	}

	return status, nil
}

// ExecuteAsync executes a report asynchronously
func (e *Executor) ExecuteAsync(ctx context.Context, req *ExecutionRequest) (uuid.UUID, error) {
	executionID := uuid.New()

	go func() {
		// Create new context for async execution
		asyncCtx, cancel := context.WithTimeout(context.Background(), e.config.Timeout)
		defer cancel()

		result, err := e.Execute(asyncCtx, req)
		if err != nil {
			e.logger.Error("Async execution failed",
				zap.String("execution_id", executionID.String()),
				zap.Error(err))
		} else {
			e.logger.Info("Async execution completed",
				zap.String("execution_id", executionID.String()),
				zap.String("status", result.Status))
		}
	}()

	return executionID, nil
}

// GetContentType returns the content type for a report format
func GetContentType(format string) string {
	switch format {
	case "csv":
		return "text/csv"
	case "excel":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case "pdf":
		return "application/pdf"
	case "json":
		return "application/json"
	default:
		return "application/octet-stream"
	}
}

// GetFileExtension returns the file extension for a report format
func GetFileExtension(format string) string {
	switch format {
	case "csv":
		return ".csv"
	case "excel":
		return ".xlsx"
	case "pdf":
		return ".pdf"
	case "json":
		return ".json"
	default:
		return ""
	}
}
