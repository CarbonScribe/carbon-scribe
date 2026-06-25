package aws

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/stretchr/testify/assert"
)

// MockDynamoDB implements DynamoDBAPI for unit testing.
type MockDynamoDB struct {
	PutItemFunc    func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	GetItemFunc    func(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	DeleteItemFunc func(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error)
	UpdateItemFunc func(ctx context.Context, params *dynamodb.UpdateItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.UpdateItemOutput, error)
	ScanFunc       func(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error)
}

func (m *MockDynamoDB) PutItem(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
	if m.PutItemFunc != nil {
		return m.PutItemFunc(ctx, params, optFns...)
	}
	return &dynamodb.PutItemOutput{}, nil
}

func (m *MockDynamoDB) GetItem(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
	if m.GetItemFunc != nil {
		return m.GetItemFunc(ctx, params, optFns...)
	}
	return &dynamodb.GetItemOutput{}, nil
}

func (m *MockDynamoDB) DeleteItem(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error) {
	if m.DeleteItemFunc != nil {
		return m.DeleteItemFunc(ctx, params, optFns...)
	}
	return &dynamodb.DeleteItemOutput{}, nil
}

func (m *MockDynamoDB) UpdateItem(ctx context.Context, params *dynamodb.UpdateItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.UpdateItemOutput, error) {
	if m.UpdateItemFunc != nil {
		return m.UpdateItemFunc(ctx, params, optFns...)
	}
	return &dynamodb.UpdateItemOutput{}, nil
}

func (m *MockDynamoDB) Scan(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error) {
	if m.ScanFunc != nil {
		return m.ScanFunc(ctx, params, optFns...)
	}
	return &dynamodb.ScanOutput{}, nil
}

func TestPutConnection(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:           mockDDB,
		connectionsTable: "ConnectionsTable",
		maxRetries:       0,
	}

	conn := &ConnectionRecord{
		ConnectionID: "conn-123",
		UserID:       "user-456",
		ProjectIDs:   []string{"proj-abc"},
		ConnectedAt:  time.Now(),
		LastActivity: time.Now(),
	}

	called := false
	mockDDB.PutItemFunc = func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
		assert.Equal(t, "ConnectionsTable", *params.TableName)
		called = true
		return &dynamodb.PutItemOutput{}, nil
	}

	err := client.PutConnection(context.Background(), conn)
	assert.NoError(t, err)
	assert.True(t, called)
}

func TestPutConnectionConditional(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:           mockDDB,
			connectionsTable: "ConnectionsTable",
			maxRetries:       0,
		}

		conn := &ConnectionRecord{
			ConnectionID: "conn-123",
			UserID:       "user-456",
		}

		called := false
		mockDDB.PutItemFunc = func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
			assert.Equal(t, "attribute_not_exists(PK)", *params.ConditionExpression)
			called = true
			return &dynamodb.PutItemOutput{}, nil
		}

		err := client.PutConnectionConditional(context.Background(), conn)
		assert.NoError(t, err)
		assert.True(t, called)
	})

	t.Run("condition failed", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:           mockDDB,
			connectionsTable: "ConnectionsTable",
			maxRetries:       0,
		}

		conn := &ConnectionRecord{
			ConnectionID: "conn-123",
		}

		mockDDB.PutItemFunc = func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
			return nil, &types.ConditionalCheckFailedException{
				Message: aws.String("Conditional check failed"),
			}
		}

		err := client.PutConnectionConditional(context.Background(), conn)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "already exists")
	})
}

func TestGetConnection(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:           mockDDB,
			connectionsTable: "ConnectionsTable",
			maxRetries:       0,
		}

		conn := &ConnectionRecord{
			ConnectionID: "conn-123",
			UserID:       "user-456",
			ProjectIDs:   []string{"proj-abc"},
		}

		mockDDB.GetItemFunc = func(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
			assert.Equal(t, "conn-123", params.Key["PK"].(*types.AttributeValueMemberS).Value)
			
			av, err := attributevalue.MarshalMap(conn)
			assert.NoError(t, err)
			return &dynamodb.GetItemOutput{Item: av}, nil
		}

		res, err := client.GetConnection(context.Background(), "conn-123")
		assert.NoError(t, err)
		assert.NotNil(t, res)
		assert.Equal(t, "user-456", res.UserID)
	})

	t.Run("not found", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:           mockDDB,
			connectionsTable: "ConnectionsTable",
			maxRetries:       0,
		}

		mockDDB.GetItemFunc = func(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
			return &dynamodb.GetItemOutput{Item: nil}, nil
		}

		res, err := client.GetConnection(context.Background(), "non-existent")
		assert.NoError(t, err)
		assert.Nil(t, res)
	})
}

