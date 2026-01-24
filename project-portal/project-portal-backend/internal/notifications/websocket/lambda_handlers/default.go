package lambda_handlers

import (
	"context"
	"encoding/json"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	awspkg "carbon-scribe/project-portal/project-portal-backend/pkg/aws"
	wspkg "carbon-scribe/project-portal/project-portal-backend/pkg/websocket"
)

// DefaultHandler handles WebSocket $default route (messages)
type DefaultHandler struct {
	db          *awspkg.DynamoDBClient
	apiGateway  *awspkg.APIGatewayClient
	tableName   string
}

// NewDefaultHandler creates a new default message handler
func NewDefaultHandler(db *awspkg.DynamoDBClient, apiGateway *awspkg.APIGatewayClient, tableName string) *DefaultHandler {
	return &DefaultHandler{
		db:         db,
		apiGateway: apiGateway,
		tableName:  tableName,
	}
}

// Handle handles incoming WebSocket messages
func (h *DefaultHandler) Handle(ctx context.Context, request events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	connectionID := request.RequestContext.ConnectionID

	// Parse the message
	message, err := wspkg.ParseMessage([]byte(request.Body))
	if err != nil {
		return h.sendError(ctx, connectionID, "PARSE_ERROR", "Invalid message format")
	}

	// Update last activity
	if err := h.updateLastActivity(ctx, connectionID); err != nil {
		// Log but don't fail
	}

	// Handle message based on type
	switch message.Type {
	case wspkg.MessageTypePing:
		return h.handlePing(ctx, connectionID)
	case wspkg.MessageTypeSubscribe:
		return h.handleSubscribe(ctx, connectionID, message)
	case wspkg.MessageTypeUnsubscribe:
		return h.handleUnsubscribe(ctx, connectionID, message)
	case wspkg.MessageTypeAuth:
		return h.handleAuth(ctx, connectionID, message)
	default:
		// Echo unknown messages back with an error
		return h.sendError(ctx, connectionID, "UNKNOWN_TYPE", "Unknown message type")
	}
}

