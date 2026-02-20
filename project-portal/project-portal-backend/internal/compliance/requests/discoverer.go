package requests

import (
	"context"
	"log"
)

// Discoverer locates all user data across distributed systems.
type Discoverer struct {
	dataSources []DataSource
}

// DataSource represents a system that may contain user data.
type DataSource struct {
	Name       string
	Type       string // "database", "file_storage", "cache", "log"
	Categories []string
}

// DataLocation describes where user data was found.
type DataLocation struct {
	Source      string `json:"source"`
	Category   string `json:"category"`
	RecordCount int64 `json:"record_count"`
	Description string `json:"description"`
}

// NewDiscoverer creates a new data discoverer with default data source registry.
func NewDiscoverer() *Discoverer {
	return &Discoverer{
		dataSources: defaultDataSources(),
	}
}

func defaultDataSources() []DataSource {
	return []DataSource{
		{Name: "users_db", Type: "database", Categories: []string{"user_profile"}},
		{Name: "projects_db", Type: "database", Categories: []string{"project_data"}},
		{Name: "financial_db", Type: "database", Categories: []string{"financial_records"}},
		{Name: "activity_logs", Type: "database", Categories: []string{"system_logs"}},
		{Name: "file_storage", Type: "file_storage", Categories: []string{"user_profile", "project_data"}},
		{Name: "cache", Type: "cache", Categories: []string{"user_profile"}},
	}
}

// DiscoverUserData finds all data for a user, optionally filtered by categories.
func (d *Discoverer) DiscoverUserData(ctx context.Context, userID string, categories []string) ([]DataLocation, error) {
	log.Printf("discovering data for user %s (categories: %v)", userID, categories)

	categoryFilter := make(map[string]bool)
	for _, c := range categories {
		categoryFilter[c] = true
	}

	var locations []DataLocation
	for _, source := range d.dataSources {
		for _, cat := range source.Categories {
			if len(categoryFilter) > 0 && !categoryFilter[cat] {
				continue
			}
			locations = append(locations, DataLocation{
				Source:      source.Name,
				Category:   cat,
				RecordCount: 0,
				Description: source.Type + " records in " + source.Name,
			})
		}
	}

	return locations, nil
}

// RegisterDataSource adds a new data source to the discoverer.
func (d *Discoverer) RegisterDataSource(source DataSource) {
	d.dataSources = append(d.dataSources, source)
}

// ListDataSources returns all registered data sources.
func (d *Discoverer) ListDataSources() []DataSource {
	return d.dataSources
}
