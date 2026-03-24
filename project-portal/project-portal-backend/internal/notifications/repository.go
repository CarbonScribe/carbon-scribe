package notifications

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
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
	GetConnectionIDsByUser(ctx context.Context, userID string) ([]string, error)
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

type dynamoRepository struct {
	client        *dynamodb.Client
	templateTable string
	ruleTable     string
	prefTable     string
	connTable     string
	logTable      string
}

func NewDynamoRepository(client *dynamodb.Client, tables map[string]string) Repository {
	return &dynamoRepository{
		client:        client,
		templateTable: tables["templates"],
		ruleTable:     tables["rules"],
		prefTable:     tables["preferences"],
		connTable:     tables["connections"],
		logTable:      tables["logs"],
	}
}

func NewInMemRepository() Repository {
	return &inMemRepository{
		templates:   make(map[primitive.ObjectID]NotificationTemplate),
		rules:       make(map[primitive.ObjectID]NotificationRule),
		prefs:       make(map[string][]UserPreference),
		connections: make(map[string]WebSocketConnection),
		logs:        make(map[primitive.ObjectID]DeliveryLog),
	}
}

type inMemRepository struct {
	templates   map[primitive.ObjectID]NotificationTemplate
	rules       map[primitive.ObjectID]NotificationRule
	prefs       map[string][]UserPreference
	connections map[string]WebSocketConnection
	logs        map[primitive.ObjectID]DeliveryLog
}

func (r *inMemRepository) CreateTemplate(ctx context.Context, t *NotificationTemplate) error {
	if t.ID.IsZero() {
		t.ID = primitive.NewObjectID()
	}
	t.CreatedAt = time.Now()
	r.templates[t.ID] = *t
	return nil
}

func (r *inMemRepository) GetTemplate(ctx context.Context, id primitive.ObjectID) (*NotificationTemplate, error) {
	t, ok := r.templates[id]
	if !ok {
		return nil, mongo.ErrNoDocuments
	}
	return &t, nil
}

func (r *inMemRepository) ListTemplates(ctx context.Context) ([]NotificationTemplate, error) {
	var res []NotificationTemplate
	for _, t := range r.templates {
		res = append(res, t)
	}
	return res, nil
}

func (r *inMemRepository) CreateRule(ctx context.Context, rule *NotificationRule) error {
	if rule.ID.IsZero() {
		rule.ID = primitive.NewObjectID()
	}
	r.rules[rule.ID] = *rule
	return nil
}

func (r *inMemRepository) GetRulesByProject(ctx context.Context, projectID string) ([]NotificationRule, error) {
	var res []NotificationRule
	for _, rule := range r.rules {
		if rule.ProjectID == projectID {
			res = append(res, rule)
		}
	}
	return res, nil
}

func (r *inMemRepository) UpdateRule(ctx context.Context, rule *NotificationRule) error {
	r.rules[rule.ID] = *rule
	return nil
}

func (r *inMemRepository) UpdatePreference(ctx context.Context, pref *UserPreference) error {
	pref.UpdatedAt = time.Now()
	userPrefs := r.prefs[pref.UserID]
	found := false
	for i, p := range userPrefs {
		if p.Category == pref.Category && p.Channel == pref.Channel {
			userPrefs[i] = *pref
			found = true
			break
		}
	}
	if !found {
		userPrefs = append(userPrefs, *pref)
	}
	r.prefs[pref.UserID] = userPrefs
	return nil
}

func (r *inMemRepository) GetPreferences(ctx context.Context, userID string) ([]UserPreference, error) {
	return r.prefs[userID], nil
}

func (r *inMemRepository) SaveConnection(ctx context.Context, conn *WebSocketConnection) error {
	r.connections[conn.ID] = *conn
	return nil
}

func (r *inMemRepository) DeleteConnection(ctx context.Context, connectionID string) error {
	delete(r.connections, connectionID)
	return nil
}

