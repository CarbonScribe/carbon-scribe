package iot

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	mqttpaho "github.com/eclipse/paho.mqtt.golang"
	mochimqtt "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/hooks/auth"
	"github.com/mochi-mqtt/server/v2/listeners"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// fakeIngester records every IngestIoT call for assertions, optionally
// returning a configured error.
type fakeIngester struct {
	mu   sync.Mutex
	reqs []monitoring.IngestIoTRequest
	err  error
}

func (f *fakeIngester) IngestIoT(_ context.Context, req monitoring.IngestIoTRequest) (*monitoring.IoTReading, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	f.reqs = append(f.reqs, req)
	return &monitoring.IoTReading{}, nil
}

func (f *fakeIngester) requests() []monitoring.IngestIoTRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]monitoring.IngestIoTRequest, len(f.reqs))
	copy(out, f.reqs)
	return out
}

// freeTCPAddr picks an available loopback address for a short-lived test
// broker to bind to.
func freeTCPAddr(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("find free port: %v", err)
	}
	addr := l.Addr().String()
	if err := l.Close(); err != nil {
		t.Fatalf("close probe listener: %v", err)
	}
	return addr
}

// testBroker wraps an embedded mochi-mqtt server with an idempotent Close,
// since mochi's own Close panics if called twice (e.g. once explicitly by a
// test simulating an outage, and once more via t.Cleanup).
type testBroker struct {
	*mochimqtt.Server
	closeOnce sync.Once
}

func (b *testBroker) Close() error {
	var err error
	b.closeOnce.Do(func() {
		err = b.Server.Close()
	})
	return err
}

// startTestBroker starts an embedded, allow-all MQTT broker on addr for the
// duration of the test.
func startTestBroker(t *testing.T, addr string) *testBroker {
	t.Helper()
	server := mochimqtt.New(nil)
	if err := server.AddHook(new(auth.AllowHook), nil); err != nil {
		t.Fatalf("add allow-all hook: %v", err)
	}
	tcp := listeners.NewTCP(listeners.Config{ID: "test", Address: addr})
	if err := server.AddListener(tcp); err != nil {
		t.Fatalf("add tcp listener: %v", err)
	}
	go func() {
		_ = server.Serve()
	}()
	wrapped := &testBroker{Server: server}
	t.Cleanup(func() {
		_ = wrapped.Close()
	})
	return wrapped
}

func waitFor(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	if !cond() {
		t.Fatalf("condition not met within %s", timeout)
	}
}

func newTestClient(t *testing.T, brokerAddr string, ingester IoTIngester) *Client {
	t.Helper()
	cfg := Config{
		BrokerURL:           "tcp://" + brokerAddr,
		ClientID:            fmt.Sprintf("test-client-%d", time.Now().UnixNano()),
		ConnectTimeout:      2 * time.Second,
		ReconnectMinBackoff: 50 * time.Millisecond,
		ReconnectMaxBackoff: 200 * time.Millisecond,
		QueueSize:           10,
		Workers:             2,
	}
	client := NewClient(cfg, ingester, nil)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		client.Stop(ctx)
	})
	return client
}

func publishRaw(t *testing.T, brokerAddr, topic string, payload []byte) {
	t.Helper()
	opts := mqttpaho.NewClientOptions().AddBroker("tcp://" + brokerAddr).SetClientID(fmt.Sprintf("publisher-%d", time.Now().UnixNano()))
	publisher := mqttpaho.NewClient(opts)
	token := publisher.Connect()
	if !token.WaitTimeout(2*time.Second) || token.Error() != nil {
		t.Fatalf("publisher connect failed: %v", token.Error())
	}
	defer publisher.Disconnect(100)

	pubToken := publisher.Publish(topic, 1, false, payload)
	if !pubToken.WaitTimeout(2*time.Second) || pubToken.Error() != nil {
		t.Fatalf("publish failed: %v", pubToken.Error())
	}
}

func TestNewClient_AppliesDefaults(t *testing.T) {
	client := NewClient(Config{BrokerURL: "tcp://localhost:1883"}, &fakeIngester{}, nil)

	if client.cfg.ClientID == "" {
		t.Error("expected a generated ClientID")
	}
	if client.cfg.QoS != 1 {
		t.Errorf("expected default QoS 1, got %d", client.cfg.QoS)
	}
	if client.cfg.QueueSize != 1000 {
		t.Errorf("expected default QueueSize 1000, got %d", client.cfg.QueueSize)
	}
	if client.cfg.Workers != 4 {
		t.Errorf("expected default Workers 4, got %d", client.cfg.Workers)
	}
}

func TestStart_RequiresBrokerURL(t *testing.T) {
	client := NewClient(Config{}, &fakeIngester{}, nil)
	err := client.Start(context.Background())
	if err == nil {
		t.Fatal("expected an error when BrokerURL is empty")
	}
}

