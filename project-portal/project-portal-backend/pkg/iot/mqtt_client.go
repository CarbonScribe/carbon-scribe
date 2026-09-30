// Package iot implements the MQTT telemetry client that ingests soil
// moisture, methane, and biomass sensor readings published by IoT devices
// through a broker, decoding and handing them off to the monitoring
// ingestion pipeline (internal/monitoring) so they become queryable via the
// existing GET /api/v1/monitoring/iot* endpoints.
package iot

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// SensorType enumerates the IoT sensor telemetry types this client
// subscribes to.
type SensorType string

const (
	SensorTypeSoilMoisture SensorType = "soil_moisture"
	SensorTypeMethane      SensorType = "methane"
	SensorTypeBiomass      SensorType = "biomass"
)

// subscribedSensorTypes lists every sensor type this client subscribes to
// on connect (and re-subscribes to on every reconnect).
var subscribedSensorTypes = []SensorType{
	SensorTypeSoilMoisture,
	SensorTypeMethane,
	SensorTypeBiomass,
}

// topicForSensorType returns the subscription pattern for a sensor type,
// following the sensors/{project_id}/{sensor_type} topic scheme — the
// project_id segment is a single-level MQTT wildcard ("+").
func topicForSensorType(t SensorType) string {
	return fmt.Sprintf("sensors/+/%s", t)
}