func TestDeleteConnection(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:           mockDDB,
		connectionsTable: "ConnectionsTable",
		maxRetries:       0,
	}

	called := false
	mockDDB.DeleteItemFunc = func(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error) {
		assert.Equal(t, "conn-123", params.Key["PK"].(*types.AttributeValueMemberS).Value)
		called = true
		return &dynamodb.DeleteItemOutput{}, nil
	}

	err := client.DeleteConnection(context.Background(), "conn-123")
	assert.NoError(t, err)
	assert.True(t, called)
}

func TestListConnectionsByUser(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:           mockDDB,
		connectionsTable: "ConnectionsTable",
		maxRetries:       0,
	}

	mockDDB.ScanFunc = func(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error) {
		assert.Equal(t, "UserID = :uid", *params.FilterExpression)
		assert.Equal(t, "user-456", params.ExpressionAttributeValues[":uid"].(*types.AttributeValueMemberS).Value)

		records := []ConnectionRecord{
			{ConnectionID: "conn-1", UserID: "user-456"},
			{ConnectionID: "conn-2", UserID: "user-456"},
		}
		
		var items []map[string]types.AttributeValue
		for _, rec := range records {
			av, err := attributevalue.MarshalMap(rec)
			assert.NoError(t, err)
			items = append(items, av)
		}

		return &dynamodb.ScanOutput{Items: items}, nil
	}

	res, err := client.ListConnectionsByUser(context.Background(), "user-456")
	assert.NoError(t, err)
	assert.Len(t, res, 2)
	assert.Equal(t, "conn-1", res[0].ConnectionID)
}

func TestListConnectionsByProject(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:           mockDDB,
		connectionsTable: "ConnectionsTable",
		maxRetries:       0,
	}

	mockDDB.ScanFunc = func(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error) {
		assert.Equal(t, "contains(ProjectIDs, :pid)", *params.FilterExpression)
		assert.Equal(t, "proj-123", params.ExpressionAttributeValues[":pid"].(*types.AttributeValueMemberS).Value)

		records := []ConnectionRecord{
			{ConnectionID: "conn-1", UserID: "user-a", ProjectIDs: []string{"proj-123"}},
		}

		var items []map[string]types.AttributeValue
		for _, rec := range records {
			av, err := attributevalue.MarshalMap(rec)
			assert.NoError(t, err)
			items = append(items, av)
		}

		return &dynamodb.ScanOutput{Items: items}, nil
	}

	res, err := client.ListConnectionsByProject(context.Background(), "proj-123")
	assert.NoError(t, err)
	assert.Len(t, res, 1)
	assert.Equal(t, "conn-1", res[0].ConnectionID)
}

func TestPutSession(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:        mockDDB,
		sessionsTable: "SessionsTable",
		maxRetries:    0,
	}

	session := &SessionRecord{
		Token:     "token-xyz",
		UserID:    "user-456",
		ExpiresAt: time.Now().Add(1 * time.Hour),
		IsActive:  true,
	}

	called := false
	mockDDB.PutItemFunc = func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
		assert.Equal(t, "SessionsTable", *params.TableName)
		assert.Equal(t, "SESS#token-xyz", params.Item["PK"].(*types.AttributeValueMemberS).Value)
		called = true
		return &dynamodb.PutItemOutput{}, nil
	}

	err := client.PutSession(context.Background(), session)
	assert.NoError(t, err)
	assert.True(t, called)
}

