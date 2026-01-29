package search

import (
	"context"
	"encoding/json"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/pkg/elastic"
)

// Repository defines the interface for search operations
type Repository interface {
	IndexProject(ctx context.Context, project *ProjectDocument) error
	Search(ctx context.Context, index string, query map[string]interface{}) (*SearchResponse, error)
	SetupIndexes(ctx context.Context) error
}

// ElasticRepository implements Repository using Elasticsearch
type ElasticRepository struct {
	client *elastic.Client
}

// NewRepository creates a new ElasticRepository
func NewRepository(client *elastic.Client) *ElasticRepository {
	return &ElasticRepository{
		client: client,
	}
}

// IndexProject indexes a project document
func (r *ElasticRepository) IndexProject(ctx context.Context, project *ProjectDocument) error {
	return r.client.IndexDocument(ctx, ProjectIndexName, project.ProjectID, project)
}

// Search performs a search query
func (r *ElasticRepository) Search(ctx context.Context, index string, query map[string]interface{}) (*SearchResponse, error) {
	resp, err := r.client.Search(ctx, index, query)
	if err != nil {
		return nil, err
	}

	return parseSearchResponse(resp)
}

// SetupIndexes creates necessary indices if they don't exist
func (r *ElasticRepository) SetupIndexes(ctx context.Context) error {
	exists, err := r.client.IndexExists(ctx, ProjectIndexName)
	if err != nil {
		return fmt.Errorf("failed to check index existence: %w", err)
	}

	if exists {
		return nil
	}

	// Parse mapping string to map
	var mapping map[string]interface{}
	if err := json.Unmarshal([]byte(ProjectIndexMapping), &mapping); err != nil {
		return fmt.Errorf("invalid mapping json: %w", err)
	}

	return r.client.CreateIndex(ctx, ProjectIndexName, mapping)
}

func parseSearchResponse(raw map[string]interface{}) (*SearchResponse, error) {
	hitsObj, ok := raw["hits"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format: missing hits")
	}

	totalObj, ok := hitsObj["total"].(map[string]interface{})
	var total int64
	if ok {
		if val, ok := totalObj["value"].(float64); ok {
			total = int64(val)
		}
	}

	hitsList, ok := hitsObj["hits"].([]interface{})
	if !ok {
		hitsList = []interface{}{}
	}

	var results []SearchHit
	for _, h := range hitsList {
		hitMap, ok := h.(map[string]interface{})
		if !ok {
			continue
		}

		id, _ := hitMap["_id"].(string)
		idx, _ := hitMap["_index"].(string)
		score, _ := hitMap["_score"].(float64)
		source, _ := hitMap["_source"].(map[string]interface{})

		results = append(results, SearchHit{
			ID:     id,
			Index:  idx,
			Score:  score,
			Source: source,
		})
	}

	took, _ := raw["took"].(float64)

	return &SearchResponse{
		Hits:  results,
		Total: total,
		Took:  int64(took),
	}, nil
}