func (r *inMemRepository) GetConnectionsByUser(ctx context.Context, userID string) ([]WebSocketConnection, error) {
	var res []WebSocketConnection
	for _, conn := range r.connections {
		if conn.UserID == userID {
			res = append(res, conn)
		}
	}
	return res, nil
}

func (r *inMemRepository) GetConnectionIDsByUser(ctx context.Context, userID string) ([]string, error) {
	var res []string
	for id, conn := range r.connections {
		if conn.UserID == userID {
			res = append(res, id)
		}
	}
	return res, nil
}

func (r *inMemRepository) GetAllConnections(ctx context.Context) ([]WebSocketConnection, error) {
	var res []WebSocketConnection
	for _, conn := range r.connections {
		res = append(res, conn)
	}
	return res, nil
}

func (r *inMemRepository) CreateDeliveryLog(ctx context.Context, log *DeliveryLog) error {
	if log.ID.IsZero() {
		log.ID = primitive.NewObjectID()
	}
	log.Timestamp = time.Now()
	r.logs[log.ID] = *log
	return nil
}

func (r *inMemRepository) GetDeliveryLog(ctx context.Context, id primitive.ObjectID) (*DeliveryLog, error) {
	l, ok := r.logs[id]
	if !ok {
		return nil, mongo.ErrNoDocuments
	}
	return &l, nil
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

func (r *mongoRepository) GetConnectionIDsByUser(ctx context.Context, userID string) ([]string, error) {
	conns, err := r.GetConnectionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(conns))
	for i, c := range conns {
		ids[i] = c.ID
	}
	return ids, nil
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

// DynamoDB Implementation

// Templates
func (r *dynamoRepository) CreateTemplate(ctx context.Context, t *NotificationTemplate) error {
	if t.ID.IsZero() {
		t.ID = primitive.NewObjectID()
	}
	t.CreatedAt = time.Now()
	item, err := attributevalue.MarshalMap(t)
	if err != nil {
		return err
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.templateTable),
		Item:      item,
	})
	return err
}

func (r *dynamoRepository) GetTemplate(ctx context.Context, id primitive.ObjectID) (*NotificationTemplate, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.templateTable),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id.Hex()},
		},
	})
	if err != nil {
		return nil, err
	}
	if result.Item == nil {
		return nil, fmt.Errorf("template %s not found", id.Hex())
	}
	var t NotificationTemplate
	err = attributevalue.UnmarshalMap(result.Item, &t)
	return &t, err
}

func (r *dynamoRepository) ListTemplates(ctx context.Context) ([]NotificationTemplate, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(r.templateTable),
	})
	if err != nil {
		return nil, err
	}
	var templates []NotificationTemplate
	err = attributevalue.UnmarshalListOfMaps(result.Items, &templates)
	return templates, err
}

// Rules
func (r *dynamoRepository) CreateRule(ctx context.Context, rule *NotificationRule) error {
	if rule.ID.IsZero() {
		rule.ID = primitive.NewObjectID()
	}
	item, err := attributevalue.MarshalMap(rule)
	if err != nil {
		return err
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.ruleTable),
		Item:      item,
	})
	return err
}

func (r *dynamoRepository) GetRulesByProject(ctx context.Context, projectID string) ([]NotificationRule, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.ruleTable),
		IndexName:              aws.String("ProjectIDIndex"), // Assumed GSI
		KeyConditionExpression: aws.String("projectId = :pid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pid": &types.AttributeValueMemberS{Value: projectID},
		},
	})
	if err != nil {
		// Fallback to scan if index missing or for mock simplicity
		result, err = r.client.Scan(ctx, &dynamodb.ScanInput{
			TableName:        aws.String(r.ruleTable),
			FilterExpression: aws.String("projectId = :pid"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pid": &types.AttributeValueMemberS{Value: projectID},
			},
		})
		if err != nil {
			return nil, err
		}
	}
	var rules []NotificationRule
	err = attributevalue.UnmarshalListOfMaps(result.Items, &rules)
	return rules, err
}

