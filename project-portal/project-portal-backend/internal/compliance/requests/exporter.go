package requests

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// Exporter generates data export packages in various formats.
type Exporter struct {
	discoverer *Discoverer
}

// NewExporter creates a new data exporter.
func NewExporter(discoverer *Discoverer) *Exporter {
	return &Exporter{discoverer: discoverer}
}

// Export builds a data export for the specified user and data locations.
func (e *Exporter) Export(ctx context.Context, userID string, locations []DataLocation, format string) (*ExportResult, error) {
	log.Printf("exporting data for user %s in format %s (%d locations)", userID, format, len(locations))

	exportData := make(map[string]interface{})
	exportData["user_id"] = userID
	exportData["export_date"] = time.Now().Format(time.RFC3339)
	exportData["data_categories"] = make(map[string]interface{})

	for _, loc := range locations {
		categoryData, ok := exportData["data_categories"].(map[string]interface{})
		if !ok {
			continue
		}
		categoryData[loc.Category] = map[string]interface{}{
			"source":        loc.Source,
			"record_count":  loc.RecordCount,
			"description":   loc.Description,
		}
	}

	data, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshaling export data: %w", err)
	}

	hash := sha256.Sum256(data)

	return &ExportResult{
		UserID:      userID,
		FileURL:     fmt.Sprintf("/exports/%s/%d.json", userID, time.Now().Unix()),
		FileHash:    fmt.Sprintf("%x", hash),
		Format:      format,
		SizeBytes:   int64(len(data)),
		CompletedAt: time.Now(),
	}, nil
}

// SupportedFormats returns the list of supported export formats.
func (e *Exporter) SupportedFormats() []string {
	return []string{"json", "xml", "csv"}
}
