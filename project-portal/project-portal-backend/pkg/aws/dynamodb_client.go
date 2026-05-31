package aws

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// DynamoDBConfig holds credentials and overrides for the DynamoDB client.
type DynamoDBConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string // Optional: For LocalStack / local dynamo emulator
}

// ConnectionRecord represents a WebSocket connection stored in DynamoDB
type ConnectionRecord struct {
	ConnectionID string    `dynamodbav:"PK"` // Partition Key
	UserID       string    `dynamodbav:"UserID"`
	ProjectIDs   []string  `dynamodbav:"ProjectIDs"`
	ConnectedAt  time.Time `dynamodbav:"ConnectedAt"`
	LastActivity time.Time `dynamodbav:"LastActivity"`
	UserAgent    string    `dynamodbav:"UserAgent,omitempty"`
	IPAddress    string    `dynamodbav:"IPAddress,omitempty"`
	TTL          int64     `dynamodbav:"TTL,omitempty"` // Unix timestamp for TTL (time-to-live)
}

// SessionRecord represents an active user session token cached in DynamoDB
type SessionRecord struct {
	Token        string                 `dynamodbav:"PK"` // Partition Key (SESS#token)
	UserID       string                 `dynamodbav:"UserID"`
	CreatedAt    time.Time              `dynamodbav:"CreatedAt"`
	ExpiresAt    time.Time              `dynamodbav:"ExpiresAt"`
	LastActivity time.Time              `dynamodbav:"LastActivity"`
	Metadata     map[string]interface{} `dynamodbav:"Metadata,omitempty"`
	IsActive     bool                   `dynamodbav:"IsActive"`
	TTL          int64                  `dynamodbav:"TTL,omitempty"` // Unix timestamp for TTL
}

// DynamoDBClient specifies the capability set of our Go DynamoDB package.
type DynamoDBClient interface {
	// PutConnection registers or overwrites a WebSocket connection record
	PutConnection(ctx context.Context, conn *ConnectionRecord) error

	// PutConnectionConditional registers a connection only if it doesn't already exist
	PutConnectionConditional(ctx context.Context, conn *ConnectionRecord) error

	// GetConnection retrieves a WebSocket connection record by its ConnectionID
	GetConnection(ctx context.Context, connectionID string) (*ConnectionRecord, error)

	// DeleteConnection removes a WebSocket connection record by its ConnectionID
	DeleteConnection(ctx context.Context, connectionID string) error

	// ListConnectionsByUser scans or queries connections for a specific UserID
	ListConnectionsByUser(ctx context.Context, userID string) ([]ConnectionRecord, error)

	// ListConnectionsByProject scans or queries connections for a specific ProjectID
	ListConnectionsByProject(ctx context.Context, projectID string) ([]ConnectionRecord, error)

	// PutSession registers or overwrites a session record
	PutSession(ctx context.Context, session *SessionRecord) error

	// GetSession retrieves a session record by its token string
	GetSession(ctx context.Context, token string) (*SessionRecord, error)

	// DeleteSession removes a session by its token string
	DeleteSession(ctx context.Context, token string) error

	// UpdateSessionActivity refreshes the last active timestamp and TTL for a session
	UpdateSessionActivity(ctx context.Context, token string, newTTL time.Duration) error
}

// DynamoDBAPI defines the exact DynamoDB SDK client methods we use.
// This interface allows for full mocking during unit testing.
type DynamoDBAPI interface {
	PutItem(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	GetItem(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	DeleteItem(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error)
	UpdateItem(ctx context.Context, params *dynamodb.UpdateItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.UpdateItemOutput, error)
	Scan(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error)
}

// Client wraps the AWS DynamoDB SDK v2 client.
type Client struct {
	client           DynamoDBAPI
	connectionsTable string
	sessionsTable    string
	maxRetries       int
	backoffBase      time.Duration
}

// Verify that *Client implements DynamoDBClient
var _ DynamoDBClient = (*Client)(nil)

// NewDynamoDBClient initializes a production-ready Client utilizing AWS SDK v2.
func NewDynamoDBClient(cfg DynamoDBConfig, connectionsTable, sessionsTable string) (*Client, error) {
	if connectionsTable == "" {
		connectionsTable = "WebSocketConnections"
	}
	if sessionsTable == "" {
		sessionsTable = "UserPreferences" // fallback/default to generic preference/session store table if empty
	}

	opts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
	}

	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	awsCfg, err := config.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	var ddbClientOpts []func(*dynamodb.Options)
	if cfg.Endpoint != "" {
		ddbClientOpts = append(ddbClientOpts, func(o *dynamodb.Options) {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		})
	}

	dbClient := dynamodb.NewFromConfig(awsCfg, ddbClientOpts...)

	return &Client{
		client:           dbClient,
		connectionsTable: connectionsTable,
		sessionsTable:    sessionsTable,
		maxRetries:       3,
		backoffBase:      50 * time.Millisecond,
	}, nil
}

// executeWithRetry wraps a database call with exponential backoff for retrying transient or throttling errors.
func (c *Client) executeWithRetry(ctx context.Context, opName string, fn func() (interface{}, error)) (interface{}, error) {
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * c.backoffBase
			log.Printf("[DynamoDB] %s: attempt %d failed, retrying in %v. Error: %v", opName, attempt, backoff, lastErr)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		res, err := fn()
		if err == nil {
			return res, nil
		}

		lastErr = err

		// Only retry transient/throttling errors or server side errors
		var provisionedErr *types.ProvisionedThroughputExceededException
		var requestLimitErr *types.RequestLimitExceeded
		var internalErr *types.InternalServerError

		if errors.As(err, &provisionedErr) || errors.As(err, &requestLimitErr) || errors.As(err, &internalErr) {
			continue
		}

		// Don't retry client errors like validation or conditional check failures
		break
	}
	return nil, fmt.Errorf("%s failed after %d retries: %w", opName, c.maxRetries, lastErr)
}