func (r *dynamoRepository) UpdateRule(ctx context.Context, rule *NotificationRule) error {
	return r.CreateRule(ctx, rule) // PutItem handles updates
}

// Preferences
func (r *dynamoRepository) UpdatePreference(ctx context.Context, pref *UserPreference) error {
	pref.UpdatedAt = time.Now()
	if pref.ID.IsZero() {
		pref.ID = primitive.NewObjectID()
	}
	item, err := attributevalue.MarshalMap(pref)
	if err != nil {
		return err
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.prefTable),
		Item:      item,
	})
	return err
}

func (r *dynamoRepository) GetPreferences(ctx context.Context, userID string) ([]UserPreference, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.prefTable),
		IndexName:              aws.String("UserIDIndex"),
		KeyConditionExpression: aws.String("userId = :uid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":uid": &types.AttributeValueMemberS{Value: userID},
		},
	})
	if err != nil {
		// Fallback to scan if index missing
		result, err = r.client.Scan(ctx, &dynamodb.ScanInput{
			TableName:        aws.String(r.prefTable),
			FilterExpression: aws.String("userId = :uid"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":uid": &types.AttributeValueMemberS{Value: userID},
			},
		})
		if err != nil {
			return nil, err
		}
	}
	var prefs []UserPreference
	err = attributevalue.UnmarshalListOfMaps(result.Items, &prefs)
	return prefs, err
}

// Connections
func (r *dynamoRepository) SaveConnection(ctx context.Context, conn *WebSocketConnection) error {
	item, err := attributevalue.MarshalMap(conn)
	if err != nil {
		return err
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.connTable),
		Item:      item,
	})
	return err
}

func (r *dynamoRepository) DeleteConnection(ctx context.Context, connectionID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.connTable),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: connectionID},
		},
	})
	return err
}

func (r *dynamoRepository) GetConnectionsByUser(ctx context.Context, userID string) ([]WebSocketConnection, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.connTable),
		IndexName:              aws.String("UserIDIndex"),
		KeyConditionExpression: aws.String("userId = :uid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":uid": &types.AttributeValueMemberS{Value: userID},
		},
	})
	if err != nil {
		result, err = r.client.Scan(ctx, &dynamodb.ScanInput{
			TableName:        aws.String(r.connTable),
			FilterExpression: aws.String("userId = :uid"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":uid": &types.AttributeValueMemberS{Value: userID},
			},
		})
		if err != nil {
			return nil, err
		}
	}
	var conns []WebSocketConnection
	err = attributevalue.UnmarshalListOfMaps(result.Items, &conns)
	return conns, err
}

func (r *dynamoRepository) GetConnectionIDsByUser(ctx context.Context, userID string) ([]string, error) {
	conns, err := r.GetConnectionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(conns))
	for i, c := range conns {
		ids[i] = c.ID
	}
	return ids, nil
}

func (r *dynamoRepository) GetAllConnections(ctx context.Context) ([]WebSocketConnection, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(r.connTable),
	})
	if err != nil {
		return nil, err
	}
	var conns []WebSocketConnection
	err = attributevalue.UnmarshalListOfMaps(result.Items, &conns)
	return conns, err
}

// Logs
func (r *dynamoRepository) CreateDeliveryLog(ctx context.Context, log *DeliveryLog) error {
	if log.ID.IsZero() {
		log.ID = primitive.NewObjectID()
	}
	log.Timestamp = time.Now()
	item, err := attributevalue.MarshalMap(log)
	if err != nil {
		return err
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.logTable),
		Item:      item,
	})
	return err
}

func (r *dynamoRepository) GetDeliveryLog(ctx context.Context, id primitive.ObjectID) (*DeliveryLog, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.logTable),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id.Hex()},
		},
	})
	if err != nil {
		return nil, err
	}
	if result.Item == nil {
		return nil, fmt.Errorf("delivery log %s not found", id.Hex())
	}
	var l DeliveryLog
	err = attributevalue.UnmarshalMap(result.Item, &l)
	return &l, err
}