func TestClient_ConnectsAndSubscribes(t *testing.T) {
	addr := freeTCPAddr(t)
	startTestBroker(t, addr)

	ingester := &fakeIngester{}
	client := newTestClient(t, addr, ingester)

	if err := client.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}

	waitFor(t, 3*time.Second, func() bool { return client.Status().Connected })

	if got := client.Status().BrokerURL; got != "tcp://"+addr {
		t.Errorf("unexpected broker url in status: %s", got)
	}
}

func TestClient_DecodesAndIngestsSensorPayload(t *testing.T) {
	addr := freeTCPAddr(t)
	startTestBroker(t, addr)

	ingester := &fakeIngester{}
	client := newTestClient(t, addr, ingester)
	if err := client.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitFor(t, 3*time.Second, func() bool { return client.Status().Connected })

	payload := SensorPayload{
		ProjectID:  "project-1",
		SensorID:   "sensor-42",
		Value:      37.5,
		Unit:       "%",
		CapturedAt: time.Now().UTC(),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	publishRaw(t, addr, "sensors/project-1/soil_moisture", body)

	waitFor(t, 3*time.Second, func() bool { return len(ingester.requests()) == 1 })

	req := ingester.requests()[0]
	if req.ProjectID != "project-1" || req.SensorID != "sensor-42" {
		t.Errorf("unexpected ingested request: %+v", req)
	}
	// sensor_type was omitted from the payload — must be inferred from the topic.
	if req.SensorType != string(SensorTypeSoilMoisture) {
		t.Errorf("expected sensor_type inferred as %q, got %q", SensorTypeSoilMoisture, req.SensorType)
	}

	if got := client.Status().MessagesReceived; got != 1 {
		t.Errorf("expected 1 message received, got %d", got)
	}
}

func TestClient_DecodesMethaneAndBiomassTopics(t *testing.T) {
	addr := freeTCPAddr(t)
	startTestBroker(t, addr)

	ingester := &fakeIngester{}
	client := newTestClient(t, addr, ingester)
	if err := client.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitFor(t, 3*time.Second, func() bool { return client.Status().Connected })

	cases := []struct {
		topic      string
		sensorType SensorType
	}{
		{"sensors/project-2/methane", SensorTypeMethane},
		{"sensors/project-2/biomass", SensorTypeBiomass},
	}

	for _, tc := range cases {
		body, _ := json.Marshal(SensorPayload{
			ProjectID:  "project-2",
			SensorID:   "sensor-" + string(tc.sensorType),
			Value:      1.23,
			CapturedAt: time.Now().UTC(),
		})
		publishRaw(t, addr, tc.topic, body)
	}

	waitFor(t, 3*time.Second, func() bool { return len(ingester.requests()) == 2 })

	seen := map[string]bool{}
	for _, req := range ingester.requests() {
		seen[req.SensorType] = true
	}
	if !seen[string(SensorTypeMethane)] || !seen[string(SensorTypeBiomass)] {
		t.Errorf("expected methane and biomass sensor types, got %+v", ingester.requests())
	}
}

func TestClient_MalformedPayloadDoesNotCrashOrIngest(t *testing.T) {
	addr := freeTCPAddr(t)
	startTestBroker(t, addr)

	ingester := &fakeIngester{}
	client := newTestClient(t, addr, ingester)
	if err := client.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitFor(t, 3*time.Second, func() bool { return client.Status().Connected })

	publishRaw(t, addr, "sensors/project-3/soil_moisture", []byte("not-json"))

	// Give the worker a moment to process, then confirm nothing was ingested
	// and a well-formed follow-up message still works (the bad message
	// didn't wedge a worker).
	time.Sleep(200 * time.Millisecond)
	if len(ingester.requests()) != 0 {
		t.Fatalf("expected no ingested requests from malformed payload, got %+v", ingester.requests())
	}

	body, _ := json.Marshal(SensorPayload{ProjectID: "project-3", SensorID: "sensor-1", Value: 1, CapturedAt: time.Now().UTC()})
	publishRaw(t, addr, "sensors/project-3/soil_moisture", body)
	waitFor(t, 3*time.Second, func() bool { return len(ingester.requests()) == 1 })
}

func TestClient_ReconnectsAndResubscribesAfterBrokerRestart(t *testing.T) {
	addr := freeTCPAddr(t)
	broker := startTestBroker(t, addr)

	ingester := &fakeIngester{}
	client := newTestClient(t, addr, ingester)
	if err := client.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitFor(t, 3*time.Second, func() bool { return client.Status().Connected })

	// Simulate a broker outage.
	if err := broker.Close(); err != nil {
		t.Fatalf("close broker: %v", err)
	}
	waitFor(t, 3*time.Second, func() bool { return !client.Status().Connected })

	// Bring the broker back up on the same address; paho's auto-reconnect
	// (configured in Start) should re-establish the connection and
	// onConnect must re-subscribe.
	startTestBroker(t, addr)
	waitFor(t, 5*time.Second, func() bool { return client.Status().Connected })

	body, _ := json.Marshal(SensorPayload{ProjectID: "project-4", SensorID: "sensor-1", Value: 1, CapturedAt: time.Now().UTC()})
	publishRaw(t, addr, "sensors/project-4/soil_moisture", body)
	waitFor(t, 3*time.Second, func() bool { return len(ingester.requests()) == 1 })
}

func TestClient_DropsMessagesWhenQueueIsFull(t *testing.T) {
	cfg := Config{BrokerURL: "tcp://unused:1883", QueueSize: 1}
	client := NewClient(cfg, &fakeIngester{}, nil)

	// No workers are running (Start was never called), so the queue fills
	// up immediately and subsequent messages must be dropped rather than
	// blocking the caller (paho's read loop, in production).
	msg := &fakeMQTTMessage{topic: "sensors/p/soil_moisture", payload: []byte("{}")}
	client.onMessage(nil, msg)
	client.onMessage(nil, msg)
	client.onMessage(nil, msg)

	status := client.Status()
	if status.MessagesReceived != 3 {
		t.Errorf("expected 3 messages received, got %d", status.MessagesReceived)
	}
	if status.MessagesDropped == 0 {
		t.Error("expected at least one dropped message once the queue filled up")
	}
	if status.QueueDepth > status.QueueCapacity {
		t.Errorf("queue depth %d exceeds capacity %d", status.QueueDepth, status.QueueCapacity)
	}
}

func TestBuildTLSConfig_MutualAuth(t *testing.T) {
	dir := t.TempDir()
	caCertFile, clientCertFile, clientKeyFile := generateTestTLSFiles(t, dir)

	client := &Client{cfg: Config{
		TLSCACertFile: caCertFile,
		TLSCertFile:   clientCertFile,
		TLSKeyFile:    clientKeyFile,
	}}

	tlsConfig, err := client.buildTLSConfig()
	if err != nil {
		t.Fatalf("buildTLSConfig: %v", err)
	}
	if tlsConfig == nil {
		t.Fatal("expected a non-nil tls.Config")
	}
	if len(tlsConfig.Certificates) != 1 {
		t.Errorf("expected 1 client certificate loaded, got %d", len(tlsConfig.Certificates))
	}
	if tlsConfig.RootCAs == nil {
		t.Error("expected RootCAs to be set from the CA cert file")
	}
	if tlsConfig.MinVersion != tls.VersionTLS12 {
		t.Errorf("expected MinVersion TLS 1.2, got %x", tlsConfig.MinVersion)
	}
}

func TestBuildTLSConfig_NoTLSConfigured(t *testing.T) {
	client := &Client{cfg: Config{}}
	tlsConfig, err := client.buildTLSConfig()
	if err != nil {
		t.Fatalf("buildTLSConfig: %v", err)
	}
	if tlsConfig != nil {
		t.Error("expected nil tls.Config when no TLS options are set")
	}
}

func TestBuildTLSConfig_RejectsCertWithoutKey(t *testing.T) {
	dir := t.TempDir()
	_, clientCertFile, _ := generateTestTLSFiles(t, dir)

	client := &Client{cfg: Config{TLSCertFile: clientCertFile}}
	if _, err := client.buildTLSConfig(); err == nil {
		t.Fatal("expected an error when TLSCertFile is set without TLSKeyFile")
	}
}

// fakeMQTTMessage is a minimal mqtt.Message implementation for testing
// onMessage directly without a real broker.
type fakeMQTTMessage struct {
	topic   string
	payload []byte
}

func (m *fakeMQTTMessage) Duplicate() bool   { return false }
func (m *fakeMQTTMessage) Qos() byte         { return 1 }
func (m *fakeMQTTMessage) Retained() bool    { return false }
func (m *fakeMQTTMessage) Topic() string     { return m.topic }
func (m *fakeMQTTMessage) MessageID() uint16 { return 0 }
func (m *fakeMQTTMessage) Payload() []byte   { return m.payload }
func (m *fakeMQTTMessage) Ack()              {}

// generateTestTLSFiles writes a self-signed CA/cert/key set to dir and
// returns their file paths, for exercising buildTLSConfig.
func generateTestTLSFiles(t *testing.T, dir string) (caCertFile, certFile, keyFile string) {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "test-client"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		IsCA:         true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})

	caCertFile = filepath.Join(dir, "ca.pem")
	certFile = filepath.Join(dir, "cert.pem")
	keyFile = filepath.Join(dir, "key.pem")

	if err := os.WriteFile(caCertFile, certPEM, 0o600); err != nil {
		t.Fatalf("write ca cert: %v", err)
	}
	if err := os.WriteFile(certFile, certPEM, 0o600); err != nil {
		t.Fatalf("write cert: %v", err)
	}
	if err := os.WriteFile(keyFile, keyPEM, 0o600); err != nil {
		t.Fatalf("write key: %v", err)
	}

	return caCertFile, certFile, keyFile
}
