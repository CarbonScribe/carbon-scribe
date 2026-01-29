package search

import (
	"time"
)

// SearchRequest represents the search parameters
type SearchRequest struct {
	Query     string                 `json:"query" form:"q"`
	Filters   map[string]interface{} `json:"filters" form:"filters"`
	SortBy    string                 `json:"sort_by" form:"sort_by"`
	SortOrder string                 `json:"sort_order" form:"sort_order"` // asc or desc
	Page      int                    `json:"page" form:"page"`
	PageSize  int                    `json:"page_size" form:"page_size"`
}

// SearchResponse represents the search results
type SearchResponse struct {
	Hits     []SearchHit            `json:"hits"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
	Facets   map[string]interface{} `json:"facets,omitempty"`
	Took     int64                  `json:"took_ms"`
}

// SearchHit represents a single search result
type SearchHit struct {
	ID         string                 `json:"id"`
	Index      string                 `json:"index"`
	Score      float64                `json:"score"`
	Source     map[string]interface{} `json:"source"`
	Highlights map[string][]string    `json:"highlights,omitempty"`
}

// ProjectDocument represents the project data structure for indexing
type ProjectDocument struct {
	EntityType        string      `json:"entity_type"` // "project"
	ProjectID         string      `json:"project_id"`
	Name              string      `json:"name"`
	Description       string      `json:"description"`
	ProjectType       string      `json:"project_type"`
	Methodology       string      `json:"methodology"`
	Status            string      `json:"status"`
	CountryCode       string      `json:"country_code"`
	Region            string      `json:"region"`
	Tags              []string    `json:"tags"`
	Location          GeoPoint    `json:"location,omitempty"`
	Geometry          interface{} `json:"geometry,omitempty"` // GeoJSON shape
	AreaHectares      float64     `json:"area_hectares"`
	CarbonCredits     int64       `json:"carbon_credits"`
	EstimatedRevenue  float64     `json:"estimated_revenue"`
	StartYear         int         `json:"start_year"`
	VintageYear       int         `json:"vintage_year"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
	VerifiedAt        *time.Time  `json:"verified_at,omitempty"`
	ViewCount         int         `json:"view_count"`
	SaveCount         int         `json:"save_count"`
	VerificationScore float64     `json:"verification_score"`
}

// DocumentDocument represents a file/document for indexing
type DocumentDocument struct {
	EntityID     string    `json:"entity_id"`
	EntityType   string    `json:"entity_type"` // "document"
	Title        string    `json:"title"`
	Content      string    `json:"content"` // Extracted text content
	ProjectID    string    `json:"project_id"`
	DocumentType string    `json:"document_type"`
	FileFormat   string    `json:"file_format"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// GeoPoint represents a geographic coordinate
type GeoPoint struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// IndexMapping defines the Elasticsearch mapping
const ProjectIndexName = "projects"
const ProjectIndexMapping = `
{
	"mappings": {
		"properties": {
			"entity_type": { "type": "keyword" },
			"project_id": { "type": "keyword" },
			"name": { 
				"type": "text", 
				"analyzer": "english",
				"fields": { "keyword": { "type": "keyword" } }
			},
			"description": { "type": "text", "analyzer": "english" },
			"project_type": { "type": "keyword" },
			"methodology": { "type": "keyword" },
			"status": { "type": "keyword" },
			"country_code": { "type": "keyword" },
			"region": { "type": "keyword" },
			"tags": { "type": "keyword" },
			"location": { "type": "geo_point" },
			"geometry": { "type": "geo_shape" },
			"area_hectares": { "type": "float" },
			"carbon_credits": { "type": "long" },
			"estimated_revenue": { "type": "float" },
			"start_year": { "type": "integer" },
			"vintage_year": { "type": "integer" },
			"created_at": { "type": "date" },
			"updated_at": { "type": "date" },
			"verified_at": { "type": "date" },
			"view_count": { "type": "integer" },
			"save_count": { "type": "integer" },
			"verification_score": { "type": "float" }
		}
	}
}
`
