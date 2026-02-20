package search

import (
	"context"
	"testing"
)

type mockRepo struct{}

func (m *mockRepo) IndexProject(ctx context.Context, project *ProjectDocument) error {
	return nil
}
func (m *mockRepo) Search(ctx context.Context, index string, query map[string]interface{}) (*SearchResponse, error) {
	return nil, nil
}
func (m *mockRepo) SetupIndexes(ctx context.Context) error {
	return nil
}

func TestIndexer_IndexProject(t *testing.T) {
	indexer := NewIndexer(&mockRepo{})
	project := &ProjectDocument{ProjectID: "123", Name: "Test Project"}

	if err := indexer.IndexProject(context.Background(), project); err != nil {
		t.Errorf("IndexProject failed: %v", err)
	}
}
