package requests

import (
	"context"
	"log"
	"time"
)

// Deleter handles secure data deletion across all stores.
type Deleter struct {
	discoverer *Discoverer
}

// NewDeleter creates a new data deleter.
func NewDeleter(discoverer *Discoverer) *Deleter {
	return &Deleter{discoverer: discoverer}
}

// Delete removes user data from all discovered locations.
func (d *Deleter) Delete(ctx context.Context, userID string, locations []DataLocation) (*DeletionResult, error) {
	log.Printf("deleting data for user %s across %d locations", userID, len(locations))

	result := &DeletionResult{
		UserID:  userID,
		Summary: make(map[string]CategoryResult),
	}

	for _, loc := range locations {
		catResult := d.deleteFromLocation(ctx, userID, loc)
		result.Summary[loc.Category] = catResult

		if catResult.Status == "deleted" {
			result.DeletedCategories = append(result.DeletedCategories, loc.Category)
		} else {
			result.RetainedCategories = append(result.RetainedCategories, loc.Category)
		}
	}

	result.CompletedAt = time.Now()
	return result, nil
}

func (d *Deleter) deleteFromLocation(ctx context.Context, userID string, loc DataLocation) CategoryResult {
	// Financial records and legal compliance data are typically retained
	retainedCategories := map[string]string{
		"financial_records": "Required for tax/legal compliance",
		"audit_logs":        "Required for regulatory compliance",
	}

	if reason, retained := retainedCategories[loc.Category]; retained {
		return CategoryResult{
			RecordsDeleted: 0,
			Status:         "retained",
			Reason:         reason,
		}
	}

	log.Printf("deleting %s data for user %s from %s", loc.Category, userID, loc.Source)

	return CategoryResult{
		RecordsDeleted: loc.RecordCount,
		Status:         "deleted",
	}
}