func TestGetSession(t *testing.T) {
	t.Run("valid active session", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:        mockDDB,
			sessionsTable: "SessionsTable",
			maxRetries:    0,
		}

		session := &SessionRecord{
			Token:     "token-xyz",
			UserID:    "user-456",
			ExpiresAt: time.Now().Add(1 * time.Hour),
			IsActive:  true,
		}

		mockDDB.GetItemFunc = func(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
			assert.Equal(t, "SESS#token-xyz", params.Key["PK"].(*types.AttributeValueMemberS).Value)

			av, err := attributevalue.MarshalMap(session)
			assert.NoError(t, err)
			
			// Include PK explicitly since the client unmarshals it
			av["PK"] = &types.AttributeValueMemberS{Value: "SESS#token-xyz"}
			
			return &dynamodb.GetItemOutput{Item: av}, nil
		}

		res, err := client.GetSession(context.Background(), "token-xyz")
		assert.NoError(t, err)
		assert.NotNil(t, res)
		assert.Equal(t, "token-xyz", res.Token)
		assert.Equal(t, "user-456", res.UserID)
	})

	t.Run("expired session", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:        mockDDB,
			sessionsTable: "SessionsTable",
			maxRetries:    0,
		}

		session := &SessionRecord{
			Token:     "token-xyz",
			UserID:    "user-456",
			ExpiresAt: time.Now().Add(-1 * time.Hour), // Expired 1 hour ago
			IsActive:  true,
		}

		mockDDB.GetItemFunc = func(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
			av, err := attributevalue.MarshalMap(session)
			assert.NoError(t, err)
			av["PK"] = &types.AttributeValueMemberS{Value: "SESS#token-xyz"}
			return &dynamodb.GetItemOutput{Item: av}, nil
		}

		res, err := client.GetSession(context.Background(), "token-xyz")
		assert.NoError(t, err)
		assert.Nil(t, res) // Should return nil, nil indicating expired session is no longer active
	})
}

func TestDeleteSession(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:        mockDDB,
		sessionsTable: "SessionsTable",
		maxRetries:    0,
	}

	called := false
	mockDDB.DeleteItemFunc = func(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error) {
		assert.Equal(t, "SESS#token-xyz", params.Key["PK"].(*types.AttributeValueMemberS).Value)
		called = true
		return &dynamodb.DeleteItemOutput{}, nil
	}

	err := client.DeleteSession(context.Background(), "token-xyz")
	assert.NoError(t, err)
	assert.True(t, called)
}

func TestUpdateSessionActivity(t *testing.T) {
	mockDDB := &MockDynamoDB{}
	client := &Client{
		client:        mockDDB,
		sessionsTable: "SessionsTable",
		maxRetries:    0,
	}

	called := false
	mockDDB.UpdateItemFunc = func(ctx context.Context, params *dynamodb.UpdateItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.UpdateItemOutput, error) {
		assert.Equal(t, "SESS#token-xyz", params.Key["PK"].(*types.AttributeValueMemberS).Value)
		assert.Equal(t, "SET LastActivity = :now, ExpiresAt = :expires, TTL = :ttl", *params.UpdateExpression)
		assert.Equal(t, "attribute_exists(PK)", *params.ConditionExpression)
		called = true
		return &dynamodb.UpdateItemOutput{}, nil
	}

	err := client.UpdateSessionActivity(context.Background(), "token-xyz", 30*time.Minute)
	assert.NoError(t, err)
	assert.True(t, called)
}

func TestRetryLogic(t *testing.T) {
	t.Run("eventual success after retries", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:           mockDDB,
			connectionsTable: "ConnectionsTable",
			maxRetries:       2,
			backoffBase:      1 * time.Millisecond,
		}

		conn := &ConnectionRecord{
			ConnectionID: "conn-123",
		}

		attempts := 0
		mockDDB.PutItemFunc = func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
			attempts++
			if attempts < 3 {
				// Return transient throttling error on first two attempts
				return nil, &types.RequestLimitExceeded{
					Message: aws.String("Rate limit exceeded"),
				}
			}
			return &dynamodb.PutItemOutput{}, nil
		}

		err := client.PutConnection(context.Background(), conn)
		assert.NoError(t, err)
		assert.Equal(t, 3, attempts)
	})

	t.Run("exhausted retries", func(t *testing.T) {
		mockDDB := &MockDynamoDB{}
		client := &Client{
			client:           mockDDB,
			connectionsTable: "ConnectionsTable",
			maxRetries:       2,
			backoffBase:      1 * time.Millisecond,
		}

		conn := &ConnectionRecord{
			ConnectionID: "conn-123",
		}

		attempts := 0
		mockDDB.PutItemFunc = func(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
			attempts++
			return nil, &types.ProvisionedThroughputExceededException{
				Message: aws.String("Provisioned throughput exceeded"),
			}
		}

		err := client.PutConnection(context.Background(), conn)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed after 2 retries")
		assert.Equal(t, 3, attempts) // 1 initial + 2 retries
	})
}
