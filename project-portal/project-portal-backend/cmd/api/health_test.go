package main

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/elastic"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type mockSQLDriver struct {
	shouldFailPing bool
	mu             sync.Mutex
}

func (d *mockSQLDriver) Open(name string) (driver.Conn, error) {
	return &mockSQLConn{driver: d}, nil
}

type mockSQLConn struct {
	driver *mockSQLDriver
}

func (c *mockSQLConn) Prepare(query string) (driver.Stmt, error) {
	return nil, errors.New("not implemented")
}

func (c *mockSQLConn) Close() error {
	return nil
}

func (c *mockSQLConn) Begin() (driver.Tx, error) {
	return nil, errors.New("not implemented")
}

func (c *mockSQLConn) Ping(ctx context.Context) error {
	c.driver.mu.Lock()
	defer c.driver.mu.Unlock()
	if c.driver.shouldFailPing {
		return errors.New("database ping error")
	}
	return nil
}

func (c *mockSQLConn) ResetSession(ctx context.Context) error {
	return nil
}

var (
	registerDriverOnce sync.Once
	testDriver         = &mockSQLDriver{}
)

func initMockDB(t *testing.T) *gorm.DB {
	registerDriverOnce.Do(func() {
		sql.Register("mock_sql_driver", testDriver)
	})

	testDriver.mu.Lock()
	testDriver.shouldFailPing = false
	testDriver.mu.Unlock()

	sqlDB, err := sql.Open("mock_sql_driver", "")
	require.NoError(t, err)

	gormDB, err := gorm.Open(postgres.New(postgres.Config{
		Conn: sqlDB,
	}), &gorm.Config{})
	require.NoError(t, err)

	return gormDB
}

type HealthResponse struct {
	Status       string            `json:"status"`
	Service      string            `json:"service"`
	Timestamp    string            `json:"timestamp"`
	Version      string            `json:"version"`
	Modules      []string          `json:"modules"`
	Dependencies map[string]string `json:"dependencies"`
}

func setupTestGin() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func TestHealthHandler_AllNilDependencies(t *testing.T) {
	router := setupTestGin()
	router.GET("/health", HealthHandler(nil, nil, nil))

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "unhealthy", resp.Status)
	assert.Equal(t, "carbon-scribe-project-portal", resp.Service)
	assert.Equal(t, "1.0.0", resp.Version)
	assert.NotEmpty(t, resp.Timestamp)
	assert.NotEmpty(t, resp.Modules)

	assert.Equal(t, "unhealthy", resp.Dependencies["postgres"])
	assert.Equal(t, "unhealthy", resp.Dependencies["elasticsearch"])
	assert.Equal(t, "unhealthy", resp.Dependencies["mongodb"])
}

func TestHealthHandler_HealthyPostgres_UnhealthyOthers(t *testing.T) {
	db := initMockDB(t)

	router := setupTestGin()
	router.GET("/health", HealthHandler(db, nil, nil))

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "unhealthy", resp.Status)
	assert.Equal(t, "healthy", resp.Dependencies["postgres"])
	assert.Equal(t, "unhealthy", resp.Dependencies["elasticsearch"])
	assert.Equal(t, "unhealthy", resp.Dependencies["mongodb"])
}

func TestHealthHandler_FailingPostgres(t *testing.T) {
	db := initMockDB(t)

	// Make ping fail
	testDriver.mu.Lock()
	testDriver.shouldFailPing = true
	testDriver.mu.Unlock()

	router := setupTestGin()
	router.GET("/health", HealthHandler(db, nil, nil))

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "unhealthy", resp.Status)
	assert.Equal(t, "unhealthy", resp.Dependencies["postgres"])
}

func TestHealthHandler_ElasticsearchMock(t *testing.T) {
	esServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"version":{"number":"8.19.1"}}`))
			return
		}
		if r.URL.Path == "/_cluster/health" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"cluster_name":"test-cluster","status":"green"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer esServer.Close()

	esClient, err := elastic.NewClient(elastic.Config{
		Addresses: []string{esServer.URL},
	})
	require.NoError(t, err)

	db := initMockDB(t)

	router := setupTestGin()
	router.GET("/health", HealthHandler(db, esClient, nil))

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)

	// MongoDB is nil, so overall is unhealthy (503), but ES and PG are healthy
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "healthy", resp.Dependencies["postgres"])
	assert.Equal(t, "healthy", resp.Dependencies["elasticsearch"])
	assert.Equal(t, "unhealthy", resp.Dependencies["mongodb"])
}

func TestHealthHandler_ElasticsearchFailing(t *testing.T) {
	esServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"version":{"number":"8.19.1"}}`))
			return
		}
		if r.URL.Path == "/_cluster/health" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"internal server error"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer esServer.Close()

	esClient, err := elastic.NewClient(elastic.Config{
		Addresses: []string{esServer.URL},
	})
	require.NoError(t, err)

	router := setupTestGin()
	router.GET("/health", HealthHandler(nil, esClient, nil))

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "unhealthy", resp.Dependencies["elasticsearch"])
}

func TestHealthHandler_MongoDBUnhealthy(t *testing.T) {
	// Point to unreachable MongoDB instance with 100ms server selection timeout
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://127.0.0.1:54329/?serverSelectionTimeoutMS=100"))
	require.NoError(t, err)

	router := setupTestGin()
	router.GET("/health", HealthHandler(nil, nil, mongoClient))

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "unhealthy", resp.Dependencies["mongodb"])
}

func TestHealthHandler_TimeoutBounded(t *testing.T) {
	// Mock slow Elasticsearch server that hangs
	esServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"version":{"number":"8.19.1"}}`))
			return
		}
		if r.URL.Path == "/_cluster/health" {
			select {
			case <-time.After(5 * time.Second):
			case <-r.Context().Done():
			}
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer esServer.Close()

	esClient, err := elastic.NewClient(elastic.Config{
		Addresses: []string{esServer.URL},
	})
	require.NoError(t, err)

	router := setupTestGin()
	router.GET("/health", HealthHandler(nil, esClient, nil))

	start := time.Now()
	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	require.NoError(t, err)

	router.ServeHTTP(w, req)
	elapsed := time.Since(start)

	// Must finish around probeTimeout (2s), definitely less than the 5s sleep
	assert.Less(t, elapsed, 4*time.Second)
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "unhealthy", resp.Dependencies["elasticsearch"])
}
