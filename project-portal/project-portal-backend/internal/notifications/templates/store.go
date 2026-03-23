package templates

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Store interface {
	Save(ctx context.Context, t *Template) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*Template, error)
}

type mongoStore struct {
	col *mongo.Collection
}

func NewStore(db *mongo.Database) Store {
	return &mongoStore{col: db.Collection("notification_templates")}
}

func (s *mongoStore) Save(ctx context.Context, t *Template) error {
	_, err := s.col.InsertOne(ctx, t)
	return err
}

func (s *mongoStore) FindByID(ctx context.Context, id primitive.ObjectID) (*Template, error) {
	var t Template
	err := s.col.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	return &t, err
}
