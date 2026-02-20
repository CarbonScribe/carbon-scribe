package search

import (
	"context"
	"log"
)

// Indexer handles indexing operations
type Indexer struct {
	repo Repository
}

// NewIndexer creates a new indexer
func NewIndexer(repo Repository) *Indexer {
	return &Indexer{
		repo: repo,
	}
}

// IndexProject indexes a single project
func (i *Indexer) IndexProject(ctx context.Context, project *ProjectDocument) error {
	log.Printf("Indexing project: %s", project.ProjectID)
	return i.repo.IndexProject(ctx, project)
}

// BulkIndexProjects indexes multiple projects
func (i *Indexer) BulkIndexProjects(ctx context.Context, projects []*ProjectDocument) error {
	log.Printf("Bulk indexing %d projects", len(projects))
	for _, p := range projects {
		if err := i.IndexProject(ctx, p); err != nil {
			log.Printf("Error indexing project %s: %v", p.ProjectID, err)
		}
	}
	return nil
}
