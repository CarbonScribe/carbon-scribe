package requests

import (
	"context"
	"fmt"
	"log"
	"time"
)

// RequestRepository defines the data access interface needed by the request processor.
type RequestRepository interface {
	GetPendingRequests(ctx context.Context, requestType string, limit int) (interface{}, error)
	UpdatePrivacyRequest(ctx context.Context, req interface{}) error
}

// Processor handles the lifecycle of privacy data subject requests.
type Processor struct {
	repo      interface{}
	exporter  *Exporter
	deleter   *Deleter
	discoverer *Discoverer
	verifier  *Verifier
}

// NewProcessor creates a new request processor with all sub-components.
func NewProcessor(repo interface{}) *Processor {
	discoverer := NewDiscoverer()
	return &Processor{
		repo:       repo,
		exporter:   NewExporter(discoverer),
		deleter:    NewDeleter(discoverer),
		discoverer: discoverer,
		verifier:   NewVerifier(),
	}
}

// ProcessExportRequest handles a data export request end-to-end.
func (p *Processor) ProcessExportRequest(ctx context.Context, userID string, categories []string, startDate, endDate *time.Time) (*ExportResult, error) {
	log.Printf("processing export request for user %s", userID)

	locations, err := p.discoverer.DiscoverUserData(ctx, userID, categories)
	if err != nil {
		return nil, fmt.Errorf("data discovery failed: %w", err)
	}

	result, err := p.exporter.Export(ctx, userID, locations, "json")
	if err != nil {
		return nil, fmt.Errorf("export failed: %w", err)
	}

	return result, nil
}

// ProcessDeletionRequest handles a data deletion request end-to-end.
func (p *Processor) ProcessDeletionRequest(ctx context.Context, userID string, categories []string) (*DeletionResult, error) {
	log.Printf("processing deletion request for user %s", userID)

	locations, err := p.discoverer.DiscoverUserData(ctx, userID, categories)
	if err != nil {
		return nil, fmt.Errorf("data discovery failed: %w", err)
	}

	result, err := p.deleter.Delete(ctx, userID, locations)
	if err != nil {
		return nil, fmt.Errorf("deletion failed: %w", err)
	}

	return result, nil
}

// ExportResult captures the outcome of a data export operation.
type ExportResult struct {
	UserID      string    `json:"user_id"`
	FileURL     string    `json:"file_url"`
	FileHash    string    `json:"file_hash"`
	Format      string    `json:"format"`
	SizeBytes   int64     `json:"size_bytes"`
	CompletedAt time.Time `json:"completed_at"`
}

// DeletionResult captures the outcome of a data deletion operation.
type DeletionResult struct {
	UserID          string                  `json:"user_id"`
	DeletedCategories []string              `json:"deleted_categories"`
	RetainedCategories []string             `json:"retained_categories"`
	Summary         map[string]CategoryResult `json:"summary"`
	CompletedAt     time.Time               `json:"completed_at"`
}

// CategoryResult holds the result for a single data category deletion.
type CategoryResult struct {
	RecordsDeleted int64  `json:"records_deleted"`
	Status         string `json:"status"`
	Reason         string `json:"reason,omitempty"`
}
