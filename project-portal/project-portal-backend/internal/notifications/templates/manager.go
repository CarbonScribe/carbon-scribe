package templates

import (
	"context"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Template represents the data model for a notification template
type Template struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Type      string             `bson:"type" json:"type"`
	Language  string             `bson:"language" json:"language"`
	Subject   string             `bson:"subject" json:"subject"`
	Body      string             `bson:"body" json:"body"`
	Variables []string           `bson:"variables" json:"variables"`
}

type Manager struct {
	store Store
}

func NewManager(store Store) *Manager {
	return &Manager{store: store}
}

func (m *Manager) Create(ctx context.Context, t *Template) error {
	return m.store.Save(ctx, t)
}

func (m *Manager) Get(ctx context.Context, id primitive.ObjectID) (*Template, error) {
	return m.store.FindByID(ctx, id)
}

func (m *Manager) Render(t *Template, data map[string]interface{}) string {
	return Render(t.Body, data)
}
