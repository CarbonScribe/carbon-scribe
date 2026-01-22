package iot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
)

// MQTTClient handles MQTT connections for IoT sensor data
type MQTTClient struct {
	client       mqtt.Client
	config       MQTTConfig
	handlers     map[string]MessageHandler
	mu           sync.RWMutex
	connected    bool
	reconnecting bool
}

// MQTTConfig holds MQTT connection configuration
type MQTTConfig struct {
	BrokerURL      string
	ClientID       string
	Username       string
	Password       string
	QoS            byte
	CleanSession   bool
	KeepAlive      int
	ConnectTimeout time.Duration
	AutoReconnect  bool
}

// MessageHandler processes incoming MQTT messages
type MessageHandler func(topic string, payload []byte) error

// NewMQTTClient creates a new MQTT client
func NewMQTTClient(config MQTTConfig) (*MQTTClient, error) {
	if config.BrokerURL == "" {
		return nil, errors.New("broker URL is required")
	}

	if config.ClientID == "" {
		config.ClientID = fmt.Sprintf("carbon-scribe-%s", uuid.New().String()[:8])
	}

	if config.KeepAlive == 0 {
		config.KeepAlive = 60
	}

	if config.ConnectTimeout == 0 {
		config.ConnectTimeout = 10 * time.Second
	}

	mqttClient := &MQTTClient{
		config:   config,
		handlers: make(map[string]MessageHandler),
	}

	// Configure MQTT options
	opts := mqtt.NewClientOptions()
	opts.AddBroker(config.BrokerURL)
	opts.SetClientID(config.ClientID)
	opts.SetUsername(config.Username)
	opts.SetPassword(config.Password)
	opts.SetCleanSession(config.CleanSession)
	opts.SetKeepAlive(time.Duration(config.KeepAlive) * time.Second)
	opts.SetConnectTimeout(config.ConnectTimeout)
	opts.SetAutoReconnect(config.AutoReconnect)

	// Set connection handlers
	opts.SetOnConnectHandler(mqttClient.onConnect)
	opts.SetConnectionLostHandler(mqttClient.onConnectionLost)
	opts.SetReconnectingHandler(mqttClient.onReconnecting)

	mqttClient.client = mqtt.NewClient(opts)

	return mqttClient, nil
}

