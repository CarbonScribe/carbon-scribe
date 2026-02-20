//go:build integration

package health_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/health"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	gin.SetMode(gin.TestMode)
	router := gin.Default()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://user:password@localhost:5432/carbonscribe?sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	repo := health.NewRepository(db)
	service := health.NewService(repo)
	handler := health.NewHandler(service)
	handler.RegisterRoutes(router.Group("/api/v1"))

	// Clean up database tables for isolation
	db.Exec("TRUNCATE TABLE system_metrics, service_health_checks, health_check_results, system_alerts, system_status_snapshots, service_dependencies RESTART IDENTITY CASCADE")

	return router, db
}

func TestMetricsResource(t *testing.T) {
	router, _ := setupTestRouter(t)

	// POST /metrics
	reqBody := health.CreateSystemMetricRequest{
		MetricName: "cpu_usage_refactor",
		MetricType: "gauge",
		Value:      55.5,
	}
	body, _ := json.Marshal(reqBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/health/metrics", bytes.NewBuffer(body))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	// GET /metrics
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/health/metrics?metric_name=cpu_usage_refactor", nil)
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)
	var getResponse []health.SystemMetric
	json.Unmarshal(w2.Body.Bytes(), &getResponse)
	assert.NotEmpty(t, getResponse)
}

func TestStatusResource(t *testing.T) {
	router, _ := setupTestRouter(t)

	// GET /status
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health/status", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var statusResponse health.SystemStatusResponse
	json.Unmarshal(w.Body.Bytes(), &statusResponse)
	assert.Equal(t, "healthy", statusResponse.Status)
	assert.Equal(t, "carbon-scribe-project-portal", statusResponse.Service)
	assert.Equal(t, "1.0.0", statusResponse.Version)
	assert.NotZero(t, statusResponse.Timestamp)

	// GET /status/detailed
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/health/status/detailed", nil)
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)
	var detailedResponse health.DetailedStatusResponse
	json.Unmarshal(w2.Body.Bytes(), &detailedResponse)
	assert.Equal(t, "healthy", detailedResponse.Status)
	assert.Equal(t, "carbon-scribe-project-portal", detailedResponse.Service)
	assert.Equal(t, "1.0.0", detailedResponse.Version)
	assert.NotZero(t, detailedResponse.Timestamp)
	assert.NotEmpty(t, detailedResponse.Uptime)
	assert.Contains(t, detailedResponse.Components, "database")
	assert.Equal(t, "up", detailedResponse.Components["database"].Status)
}

func TestServicesResource(t *testing.T) {
	router, db := setupTestRouter(t)

	// Seed a test service health check
	testCheck := health.ServiceHealthCheck{
		ServiceName:            "test-external-api",
		CheckType:              "http",
		CheckConfig:            []byte(`{"url": "http://example.com"}`),
		IntervalSeconds:        30,
		TimeoutSeconds:         5,
		ConsecutiveFailures:    0,
		AlertThresholdFailures: 3,
		IsEnabled:              true,
	}
	db.Create(&testCheck)

	// Execute GET /services
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health/services", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var response health.ServiceHealthResponse
	json.Unmarshal(w.Body.Bytes(), &response)
	assert.NotEmpty(t, response.Services)

	found := false
	for _, s := range response.Services {
		if s.ServiceName == "test-external-api" {
			found = true
			assert.Equal(t, "healthy", s.Status)
			break
		}
	}
	assert.True(t, found, "test-external-api not found in services health response")
}

func TestChecksResource(t *testing.T) {
	router, _ := setupTestRouter(t)

	// POST /checks
	reqBody := health.CreateServiceHealthCheckRequest{
		ServiceName:            "new-service-check",
		CheckType:              "http",
		CheckConfig:            map[string]any{"url": "http://new-service.com"},
		IntervalSeconds:        45,
		TimeoutSeconds:         15,
		AlertThresholdFailures: 5,
		AlertSeverity:          "warning",
		IsEnabled:              true,
	}
	body, _ := json.Marshal(reqBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/health/checks", bytes.NewBuffer(body))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var createdCheck health.ServiceHealthCheck
	json.Unmarshal(w.Body.Bytes(), &createdCheck)
	assert.NotEmpty(t, createdCheck.ID)
	assert.Equal(t, "new-service-check", createdCheck.ServiceName)
	assert.Equal(t, "http", createdCheck.CheckType)
	assert.Equal(t, 45, createdCheck.IntervalSeconds)
	assert.Equal(t, 15, createdCheck.TimeoutSeconds)
	assert.Equal(t, 5, createdCheck.AlertThresholdFailures)
	assert.Equal(t, "warning", createdCheck.AlertSeverity)

	// Verify with GET /services
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/health/services", nil)
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)
	var response health.ServiceHealthResponse
	json.Unmarshal(w2.Body.Bytes(), &response)

	found := false
	for _, s := range response.Services {
		if s.ServiceName == "new-service-check" {
			found = true
			assert.Equal(t, "healthy", s.Status)
			assert.Equal(t, "http", s.CheckType)
			assert.Equal(t, 0, s.Failures)
			assert.Equal(t, 45, s.IntervalSeconds)
			assert.Equal(t, 15, s.TimeoutSeconds)
			assert.Equal(t, 5, s.AlertThresholdFailures)
			assert.Equal(t, "warning", s.AlertSeverity)
			break
		}
	}
	assert.True(t, found, "new-service-check not found in services health response after creation")
}

