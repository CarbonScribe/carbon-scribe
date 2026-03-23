package notifications

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository interface {
	// Templates
	CreateTemplate(ctx context.Context, template *NotificationTemplate) error
	GetTemplate(ctx context.Context, id primitive.ObjectID) (*NotificationTemplate, error)
	ListTemplates(ctx context.Context) ([]NotificationTemplate, error)

	// Rules
	CreateRule(ctx context.Context, rule *NotificationRule) error
	GetRulesByProject(ctx context.Context, projectID string) ([]NotificationRule, error)
	UpdateRule(ctx context.Context, rule *NotificationRule) error

	// Preferences
	UpdatePreference(ctx context.Context, pref *UserPreference) error
	GetPreferences(ctx context.Context, userID string) ([]UserPreference, error)

	// Connections
	SaveConnection(ctx context.Context, conn *WebSocketConnection) error
	DeleteConnection(ctx context.Context, connectionID string) error
	GetConnectionsByUser(ctx context.Context, userID string) ([]WebSocketConnection, error)
	GetAllConnections(ctx context.Context) ([]WebSocketConnection, error)

	// Logs
	CreateDeliveryLog(ctx context.Context, log *DeliveryLog) error
	GetDeliveryLog(ctx context.Context, id primitive.ObjectID) (*DeliveryLog, error)
}

type mongoRepository struct {
	db *mongo.Database
}

func NewRepository(db *mongo.Database) Repository {
	return &mongoRepository{db: db}
}

// Templates
func (r *mongoRepository) CreateTemplate(ctx context.Context, t *NotificationTemplate) error {
	t.CreatedAt = time.Now()
	_, err := r.db.Collection("notification_templates").InsertOne(ctx, t)
	return err
}

func (r *mongoRepository) GetTemplate(ctx context.Context, id primitive.ObjectID) (*NotificationTemplate, error) {
	var t NotificationTemplate
	err := r.db.Collection("notification_templates").FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	return &t, err
}

func (r *mongoRepository) ListTemplates(ctx context.Context) ([]NotificationTemplate, error) {
	cursor, err := r.db.Collection("notification_templates").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	var templates []NotificationTemplate
	err = cursor.All(ctx, &templates)
	return templates, err
}

// Rules
func (r *mongoRepository) CreateRule(ctx context.Context, rule *NotificationRule) error {
	_, err := r.db.Collection("notification_rules").InsertOne(ctx, rule)
	return err
}

func (r *mongoRepository) GetRulesByProject(ctx context.Context, projectID string) ([]NotificationRule, error) {
	cursor, err := r.db.Collection("notification_rules").Find(ctx, bson.M{"projectId": projectID})
	if err != nil {
		return nil, err
	}
	var rules []NotificationRule
	err = cursor.All(ctx, &rules)
	return rules, err
}

func (r *mongoRepository) UpdateRule(ctx context.Context, rule *NotificationRule) error {
	_, err := r.db.Collection("notification_rules").ReplaceOne(ctx, bson.M{"_id": rule.ID}, rule)
	return err
}

// Preferences
func (r *mongoRepository) UpdatePreference(ctx context.Context, pref *UserPreference) error {
	pref.UpdatedAt = time.Now()
	opts := options.Update().SetUpsert(true)
	filter := bson.M{"userId": pref.UserID, "category": pref.Category, "channel": pref.Channel}
	update := bson.M{"$set": pref}
	_, err := r.db.Collection("user_preferences").UpdateOne(ctx, filter, update, opts)
	return err
}

func (r *mongoRepository) GetPreferences(ctx context.Context, userID string) ([]UserPreference, error) {
	cursor, err := r.db.Collection("user_preferences").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return nil, err
	}
	var prefs []UserPreference
	err = cursor.All(ctx, &prefs)
	return prefs, err
}

// Connections
func (r *mongoRepository) SaveConnection(ctx context.Context, conn *WebSocketConnection) error {
	opts := options.Replace().SetUpsert(true)
	_, err := r.db.Collection("websocket_connections").ReplaceOne(ctx, bson.M{"_id": conn.ID}, conn, opts)
	return err
}

func (r *mongoRepository) DeleteConnection(ctx context.Context, connectionID string) error {
	_, err := r.db.Collection("websocket_connections").DeleteOne(ctx, bson.M{"_id": connectionID})
	return err
}

func (r *mongoRepository) GetConnectionsByUser(ctx context.Context, userID string) ([]WebSocketConnection, error) {
	cursor, err := r.db.Collection("websocket_connections").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return nil, err
	}
	var conns []WebSocketConnection
	err = cursor.All(ctx, &conns)
	return conns, err
}

func (r *mongoRepository) GetAllConnections(ctx context.Context) ([]WebSocketConnection, error) {
	cursor, err := r.db.Collection("websocket_connections").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	var conns []WebSocketConnection
	err = cursor.All(ctx, &conns)
	return conns, err
}

// Logs
func (r *mongoRepository) CreateDeliveryLog(ctx context.Context, log *DeliveryLog) error {
	log.Timestamp = time.Now()
	_, err := r.db.Collection("delivery_logs").InsertOne(ctx, log)
	return err
}

func (r *mongoRepository) GetDeliveryLog(ctx context.Context, id primitive.ObjectID) (*DeliveryLog, error) {
	var l DeliveryLog
	err := r.db.Collection("delivery_logs").FindOne(ctx, bson.M{"_id": id}).Decode(&l)
	return &l, err
}
