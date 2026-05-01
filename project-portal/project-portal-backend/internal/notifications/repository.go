package notifications

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository interface {
	CreateNotification(ctx context.Context, n *Notification) error
	ListNotificationsByUser(ctx context.Context, userID string, limit int64) ([]Notification, error)
	GetNotificationByID(ctx context.Context, id string) (*Notification, error)
	CreateDeliveryAttempt(ctx context.Context, attempt *DeliveryAttempt) error
	ListDeliveryAttempts(ctx context.Context, notificationID string) ([]DeliveryAttempt, error)
	UpdateNotificationStatus(ctx context.Context, id string, status string, deliveredAt *time.Time) error

	PutPreference(ctx context.Context, pref *UserPreference) error
	ListPreferencesByUser(ctx context.Context, userID string) ([]UserPreference, error)

	CreateTemplate(ctx context.Context, template *NotificationTemplate) error
	ListTemplates(ctx context.Context) ([]NotificationTemplate, error)
	GetTemplateByID(ctx context.Context, id string) (*NotificationTemplate, error)

	CreateRule(ctx context.Context, rule *NotificationRule) error
	UpdateRule(ctx context.Context, rule *NotificationRule) error
	ListRules(ctx context.Context, projectID string) ([]NotificationRule, error)
	GetRuleByID(ctx context.Context, id string) (*NotificationRule, error)

	UpsertConnection(ctx context.Context, conn *WebSocketConnection) error
	DeleteConnection(ctx context.Context, connectionID string) error
	ListConnections(ctx context.Context, projectID string, userID string) ([]WebSocketConnection, error)

	Metrics(ctx context.Context) (*DeliveryMetrics, error)
}

type MongoRepository struct {
	db            *mongo.Database
	notifications *mongo.Collection
	deliveryLogs  *mongo.Collection
	preferences   *mongo.Collection
	templates     *mongo.Collection
	rules         *mongo.Collection
	connections   *mongo.Collection
}

func NewMongoRepository(client *mongo.Client, dbName string) *MongoRepository {
	db := client.Database(dbName)
	return &MongoRepository{
		db:            db,
		notifications: db.Collection("notifications"),
		deliveryLogs:  db.Collection("delivery_logs"),
		preferences:   db.Collection("user_preferences"),
		templates:     db.Collection("notification_templates"),
		rules:         db.Collection("notification_rules"),
		connections:   db.Collection("ws_connections"),
	}
}

func ConnectMongo(ctx context.Context, uri string) (*mongo.Client, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("connect mongo: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("ping mongo: %w", err)
	}
	return client, nil
}

func (r *MongoRepository) CreateNotification(ctx context.Context, n *Notification) error {
	_, err := r.notifications.InsertOne(ctx, n)
	if err != nil {
		return fmt.Errorf("insert notification: %w", err)
	}
	return nil
}

func (r *MongoRepository) ListNotificationsByUser(ctx context.Context, userID string, limit int64) ([]Notification, error) {
	if limit <= 0 {
		limit = 50
	}
	cur, err := r.notifications.Find(ctx, bson.M{"user_id": userID}, options.Find().SetSort(bson.M{"created_at": -1}).SetLimit(limit))
	if err != nil {
		return nil, fmt.Errorf("find notifications: %w", err)
	}
	defer cur.Close(ctx)

	items := make([]Notification, 0)
	for cur.Next(ctx) {
		var n Notification
		if err := cur.Decode(&n); err != nil {
			return nil, fmt.Errorf("decode notification: %w", err)
		}
		items = append(items, n)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("iterate notifications: %w", err)
	}
	return items, nil
}

func (r *MongoRepository) GetNotificationByID(ctx context.Context, id string) (*Notification, error) {
	var n Notification
	err := r.notifications.FindOne(ctx, bson.M{"_id": id}).Decode(&n)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find notification: %w", err)
	}
	return &n, nil
}

func (r *MongoRepository) CreateDeliveryAttempt(ctx context.Context, attempt *DeliveryAttempt) error {
	_, err := r.deliveryLogs.InsertOne(ctx, attempt)
	if err != nil {
		return fmt.Errorf("insert delivery attempt: %w", err)
	}
	return nil
}

func (r *MongoRepository) ListDeliveryAttempts(ctx context.Context, notificationID string) ([]DeliveryAttempt, error) {
	cur, err := r.deliveryLogs.Find(ctx, bson.M{"notification_id": notificationID}, options.Find().SetSort(bson.M{"created_at": 1}))
	if err != nil {
		return nil, fmt.Errorf("find delivery attempts: %w", err)
	}
	defer cur.Close(ctx)

	items := make([]DeliveryAttempt, 0)
	for cur.Next(ctx) {
		var a DeliveryAttempt
		if err := cur.Decode(&a); err != nil {
			return nil, fmt.Errorf("decode delivery attempt: %w", err)
		}
		items = append(items, a)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("iterate delivery attempts: %w", err)
	}
	return items, nil
}

func (r *MongoRepository) UpdateNotificationStatus(ctx context.Context, id string, status string, deliveredAt *time.Time) error {
	update := bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}
	if deliveredAt != nil {
		update["$set"].(bson.M)["delivered_at"] = *deliveredAt
	}
	_, err := r.notifications.UpdateByID(ctx, id, update)
	if err != nil {
		return fmt.Errorf("update notification status: %w", err)
	}
	return nil
}

func (r *MongoRepository) PutPreference(ctx context.Context, pref *UserPreference) error {
	_, err := r.preferences.UpdateByID(ctx, pref.ID, bson.M{"$set": pref}, options.Update().SetUpsert(true))
	if err != nil {
		return fmt.Errorf("upsert preference: %w", err)
	}
	return nil
}