// PutConnection stores a connection record.
func (c *Client) PutConnection(ctx context.Context, conn *ConnectionRecord) error {
	av, err := attributevalue.MarshalMap(conn)
	if err != nil {
		return fmt.Errorf("failed to marshal ConnectionRecord: %w", err)
	}

	_, err = c.executeWithRetry(ctx, "PutConnection", func() (interface{}, error) {
		return c.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(c.connectionsTable),
			Item:      av,
		})
	})
	return err
}

// PutConnectionConditional registers a connection only if it does NOT already exist.
func (c *Client) PutConnectionConditional(ctx context.Context, conn *ConnectionRecord) error {
	av, err := attributevalue.MarshalMap(conn)
	if err != nil {
		return fmt.Errorf("failed to marshal ConnectionRecord: %w", err)
	}

	_, err = c.executeWithRetry(ctx, "PutConnectionConditional", func() (interface{}, error) {
		return c.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName:           aws.String(c.connectionsTable),
			Item:                av,
			ConditionExpression: aws.String("attribute_not_exists(PK)"),
		})
	})

	var condErr *types.ConditionalCheckFailedException
	if errors.As(err, &condErr) {
		return fmt.Errorf("connection %s already exists: %w", conn.ConnectionID, err)
	}
	return err
}

// GetConnection retrieves a connection record.
func (c *Client) GetConnection(ctx context.Context, connectionID string) (*ConnectionRecord, error) {
	key := map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: connectionID},
	}

	res, err := c.executeWithRetry(ctx, "GetConnection", func() (interface{}, error) {
		return c.client.GetItem(ctx, &dynamodb.GetItemInput{
			TableName: aws.String(c.connectionsTable),
			Key:       key,
		})
	})
	if err != nil {
		return nil, err
	}

	getItemOut := res.(*dynamodb.GetItemOutput)
	if getItemOut.Item == nil {
		return nil, nil // Connection record not found
	}

	var conn ConnectionRecord
	if err := attributevalue.UnmarshalMap(getItemOut.Item, &conn); err != nil {
		return nil, fmt.Errorf("failed to unmarshal ConnectionRecord: %w", err)
	}
	return &conn, nil
}

// DeleteConnection deletes a connection record.
func (c *Client) DeleteConnection(ctx context.Context, connectionID string) error {
	key := map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: connectionID},
	}

	_, err := c.executeWithRetry(ctx, "DeleteConnection", func() (interface{}, error) {
		return c.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
			TableName: aws.String(c.connectionsTable),
			Key:       key,
		})
	})
	return err
}

// ListConnectionsByUser scans connections for a specific UserID.
func (c *Client) ListConnectionsByUser(ctx context.Context, userID string) ([]ConnectionRecord, error) {
	// Using a Scan with filter expression because PK is ConnectionID (UUID/hash).
	// In production, a GSI on UserID is recommended.
	res, err := c.executeWithRetry(ctx, "ListConnectionsByUser", func() (interface{}, error) {
		return c.client.Scan(ctx, &dynamodb.ScanInput{
			TableName:         aws.String(c.connectionsTable),
			FilterExpression:  aws.String("UserID = :uid"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":uid": &types.AttributeValueMemberS{Value: userID},
			},
		})
	})
	if err != nil {
		return nil, err
	}

	scanOut := res.(*dynamodb.ScanOutput)
	var conns []ConnectionRecord
	if err := attributevalue.UnmarshalListOfMaps(scanOut.Items, &conns); err != nil {
		return nil, fmt.Errorf("failed to unmarshal connections list: %w", err)
	}
	return conns, nil
}

