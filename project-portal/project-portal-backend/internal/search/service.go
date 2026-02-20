package search

import (
	"context"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/search/analytics"
	"carbon-scribe/project-portal/project-portal-backend/internal/search/query"
)

// Service defines the search service interface
type Service interface {
	SearchProjects(ctx context.Context, req SearchRequest) (*SearchResponse, error)
	SearchNearby(ctx context.Context, req SearchRequest, lat, lon float64, dist string) (*SearchResponse, error)
	IndexProject(ctx context.Context, project ProjectDocument) error
	SyncIndex(ctx context.Context) error
}

// ServiceImpl implements Service
type ServiceImpl struct {
	repo    Repository
	indexer *Indexer
	tracker analytics.Tracker
}

// NewService creates a new search service
func NewService(repo Repository) *ServiceImpl {
	return &ServiceImpl{
		repo:    repo,
		indexer: NewIndexer(repo),          // Internal indexer
		tracker: analytics.NewLogTracker(), // Internal tracker
	}
}

// SearchProjects performs a search for projects
func (s *ServiceImpl) SearchProjects(ctx context.Context, req SearchRequest) (*SearchResponse, error) {
	startTime := time.Now()

	// Build query using builder
	qb := query.NewBuilder()

	// Pagination
	qb.From((req.Page - 1) * req.PageSize).Size(req.PageSize)

	// Sorting
	if req.SortBy != "" {
		order := "asc"
		if req.SortOrder == "desc" {
			order = "desc"
		}
		qb.Sort(req.SortBy, order)
	}

	// Main query
	boolQuery := query.NewBoolBuilder()

	if req.Query != "" {
		boolQuery.Must(map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":  req.Query,
				"fields": []string{"name^3", "description", "tags"},
			},
		})
	} else {
		boolQuery.Must(map[string]interface{}{
			"match_all": map[string]interface{}{},
		})
	}

	// Apply filters
	for k, v := range req.Filters {
		// Check if value is a map (likely a range filter)
		if valMap, ok := v.(map[string]interface{}); ok {
			var gte, lte interface{}
			if val, exists := valMap["gte"]; exists {
				gte = val
			}
			if val, exists := valMap["lte"]; exists {
				lte = val
			}
			if gte != nil || lte != nil {
				boolQuery.Filter(map[string]interface{}{
					"range": map[string]interface{}{
						k: map[string]interface{}{
							"gte": gte,
							"lte": lte,
						},
					},
				})
				continue
			}
		}

		// Default to term filter
		boolQuery.Filter(map[string]interface{}{
			"term": map[string]interface{}{
				k: v,
			},
		})
	}

	qb.WithQuery(boolQuery.Build())

	// Execute search
	resp, err := s.repo.Search(ctx, ProjectIndexName, qb.Build())

	// Track analytics
	took := time.Since(startTime).Milliseconds()
	hits := int64(0)
	if resp != nil {
		hits = resp.Total
	}
	s.tracker.TrackSearch(ctx, req.Query, hits, took)

	return resp, err
}

// SearchNearby performs a geospatial search
func (s *ServiceImpl) SearchNearby(ctx context.Context, req SearchRequest, lat, lon float64, dist string) (*SearchResponse, error) {
	startTime := time.Now()

	qb := query.NewBuilder()
	qb.From((req.Page - 1) * req.PageSize).Size(req.PageSize)

	boolQuery := query.NewBoolBuilder()

	// Add GeoFilter
	boolQuery.GeoDistance("location", lat, lon, dist)

	// Add other filters
	for k, v := range req.Filters {
		boolQuery.Filter(map[string]interface{}{
			"term": map[string]interface{}{k: v},
		})
	}

	// Match all if no text query, otherwise match text
	if req.Query != "" {
		boolQuery.Must(map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":  req.Query,
				"fields": []string{"name^3", "description", "tags"},
			},
		})
	} else {
		boolQuery.Must(map[string]interface{}{"match_all": map[string]interface{}{}})
	}

	qb.WithQuery(boolQuery.Build())

	// Sort by distance
	qb.Sort("_geo_distance", map[string]interface{}{
		"location": map[string]interface{}{
			"lat": lat,
			"lon": lon,
		},
		"order": "asc",
		"unit":  "hm",
	})

	resp, err := s.repo.Search(ctx, ProjectIndexName, qb.Build())

	took := time.Since(startTime).Milliseconds()
	hits := int64(0)
	if resp != nil {
		hits = resp.Total
	}
	s.tracker.TrackSearch(ctx, "nearby:"+req.Query, hits, took)

	return resp, err
}

// IndexProject indexes a single project
func (s *ServiceImpl) IndexProject(ctx context.Context, project ProjectDocument) error {
	return s.indexer.IndexProject(ctx, &project)
}

// SyncIndex triggers a full re-index
func (s *ServiceImpl) SyncIndex(ctx context.Context) error {
	return s.repo.SetupIndexes(ctx)
}