// Connect establishes connection to MQTT broker
func (m *MQTTClient) Connect(ctx context.Context) error {
	token := m.client.Connect()

	// Wait for connection with context timeout
	select {
	case <-token.Done():
		if token.Error() != nil {
			return fmt.Errorf("failed to connect to MQTT broker: %w", token.Error())
		}
		m.connected = true
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Disconnect closes the MQTT connection
func (m *MQTTClient) Disconnect() {
	m.client.Disconnect(250)
	m.connected = false
}

// IsConnected returns the connection status
func (m *MQTTClient) IsConnected() bool {
	return m.connected && m.client.IsConnected()
}

// Subscribe subscribes to an MQTT topic with a message handler
func (m *MQTTClient) Subscribe(topic string, handler MessageHandler) error {
	if !m.IsConnected() {
		return errors.New("not connected to MQTT broker")
	}

	// Store handler
	m.mu.Lock()
	m.handlers[topic] = handler
	m.mu.Unlock()

	// Subscribe to topic
	token := m.client.Subscribe(topic, m.config.QoS, func(client mqtt.Client, msg mqtt.Message) {
		m.handleMessage(msg.Topic(), msg.Payload())
	})

	token.Wait()
	if token.Error() != nil {
		return fmt.Errorf("failed to subscribe to topic %s: %w", topic, token.Error())
	}

	return nil
}

// Unsubscribe unsubscribes from an MQTT topic
func (m *MQTTClient) Unsubscribe(topic string) error {
	if !m.IsConnected() {
		return errors.New("not connected to MQTT broker")
	}

	// Remove handler
	m.mu.Lock()
	delete(m.handlers, topic)
	m.mu.Unlock()

	// Unsubscribe from topic
	token := m.client.Unsubscribe(topic)
	token.Wait()
	if token.Error() != nil {
		return fmt.Errorf("failed to unsubscribe from topic %s: %w", topic, token.Error())
	}

	return nil
}

// Publish publishes a message to an MQTT topic
func (m *MQTTClient) Publish(topic string, payload interface{}) error {
	if !m.IsConnected() {
		return errors.New("not connected to MQTT broker")
	}

	// Convert payload to bytes
	var data []byte
	var err error

	switch v := payload.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		data, err = json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
	}

	// Publish message
	token := m.client.Publish(topic, m.config.QoS, false, data)
	token.Wait()
	if token.Error() != nil {
		return fmt.Errorf("failed to publish to topic %s: %w", topic, token.Error())
	}

	return nil
}

// handleMessage routes incoming messages to registered handlers
func (m *MQTTClient) handleMessage(topic string, payload []byte) {
	m.mu.RLock()
	handler, exists := m.handlers[topic]
	m.mu.RUnlock()

	if !exists {
		fmt.Printf("No handler registered for topic: %s\n", topic)
		return
	}

	if err := handler(topic, payload); err != nil {
		fmt.Printf("Error handling message from topic %s: %v\n", topic, err)
	}
}

// onConnect is called when connection is established
func (m *MQTTClient) onConnect(client mqtt.Client) {
	m.connected = true
	m.reconnecting = false
	fmt.Println("Connected to MQTT broker")

	// Resubscribe to all topics after reconnection
	m.mu.RLock()
	topics := make([]string, 0, len(m.handlers))
	for topic := range m.handlers {
		topics = append(topics, topic)
	}
	m.mu.RUnlock()

	for _, topic := range topics {
		token := client.Subscribe(topic, m.config.QoS, func(client mqtt.Client, msg mqtt.Message) {
			m.handleMessage(msg.Topic(), msg.Payload())
		})
		token.Wait()
	}
}

// onConnectionLost is called when connection is lost
func (m *MQTTClient) onConnectionLost(client mqtt.Client, err error) {
	m.connected = false
	fmt.Printf("Connection to MQTT broker lost: %v\n", err)
}

// onReconnecting is called when attempting to reconnect
func (m *MQTTClient) onReconnecting(client mqtt.Client, opts *mqtt.ClientOptions) {
	m.reconnecting = true
	fmt.Println("Reconnecting to MQTT broker...")
}

// SensorDataParser handles parsing of different sensor data formats
type SensorDataParser struct{}

// NewSensorDataParser creates a new sensor data parser
func NewSensorDataParser() *SensorDataParser {
	return &SensorDataParser{}
}

// ParseSensorReading parses a sensor reading from raw bytes
func (p *SensorDataParser) ParseSensorReading(payload []byte, defaultProjectID uuid.UUID) (*monitoring.SensorReading, error) {
	var data map[string]interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	reading := &monitoring.SensorReading{
		Time:        time.Now(),
		ProjectID:   defaultProjectID,
		DataQuality: "good",
	}

	// Extract sensor ID
	if sensorID, ok := data["sensor_id"].(string); ok {
		reading.SensorID = sensorID
	} else {
		return nil, errors.New("sensor_id is required")
	}

	// Extract sensor type
	if sensorType, ok := data["sensor_type"].(string); ok {
		reading.SensorType = sensorType
	} else if sensorType, ok := data["type"].(string); ok {
		reading.SensorType = sensorType
	} else {
		return nil, errors.New("sensor_type is required")
	}

	// Extract value
	if value, ok := data["value"].(float64); ok {
		reading.Value = value
	} else {
		return nil, errors.New("value is required")
	}

	// Extract unit
	if unit, ok := data["unit"].(string); ok {
		reading.Unit = unit
	} else {
		return nil, errors.New("unit is required")
	}

	// Extract optional fields
	if timestamp, ok := data["timestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339, timestamp); err == nil {
			reading.Time = t
		}
	}

	if projectIDStr, ok := data["project_id"].(string); ok {
		if projectID, err := uuid.Parse(projectIDStr); err == nil {
			reading.ProjectID = projectID
		}
	}

	if lat, ok := data["latitude"].(float64); ok {
		reading.Latitude = &lat
	}

	if lon, ok := data["longitude"].(float64); ok {
		reading.Longitude = &lon
	}

	if alt, ok := data["altitude"].(float64); ok {
		reading.AltitudeM = &alt
	}

	if battery, ok := data["battery_level"].(float64); ok {
		reading.BatteryLevel = &battery
	}

	if signal, ok := data["signal_strength"].(float64); ok {
		signalInt := int(signal)
		reading.SignalStrength = &signalInt
	}

	if quality, ok := data["data_quality"].(string); ok {
		reading.DataQuality = quality
	}

	// Extract metadata
	if metadata, ok := data["metadata"].(map[string]interface{}); ok {
		reading.Metadata = monitoring.JSONB(metadata)
	}

	return reading, nil
}

// ParseLoRaWANPayload parses LoRaWAN encoded sensor data
func (p *SensorDataParser) ParseLoRaWANPayload(payload []byte, sensorID, sensorType string, projectID uuid.UUID) (*monitoring.SensorReading, error) {
	// LoRaWAN payloads are typically binary encoded
	// This is a simplified example - actual implementation would depend on sensor encoding
	
	if len(payload) < 4 {
		return nil, errors.New("payload too short")
	}

	// Example: First 2 bytes = value (uint16), Next byte = battery, Last byte = signal
	value := float64(uint16(payload[0])<<8 | uint16(payload[1]))
	battery := float64(payload[2])
	signal := int(payload[3])

	return &monitoring.SensorReading{
		Time:           time.Now(),
		ProjectID:      projectID,
		SensorID:       sensorID,
		SensorType:     sensorType,
		Value:          value,
		Unit:           "raw", // Should be converted based on sensor type
		BatteryLevel:   &battery,
		SignalStrength: &signal,
		DataQuality:    "good",
	}, nil
}