// ListConnectionsByProject scans connections for a specific ProjectID.
func (c *Client) ListConnectionsByProject(ctx context.Context, projectID string) ([]ConnectionRecord, error) {
	// ProjectIDs is a string set or list in DynamoDB, we check if it contains the projectID.
	res, err := c.executeWithRetry(ctx, "ListConnectionsByProject", func() (interface{}, error) {
		return c.client.Scan(ctx, &dynamodb.ScanInput{
			TableName:         aws.String(c.connectionsTable),
			FilterExpression:  aws.String("contains(ProjectIDs, :pid)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pid": &types.AttributeValueMemberS{Value: projectID},
			},
		})
	})
	if err != nil {
		return nil, err
	}

	scanOut := res.(*dynamodb.ScanOutput)
	var conns []ConnectionRecord
	if err := attributevalue.UnmarshalListOfMaps(scanOut.Items, &conns); err != nil {
		return nil, fmt.Errorf("failed to unmarshal connections list: %w", err)
	}
	return conns, nil
}

// PutSession stores a session record.
func (c *Client) PutSession(ctx context.Context, session *SessionRecord) error {
	// Prefix the key to keep namespaces clean
	sessionKey := fmt.Sprintf("SESS#%s", session.Token)
	
	// Create a copy of the session record with the prefixed PK
	type PrefixedSessionRecord struct {
		SessionRecord
		PK string `dynamodbav:"PK"`
	}

	rec := PrefixedSessionRecord{
		SessionRecord: *session,
		PK:            sessionKey,
	}

	av, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return fmt.Errorf("failed to marshal SessionRecord: %w", err)
	}

	_, err = c.executeWithRetry(ctx, "PutSession", func() (interface{}, error) {
		return c.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(c.sessionsTable),
			Item:      av,
		})
	})
	return err
}

// GetSession retrieves a session record.
func (c *Client) GetSession(ctx context.Context, token string) (*SessionRecord, error) {
	sessionKey := fmt.Sprintf("SESS#%s", token)
	key := map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: sessionKey},
	}

	res, err := c.executeWithRetry(ctx, "GetSession", func() (interface{}, error) {
		return c.client.GetItem(ctx, &dynamodb.GetItemInput{
			TableName: aws.String(c.sessionsTable),
			Key:       key,
		})
	})
	if err != nil {
		return nil, err
	}

	getItemOut := res.(*dynamodb.GetItemOutput)
	if getItemOut.Item == nil {
		return nil, nil // Session not found
	}

	var session SessionRecord
	if err := attributevalue.UnmarshalMap(getItemOut.Item, &session); err != nil {
		return nil, fmt.Errorf("failed to unmarshal SessionRecord: %w", err)
	}
	
	// Strip the "SESS#" prefix from the returned Token to keep client-side clean
	session.Token = token
	
	// Expired session check based on ExpiresAt or TTL
	if !session.ExpiresAt.IsZero() && session.ExpiresAt.Before(time.Now()) {
		log.Printf("[DynamoDB] GetSession: Session %s has expired", token)
		return nil, nil // Return nil to indicate no valid active session
	}

	return &session, nil
}

// DeleteSession deletes a session record.
func (c *Client) DeleteSession(ctx context.Context, token string) error {
	sessionKey := fmt.Sprintf("SESS#%s", token)
	key := map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: sessionKey},
	}

	_, err := c.executeWithRetry(ctx, "DeleteSession", func() (interface{}, error) {
		return c.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
			TableName: aws.String(c.sessionsTable),
			Key:       key,
		})
	})
	return err
}

// UpdateSessionActivity refreshes the session last activity and TTL.
func (c *Client) UpdateSessionActivity(ctx context.Context, token string, newTTL time.Duration) error {
	sessionKey := fmt.Sprintf("SESS#%s", token)
	key := map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: sessionKey},
	}

	now := time.Now().UTC()
	newExpires := now.Add(newTTL)
	newTTLTimestamp := newExpires.Unix()

	_, err := c.executeWithRetry(ctx, "UpdateSessionActivity", func() (interface{}, error) {
		return c.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName:           aws.String(c.sessionsTable),
			Key:                 key,
			UpdateExpression:    aws.String("SET LastActivity = :now, ExpiresAt = :expires, TTL = :ttl"),
			ConditionExpression: aws.String("attribute_exists(PK)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":now":     &types.AttributeValueMemberS{Value: now.Format(time.RFC3339)},
				":expires": &types.AttributeValueMemberS{Value: newExpires.Format(time.RFC3339)},
				":ttl":     &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", newTTLTimestamp)},
			},
		})
	})
	return err
}