func (r *MongoRepository) ListPreferencesByUser(ctx context.Context, userID string) ([]UserPreference, error) {
	cur, err := r.preferences.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("find preferences: %w", err)
	}
	defer cur.Close(ctx)

	items := make([]UserPreference, 0)
	for cur.Next(ctx) {
		var p UserPreference
		if err := cur.Decode(&p); err != nil {
			return nil, fmt.Errorf("decode preference: %w", err)
		}
		items = append(items, p)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("iterate preferences: %w", err)
	}
	return items, nil
}

func (r *MongoRepository) CreateTemplate(ctx context.Context, template *NotificationTemplate) error {
	_, err := r.templates.InsertOne(ctx, template)
	if err != nil {
		return fmt.Errorf("insert template: %w", err)
	}
	return nil
}

func (r *MongoRepository) ListTemplates(ctx context.Context) ([]NotificationTemplate, error) {
	cur, err := r.templates.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"created_at": -1}))
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

func (r *MongoRepository) GetTemplateByID(ctx context.Context, id string) (*NotificationTemplate, error) {
	var t NotificationTemplate
	err := r.templates.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find template: %w", err)
	}
	return &t, nil
}

func (r *MongoRepository) CreateRule(ctx context.Context, rule *NotificationRule) error {
	_, err := r.rules.InsertOne(ctx, rule)
	if err != nil {
		return fmt.Errorf("insert rule: %w", err)
	}
	return nil
}

func (r *MongoRepository) UpdateRule(ctx context.Context, rule *NotificationRule) error {
	_, err := r.rules.UpdateByID(ctx, rule.ID, bson.M{"$set": rule})
	if err != nil {
		return fmt.Errorf("update rule: %w", err)
	}
	return nil
}

func (r *MongoRepository) ListRules(ctx context.Context, projectID string) ([]NotificationRule, error) {
	filter := bson.M{}
	if projectID != "" {
		filter["project_id"] = projectID
	}
	cur, err := r.rules.Find(ctx, filter, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		return nil, fmt.Errorf("find rules: %w", err)
	}
	defer cur.Close(ctx)

	items := make([]NotificationRule, 0)
	for cur.Next(ctx) {
		var rItem NotificationRule
		if err := cur.Decode(&rItem); err != nil {
			return nil, fmt.Errorf("decode rule: %w", err)
		}
		items = append(items, rItem)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("iterate rules: %w", err)
	}
	return items, nil
}

func (r *MongoRepository) GetRuleByID(ctx context.Context, id string) (*NotificationRule, error) {
	var rule NotificationRule
	err := r.rules.FindOne(ctx, bson.M{"_id": id}).Decode(&rule)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find rule: %w", err)
	}
	return &rule, nil
}

func (r *MongoRepository) UpsertConnection(ctx context.Context, conn *WebSocketConnection) error {
	_, err := r.connections.UpdateByID(ctx, conn.ConnectionID, bson.M{"$set": conn}, options.Update().SetUpsert(true))
	if err != nil {
		return fmt.Errorf("upsert connection: %w", err)
	}
	return nil
}

func (r *MongoRepository) DeleteConnection(ctx context.Context, connectionID string) error {
	_, err := r.connections.DeleteOne(ctx, bson.M{"_id": connectionID})
	if err != nil {
		return fmt.Errorf("delete connection: %w", err)
	}
	return nil
}

func (r *MongoRepository) ListConnections(ctx context.Context, projectID string, userID string) ([]WebSocketConnection, error) {
	filter := bson.M{}
	if userID != "" {
		filter["user_id"] = userID
	}
	if projectID != "" {
		filter["project_ids"] = bson.M{"$in": []string{projectID}}
	}

	cur, err := r.connections.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("find connections: %w", err)
	}
	defer cur.Close(ctx)

	items := make([]WebSocketConnection, 0)
	for cur.Next(ctx) {
		var c WebSocketConnection
		if err := cur.Decode(&c); err != nil {
			return nil, fmt.Errorf("decode connection: %w", err)
		}
		items = append(items, c)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("iterate connections: %w", err)
	}
	return items, nil
}

func (r *MongoRepository) Metrics(ctx context.Context) (*DeliveryMetrics, error) {
	total, err := r.notifications.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("count notifications: %w", err)
	}

	statusCounts := map[string]int64{}
	for _, s := range []string{StatusPending, StatusSent, StatusDelivered, StatusFailed} {
		c, err := r.notifications.CountDocuments(ctx, bson.M{"status": s})
		if err != nil {
			return nil, fmt.Errorf("count notifications by status: %w", err)
		}
		statusCounts[s] = c
	}

	channelCounts := map[string]int64{}
	for _, ch := range []string{ChannelEmail, ChannelSMS, ChannelWebSocket, ChannelInApp} {
		c, err := r.deliveryLogs.CountDocuments(ctx, bson.M{"channel": ch})
		if err != nil {
			return nil, fmt.Errorf("count attempts by channel: %w", err)
		}
		channelCounts[ch] = c
	}

	last24h, err := r.notifications.CountDocuments(ctx, bson.M{"created_at": bson.M{"$gte": time.Now().UTC().Add(-24 * time.Hour)}})
	if err != nil {
		return nil, fmt.Errorf("count last24h notifications: %w", err)
	}

	return &DeliveryMetrics{
		TotalNotifications: total,
		ByStatus:           statusCounts,
		ByChannel:          channelCounts,
		Last24h:            last24h,
		GeneratedAt:        time.Now().UTC(),
	}, nil
}