func (h *DefaultHandler) handlePing(ctx context.Context, connectionID string) (events.APIGatewayProxyResponse, error) {
	pong := wspkg.NewPongMessage()
	data, err := pong.ToJSON()
	if err != nil {
		return events.APIGatewayProxyResponse{StatusCode: 500}, nil
	}

	if err := h.apiGateway.PostToConnection(ctx, connectionID, data); err != nil {
		return events.APIGatewayProxyResponse{StatusCode: 500}, nil
	}

	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func (h *DefaultHandler) handleSubscribe(ctx context.Context, connectionID string, message *wspkg.Message) (events.APIGatewayProxyResponse, error) {
	channels, ok := message.Payload["channels"].([]interface{})
	if !ok {
		return h.sendError(ctx, connectionID, "INVALID_PAYLOAD", "channels must be an array")
	}

	// Get current connection
	conn, err := h.getConnection(ctx, connectionID)
	if err != nil || conn == nil {
		return h.sendError(ctx, connectionID, "NOT_FOUND", "Connection not found")
	}

	// Add new channels
	existingChannels := make(map[string]bool)
	for _, ch := range conn["channels"] {
		existingChannels[ch] = true
	}

	for _, ch := range channels {
		if channel, ok := ch.(string); ok {
			if !existingChannels[channel] {
				conn["channels"] = append(conn["channels"], channel)
			}
		}
	}

	// Save updated connection
	// TODO: Implement proper update

	// Send acknowledgment
	ack := wspkg.NewAckMessage(message.ID)
	data, _ := ack.ToJSON()
	h.apiGateway.PostToConnection(ctx, connectionID, data)

	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func (h *DefaultHandler) handleUnsubscribe(ctx context.Context, connectionID string, message *wspkg.Message) (events.APIGatewayProxyResponse, error) {
	channels, ok := message.Payload["channels"].([]interface{})
	if !ok {
		return h.sendError(ctx, connectionID, "INVALID_PAYLOAD", "channels must be an array")
	}

	// Get current connection and remove channels
	conn, err := h.getConnection(ctx, connectionID)
	if err != nil || conn == nil {
		return h.sendError(ctx, connectionID, "NOT_FOUND", "Connection not found")
	}

	// Remove channels from set
	channelsToRemove := make(map[string]bool)
	for _, ch := range channels {
		if channel, ok := ch.(string); ok {
			channelsToRemove[channel] = true
		}
	}

	newChannels := make([]string, 0)
	for _, ch := range conn["channels"] {
		if !channelsToRemove[ch] {
			newChannels = append(newChannels, ch)
		}
	}
	conn["channels"] = newChannels

	// Send acknowledgment
	ack := wspkg.NewAckMessage(message.ID)
	data, _ := ack.ToJSON()
	h.apiGateway.PostToConnection(ctx, connectionID, data)

	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func (h *DefaultHandler) handleAuth(ctx context.Context, connectionID string, message *wspkg.Message) (events.APIGatewayProxyResponse, error) {
	token, ok := message.Payload["token"].(string)
	if !ok || token == "" {
		return h.sendError(ctx, connectionID, "INVALID_PAYLOAD", "token is required")
	}

	// TODO: Validate JWT token and update connection with user info

	// Send acknowledgment
	ack := wspkg.NewAckMessage(message.ID)
	ack.Payload["authenticated"] = true
	data, _ := ack.ToJSON()
	h.apiGateway.PostToConnection(ctx, connectionID, data)

	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func (h *DefaultHandler) sendError(ctx context.Context, connectionID, code, message string) (events.APIGatewayProxyResponse, error) {
	errMsg := wspkg.NewErrorMessage(code, message)
	data, _ := errMsg.ToJSON()
	h.apiGateway.PostToConnection(ctx, connectionID, data)
	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func (h *DefaultHandler) updateLastActivity(ctx context.Context, connectionID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	pk := "CONNECTION#" + connectionID

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: pk},
		},
		UpdateExpression: aws.String("SET lastActivity = :now"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":now": &types.AttributeValueMemberS{Value: now},
		},
	}

	_, err := h.db.UpdateItem(ctx, input)
	return err
}

func (h *DefaultHandler) getConnection(ctx context.Context, connectionID string) (map[string][]string, error) {
	pk := "CONNECTION#" + connectionID

	key := map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: pk},
	}

	item, err := h.db.GetItem(ctx, h.tableName, key)
	if err != nil {
		return nil, err
	}

	if item == nil {
		return nil, nil
	}

	result := make(map[string][]string)
	
	// Parse channels
	if v, ok := item["channels"].(*types.AttributeValueMemberL); ok {
		channels := make([]string, 0)
		for _, av := range v.Value {
			if s, ok := av.(*types.AttributeValueMemberS); ok {
				channels = append(channels, s.Value)
			}
		}
		result["channels"] = channels
	}

	return result, nil
}

// BroadcastMessage broadcasts a message to all connections in specified channels
func (h *DefaultHandler) BroadcastMessage(ctx context.Context, channels []string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	// Get all connections subscribed to any of the channels
	for _, channel := range channels {
		connections, err := h.getConnectionsByChannel(ctx, channel)
		if err != nil {
			continue
		}

		for _, connID := range connections {
			h.apiGateway.PostToConnection(ctx, connID, data)
		}
	}

	return nil
}

func (h *DefaultHandler) getConnectionsByChannel(ctx context.Context, channel string) ([]string, error) {
	input := &dynamodb.ScanInput{
		TableName:        aws.String(h.tableName),
		FilterExpression: aws.String("contains(channels, :channel)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":channel": &types.AttributeValueMemberS{Value: channel},
		},
	}

	result, err := h.db.Scan(ctx, input)
	if err != nil {
		return nil, err
	}

	connections := make([]string, 0)
	for _, item := range result.Items {
		if v, ok := item["connectionId"].(*types.AttributeValueMemberS); ok {
			connections = append(connections, v.Value)
		}
	}

	return connections, nil
}
