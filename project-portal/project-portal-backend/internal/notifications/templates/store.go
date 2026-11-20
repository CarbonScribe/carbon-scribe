package templates

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ErrTemplateNotFound is returned by Repository.Get and Repository.Update
// when no template exists for the given ID.
var ErrTemplateNotFound = errors.New("templates: template not found")

// Repository is the persistence contract for managed notification
// templates (issue #689). MongoRepository is the production
// implementation, matching the storage technology internal/notifications'
// own MongoRepository already uses — the only other repository in this
// module — so the module has one consistent persistence story rather than
// a second, different one introduced alongside it.
type Repository interface {
	Create(ctx context.Context, tpl *NotificationTemplate) error
	Update(ctx context.Context, tpl *NotificationTemplate) error
	Get(ctx context.Context, id string) (*NotificationTemplate, error)
	List(ctx context.Context) ([]NotificationTemplate, error)
}

// MongoRepository implements Repository against MongoDB.
type MongoRepository struct {
	collection *mongo.Collection
}

// NewMongoRepository constructs a MongoRepository against the
// "managed_notification_templates" collection in db — a name distinct from
// internal/notifications' own "notification_templates" collection, since
// these are two separate template concepts (see models.go's doc comment)
// and must not be confused by sharing a collection.
func NewMongoRepository(db *mongo.Database) *MongoRepository {
	return &MongoRepository{collection: db.Collection("managed_notification_templates")}
}

// Create inserts a new template. The caller (TemplateManager) is
// responsible for having already assigned ID, Version, and timestamps.
func (r *MongoRepository) Create(ctx context.Context, tpl *NotificationTemplate) error {
	if _, err := r.collection.InsertOne(ctx, tpl); err != nil {
		return fmt.Errorf("insert template: %w", err)
	}
	return nil
}

// Update replaces the stored document for tpl.ID wholesale with tpl.
// Returns ErrTemplateNotFound if no document with that ID exists —
// callers must not be able to "update" a template into existence under an
// ID nobody created.
func (r *MongoRepository) Update(ctx context.Context, tpl *NotificationTemplate) error {
	result, err := r.collection.ReplaceOne(ctx, bson.M{"_id": tpl.ID}, tpl)
	if err != nil {
		return fmt.Errorf("replace template: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrTemplateNotFound
	}
	return nil
}

// Get returns the template stored under id, or ErrTemplateNotFound.
func (r *MongoRepository) Get(ctx context.Context, id string) (*NotificationTemplate, error) {
	var tpl NotificationTemplate
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&tpl)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrTemplateNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find template: %w", err)
	}
	return &tpl, nil
}

// List returns every managed template, newest first.
func (r *MongoRepository) List(ctx context.Context) ([]NotificationTemplate, error) {
	cur, err := r.collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		return nil, fmt.Errorf("find templates: %w", err)
	}
	defer cur.Close(ctx)

	items := make([]NotificationTemplate, 0)
	for cur.Next(ctx) {
		var t NotificationTemplate
		if err := cur.Decode(&t); err != nil {
			return nil, fmt.Errorf("decode template: %w", err)
		}
		items = append(items, t)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("iterate templates: %w", err)
	}
	return items, nil
}

// Ensure MongoRepository satisfies Repository.
var _ Repository = (*MongoRepository)(nil)