func TestAlertsResource(t *testing.T) {
	router, db := setupTestRouter(t)

	// Seed a test alert
	testAlert := health.SystemAlert{
		AlertID:       "test-alert-123",
		AlertName:     "Test Alert",
		AlertSeverity: "critical",
		AlertSource:   "manual",
		ServiceName:   "test-service",
		Description:   "This is a test alert",
		Condition:     []byte(`{"threshold": 90}`),
		Status:        "firing",
	}
	db.Create(&testAlert)

	// GET /alerts
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health/alerts", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var alerts []health.SystemAlert
	json.Unmarshal(w.Body.Bytes(), &alerts)
	assert.NotEmpty(t, alerts)
	assert.Equal(t, "test-alert-123", alerts[0].AlertID)

	// POST /alerts/:id/acknowledge
	ackReq := health.AcknowledgeAlertRequest{
		AcknowledgedBy: "00000000-0000-0000-0000-000000000001",
	}
	body, _ := json.Marshal(ackReq)
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/api/v1/health/alerts/"+alerts[0].ID+"/acknowledge", bytes.NewBuffer(body))
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)
	if w2.Code == http.StatusOK {
		var ackAlert health.SystemAlert
		json.Unmarshal(w2.Body.Bytes(), &ackAlert)
		assert.Equal(t, "acknowledged", ackAlert.Status)
		assert.NotNil(t, ackAlert.AcknowledgedBy)
		assert.Equal(t, "00000000-0000-0000-0000-000000000001", *ackAlert.AcknowledgedBy)
		assert.NotNil(t, ackAlert.AcknowledgedAt)
	}
}

func TestDailyReportResource(t *testing.T) {
	router, db := setupTestRouter(t)

	// Seed a test snapshot
	testSnapshot := health.SystemStatusSnapshot{
		SnapshotTime:      time.Now(),
		SnapshotType:      "daily",
		OverallStatus:     "healthy",
		ServicesTotal:     5,
		ServicesHealthy:   5,
		ServicesDegraded:  0,
		ServicesUnhealthy: 0,
		ServiceStatus:     datatypes.JSON([]byte(`{"api": "up"}`)),
		MetricSummaries:   datatypes.JSON([]byte(`{"p99": 100}`)),
	}
	db.Create(&testSnapshot)

	// GET /reports/daily
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health/reports/daily", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var report health.SystemStatusSnapshot
	json.Unmarshal(w.Body.Bytes(), &report)
	assert.Equal(t, "daily", report.SnapshotType)
	assert.Equal(t, "healthy", report.OverallStatus)
	assert.Equal(t, 5, report.ServicesTotal)
}

func TestDependenciesResource(t *testing.T) {
	router, db := setupTestRouter(t)

	// Seed a test dependency
	testDep := health.ServiceDependency{
		SourceService:  "carbon-scribe-api",
		TargetService:  "stellar-horizon",
		DependencyType: "hard",
		FailureImpact:  "high",
		IsMonitored:    true,
	}
	db.Create(&testDep)

	// GET /dependencies
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health/dependencies", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var deps []health.ServiceDependency
	json.Unmarshal(w.Body.Bytes(), &deps)
	assert.NotEmpty(t, deps)
	assert.Equal(t, "carbon-scribe-api", deps[0].SourceService)
	assert.Equal(t, "stellar-horizon", deps[0].TargetService)
}

func TestUptimeResource(t *testing.T) {
	router, db := setupTestRouter(t)

	// 1. Seed a test health check
	testCheck := health.ServiceHealthCheck{
		ServiceName: "uptime-test-service",
		CheckType:   "http",
		CheckConfig: datatypes.JSON([]byte(`{"url": "http://uptime-test.com"}`)),
		IsEnabled:   true,
	}
	db.Create(&testCheck)

	// 2. Seed results: 3 success, 1 failure = 75% uptime
	now := time.Now()
	results := []health.HealthCheckResult{
		{CheckID: testCheck.ID, CheckTime: now.Add(-1 * time.Hour), Success: true, DurationMs: 100},
		{CheckID: testCheck.ID, CheckTime: now.Add(-2 * time.Hour), Success: true, DurationMs: 100},
		{CheckID: testCheck.ID, CheckTime: now.Add(-3 * time.Hour), Success: true, DurationMs: 100},
		{CheckID: testCheck.ID, CheckTime: now.Add(-4 * time.Hour), Success: false, DurationMs: 100},
	}
	for _, r := range results {
		db.Create(&r)
	}

	// 3. GET /uptime
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health/uptime", nil)
	router.ServeHTTP(w, req)

	// 4. Validate
	assert.Equal(t, http.StatusOK, w.Code)
	var response health.UptimeResponse
	json.Unmarshal(w.Body.Bytes(), &response)
	assert.NotEmpty(t, response.Services)

	var found bool
	for _, s := range response.Services {
		if s.ServiceName == "uptime-test-service" {
			found = true
			assert.Equal(t, 75.0, s.Uptime24h)
			assert.Equal(t, 75.0, s.Uptime7d)
			assert.Equal(t, 75.0, s.Uptime30d)
		}
	}
	assert.True(t, found)
}