// sensorTypeFromTopic extracts the sensor type from a concrete topic a
// message was published on (the last "/"-separated segment).
func sensorTypeFromTopic(topic string) string {
	parts := strings.Split(topic, "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

// SensorPayload is the JSON schema published by soil moisture, methane, and
// biomass sensors alike. The payload shape is identical across all three
// sensor types in this system (a single numeric reading plus context), so
// one schema covers them; sensor_type is optional in the payload itself
// since it can always be inferred from the topic.
type SensorPayload struct {
	ProjectID      string               `json:"project_id"`
	SensorID       string               `json:"sensor_id"`
	SensorType     string               `json:"sensor_type,omitempty"`
	Value          float64              `json:"value"`
	Unit           string               `json:"unit"`
	Location       *monitoring.Location `json:"location,omitempty"`
	Metadata       map[string]string    `json:"metadata,omitempty"`
	CapturedAt     time.Time            `json:"captured_at"`
	DeviceID       string               `json:"device_id,omitempty"`
	BatteryLevel   *float64             `json:"battery_level,omitempty"`
	SignalStrength *int                 `json:"signal_strength,omitempty"`
}

// IoTIngester is the minimal contract the client needs to hand decoded
// telemetry into the monitoring ingestion pipeline. *monitoring.Service
// satisfies this in production; tests can supply a fake.
type IoTIngester interface {
	IngestIoT(ctx context.Context, req monitoring.IngestIoTRequest) (*monitoring.IoTReading, error)
}

// Config configures the MQTT telemetry client.
type Config struct {
	BrokerURL             string // e.g. "tls://broker.example.com:8883" or "tcp://localhost:1883"
	ClientID              string
	Username              string
	Password              string
	TLSCACertFile         string // optional custom CA for verifying the broker
	TLSCertFile           string // client certificate, for mutual TLS
	TLSKeyFile            string // client private key, for mutual TLS
	TLSInsecureSkipVerify bool   // dev-only; never enable in production

	QoS       byte // MQTT QoS level for subscriptions; 1 (at-least-once) by default
	QueueSize int  // bounded ingest queue capacity; default 1000
	Workers   int  // number of decode/ingest worker goroutines; default 4

	ConnectTimeout      time.Duration // how long Start waits for the initial connect attempt; default 10s
	ReconnectMinBackoff time.Duration // paho's initial reconnect delay; default 1s
	ReconnectMaxBackoff time.Duration // paho's maximum reconnect delay; default 60s
}

func (c Config) withDefaults() Config {
	if c.ClientID == "" {
		c.ClientID = fmt.Sprintf("project-portal-backend-%d", time.Now().UnixNano())
	}
	if c.QoS == 0 {
		c.QoS = 1
	}
	if c.QueueSize <= 0 {
		c.QueueSize = 1000
	}
	if c.Workers <= 0 {
		c.Workers = 4
	}
	if c.ConnectTimeout <= 0 {
		c.ConnectTimeout = 10 * time.Second
	}
	if c.ReconnectMinBackoff <= 0 {
		c.ReconnectMinBackoff = time.Second
	}
	if c.ReconnectMaxBackoff <= 0 {
		c.ReconnectMaxBackoff = 60 * time.Second
	}
	return c
}

// ConnectionStatus is a point-in-time snapshot of the client's broker
// connection health, suitable for exposing via a /health endpoint.
type ConnectionStatus struct {
	Connected        bool      `json:"connected"`
	BrokerURL        string    `json:"broker_url"`
	LastConnectedAt  time.Time `json:"last_connected_at"`
	LastDisconnectAt time.Time `json:"last_disconnect_at"`
	LastError        string    `json:"last_error,omitempty"`
	MessagesReceived uint64    `json:"messages_received"`
	MessagesDropped  uint64    `json:"messages_dropped"`
	QueueDepth       int       `json:"queue_depth"`
	QueueCapacity    int       `json:"queue_capacity"`
}

// queuedMessage is one decoded-later unit of work handed from the paho
// message callback to the worker pool.
type queuedMessage struct {
	topic   string
	payload []byte
}

// Client is an MQTT telemetry client with automatic reconnect (delegated to
// paho's built-in exponential backoff), a bounded buffering queue so broker
// message bursts never block the MQTT read loop, and a worker pool that
// decodes and ingests messages concurrently.
type Client struct {
	cfg      Config
	ingester IoTIngester
	logger   *log.Logger

	newMQTTClient func(*mqtt.ClientOptions) mqtt.Client // overridable in tests
	mqttClient    mqtt.Client

	queue chan queuedMessage

	mu               sync.RWMutex
	connected        bool
	lastConnectedAt  time.Time
	lastDisconnectAt time.Time
	lastError        string

	messagesReceived atomic.Uint64
	messagesDropped  atomic.Uint64

	stopOnce sync.Once
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// NewClient constructs a Client. Call Start to connect and begin consuming
// messages; call Stop to shut it down.
func NewClient(cfg Config, ingester IoTIngester, logger *log.Logger) *Client {
	cfg = cfg.withDefaults()
	if logger == nil {
		logger = log.New(os.Stdout, "[mqtt] ", log.LstdFlags)
	}
	return &Client{
		cfg:           cfg,
		ingester:      ingester,
		logger:        logger,
		newMQTTClient: mqtt.NewClient,
		queue:         make(chan queuedMessage, cfg.QueueSize),
		stopCh:        make(chan struct{}),
	}
}

// Start connects to the configured broker and begins consuming messages.
// It does not block waiting for the connection to succeed indefinitely:
// paho is configured to retry with exponential backoff in the background,
// so a broker that is temporarily unreachable at startup does not prevent
// the API server itself from starting.
func (c *Client) Start(_ context.Context) error {
	if strings.TrimSpace(c.cfg.BrokerURL) == "" {
		return fmt.Errorf("mqtt: BrokerURL is required")
	}

	tlsConfig, err := c.buildTLSConfig()
	if err != nil {
		return fmt.Errorf("mqtt: build tls config: %w", err)
	}

	opts := mqtt.NewClientOptions()
	opts.AddBroker(c.cfg.BrokerURL)
	opts.SetClientID(c.cfg.ClientID)
	if c.cfg.Username != "" {
		opts.SetUsername(c.cfg.Username)
	}
	if c.cfg.Password != "" {
		opts.SetPassword(c.cfg.Password)
	}
	if tlsConfig != nil {
		opts.SetTLSConfig(tlsConfig)
	}

	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(c.cfg.ReconnectMinBackoff)
	opts.SetMaxReconnectInterval(c.cfg.ReconnectMaxBackoff)
	opts.SetOnConnectHandler(c.onConnect)
	opts.SetConnectionLostHandler(c.onConnectionLost)
	opts.SetReconnectingHandler(c.onReconnecting)

	c.mqttClient = c.newMQTTClient(opts)

	for i := 0; i < c.cfg.Workers; i++ {
		c.wg.Add(1)
		go c.worker()
	}

	token := c.mqttClient.Connect()
	if ok := token.WaitTimeout(c.cfg.ConnectTimeout); !ok {
		c.logger.Printf("mqtt: initial connect to %s still pending after %s (will keep retrying in the background)", c.cfg.BrokerURL, c.cfg.ConnectTimeout)
	} else if err := token.Error(); err != nil {
		c.logger.Printf("mqtt: initial connect to %s failed (will keep retrying in the background): %v", c.cfg.BrokerURL, err)
	}

	return nil
}

// Stop disconnects from the broker and waits for in-flight worker
// processing to finish, up to ctx's deadline.
func (c *Client) Stop(ctx context.Context) {
	c.stopOnce.Do(func() {
		close(c.stopCh)
	})

	if c.mqttClient != nil && c.mqttClient.IsConnected() {
		c.mqttClient.Disconnect(250)
	}

	done := make(chan struct{})
	go func() {
		c.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-ctx.Done():
		c.logger.Printf("mqtt: stop timed out waiting for workers to drain")
	}
}

// Status returns a snapshot of the client's current connection health.
func (c *Client) Status() ConnectionStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return ConnectionStatus{
		Connected:        c.connected,
		BrokerURL:        c.cfg.BrokerURL,
		LastConnectedAt:  c.lastConnectedAt,
		LastDisconnectAt: c.lastDisconnectAt,
		LastError:        c.lastError,
		MessagesReceived: c.messagesReceived.Load(),
		MessagesDropped:  c.messagesDropped.Load(),
		QueueDepth:       len(c.queue),
		QueueCapacity:    cap(c.queue),
	}
}

func (c *Client) buildTLSConfig() (*tls.Config, error) {
	if c.cfg.TLSCACertFile == "" && c.cfg.TLSCertFile == "" && c.cfg.TLSKeyFile == "" && !c.cfg.TLSInsecureSkipVerify {
		return nil, nil
	}

	tlsConfig := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: c.cfg.TLSInsecureSkipVerify, //nolint:gosec // explicit opt-in, documented dev-only
	}

	if c.cfg.TLSCACertFile != "" {
		caCert, err := os.ReadFile(c.cfg.TLSCACertFile)
		if err != nil {
			return nil, fmt.Errorf("read CA cert file: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("CA cert file does not contain a valid PEM certificate")
		}
		tlsConfig.RootCAs = pool
	}

	// Mutual TLS: this backend authenticates itself to the broker with its
	// own client certificate, the same way the IoT devices publishing
	// sensor data do.
	if c.cfg.TLSCertFile != "" && c.cfg.TLSKeyFile != "" {
		cert, err := tls.LoadX509KeyPair(c.cfg.TLSCertFile, c.cfg.TLSKeyFile)
		if err != nil {
			return nil, fmt.Errorf("load client key pair: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	} else if c.cfg.TLSCertFile != "" || c.cfg.TLSKeyFile != "" {
		return nil, fmt.Errorf("MQTT_TLS_CERT_FILE and MQTT_TLS_KEY_FILE must both be set for mutual TLS")
	}

	return tlsConfig, nil
}

// onConnect is invoked by paho on every successful connect, including
// reconnects — subscriptions are (re-)established here since a broker does
// not remember a non-persistent client's subscriptions across reconnects.
func (c *Client) onConnect(client mqtt.Client) {
	c.mu.Lock()
	c.connected = true
	c.lastConnectedAt = time.Now()
	c.lastError = ""
	c.mu.Unlock()

	c.logger.Printf("mqtt: connected to %s (client_id=%s)", c.cfg.BrokerURL, c.cfg.ClientID)

	for _, sensorType := range subscribedSensorTypes {
		topic := topicForSensorType(sensorType)
		token := client.Subscribe(topic, c.cfg.QoS, c.onMessage)
		go func(topic string) {
			token.Wait()
			if err := token.Error(); err != nil {
				c.logger.Printf("mqtt: subscribe to %s failed: %v", topic, err)
				return
			}
			c.logger.Printf("mqtt: subscribed to %s (qos=%d)", topic, c.cfg.QoS)
		}(topic)
	}
}

func (c *Client) onConnectionLost(_ mqtt.Client, err error) {
	c.mu.Lock()
	c.connected = false
	c.lastDisconnectAt = time.Now()
	c.lastError = err.Error()
	c.mu.Unlock()

	c.logger.Printf("mqtt: connection to %s lost: %v", c.cfg.BrokerURL, err)
}

func (c *Client) onReconnecting(_ mqtt.Client, _ *mqtt.ClientOptions) {
	c.logger.Printf("mqtt: reconnecting to %s", c.cfg.BrokerURL)
}

// onMessage is paho's per-message callback. It must never block: it only
// tries to enqueue the message for a worker to process, copying the
// payload first since paho may reuse the underlying buffer once this
// callback returns. If the bounded queue is full (a burst of messages
// arriving faster than they can be decoded and persisted), the message is
// dropped and counted rather than blocking the broker's read loop.
func (c *Client) onMessage(_ mqtt.Client, msg mqtt.Message) {
	c.messagesReceived.Add(1)

	payload := make([]byte, len(msg.Payload()))
	copy(payload, msg.Payload())

	select {
	case c.queue <- queuedMessage{topic: msg.Topic(), payload: payload}:
	default:
		c.messagesDropped.Add(1)
		c.logger.Printf("mqtt: queue full (capacity=%d), dropping message on topic=%s", c.cfg.QueueSize, msg.Topic())
	}
}

func (c *Client) worker() {
	defer c.wg.Done()
	for {
		select {
		case m := <-c.queue:
			c.handleMessage(m)
		case <-c.stopCh:
			return
		}
	}
}

func (c *Client) handleMessage(m queuedMessage) {
	var payload SensorPayload
	if err := json.Unmarshal(m.payload, &payload); err != nil {
		c.logger.Printf("mqtt: decode error on topic=%s: %v", m.topic, err)
		return
	}

	if payload.SensorType == "" {
		payload.SensorType = sensorTypeFromTopic(m.topic)
	}
	if payload.CapturedAt.IsZero() {
		payload.CapturedAt = time.Now().UTC()
	}

	req := monitoring.IngestIoTRequest{
		ProjectID:      payload.ProjectID,
		SensorID:       payload.SensorID,
		SensorType:     payload.SensorType,
		Value:          payload.Value,
		Unit:           payload.Unit,
		Location:       payload.Location,
		Metadata:       payload.Metadata,
		CapturedAt:     payload.CapturedAt,
		DeviceID:       payload.DeviceID,
		BatteryLevel:   payload.BatteryLevel,
		SignalStrength: payload.SignalStrength,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := c.ingester.IngestIoT(ctx, req); err != nil {
		c.logger.Printf("mqtt: ingest error on topic=%s sensor_id=%s: %v", m.topic, payload.SensorID, err)
	}
}
