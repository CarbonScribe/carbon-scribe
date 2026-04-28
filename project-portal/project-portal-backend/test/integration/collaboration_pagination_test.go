package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/collaboration"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCollaborationPagination_FilteringAndSorting tests pagination with filtering and sorting
func TestCollaborationPagination_FilteringAndSorting(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)

	// Create a repository with diverse activities for testing
	repo := &collaboration.FakeCollaborationRepo{
		Activities: make([]collaboration.ActivityLog, 0),
	}

	// Generate activities with different types and timestamps
	activityTypes := []string{"user", "system", "automated", "alert"}
	for i := 0; i < 50; i++ {
		activityType := activityTypes[i%len(activityTypes)]
		repo.Activities = append(repo.Activities, collaboration.ActivityLog{
			ID:        fmt.Sprintf("activity-%d", i),
			ProjectID: "p1",
			UserID:    fmt.Sprintf("user-%d", i%5), // 5 different users
			Type:      activityType,
			Action:    fmt.Sprintf("action-%d", i),
			CreatedAt: time.Now().Add(time.Duration(i) * time.Hour),
		})
	}

	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	tests := []struct {
		name           string
		queryParams    string
		expectedStatus int
		validateFunc   func(t *testing.T, body []map[string]any)
	}{
		{
			name:           "default ordering by created_at desc",
			queryParams:    "limit=10",
			expectedStatus: http.StatusOK,
			validateFunc: func(t *testing.T, body []map[string]any) {
				// Should be in descending order by created_at
				for i := 1; i < len(body); i++ {
					prevTime, err := time.Parse(time.RFC3339, body[i-1]["created_at"].(string))
					require.NoError(t, err)
					currTime, err := time.Parse(time.RFC3339, body[i]["created_at"].(string))
					require.NoError(t, err)
					assert.True(t, prevTime.After(currTime) || prevTime.Equal(currTime))
				}
			},
		},
		{
			name:           "pagination respects ordering",
			queryParams:    "limit=5&offset=10",
			expectedStatus: http.StatusOK,
			validateFunc: func(t *testing.T, body []map[string]any) {
				assert.Len(t, body, 5)
				// Items should still be in descending order
				for i := 1; i < len(body); i++ {
					prevTime, err := time.Parse(time.RFC3339, body[i-1]["created_at"].(string))
					require.NoError(t, err)
					currTime, err := time.Parse(time.RFC3339, body[i]["created_at"].(string))
					require.NoError(t, err)
					assert.True(t, prevTime.After(currTime) || prevTime.Equal(currTime))
				}
			},
		},
		{
			name:           "empty result beyond dataset",
			queryParams:    "limit=10&offset=100",
			expectedStatus: http.StatusOK,
			validateFunc: func(t *testing.T, body []map[string]any) {
				assert.Empty(t, body)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := "/api/v1/collaboration/projects/p1/activities?" + tt.queryParams

			req := httptest.NewRequest("GET", path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.expectedStatus, resp.Code)

			if tt.expectedStatus == http.StatusOK {
				var body []map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				if tt.validateFunc != nil {
					tt.validateFunc(t, body)
				}
			}
		})
	}
}

// TestCollaborationPagination_Performance tests pagination performance with large datasets
func TestCollaborationPagination_Performance(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)

	// Create a repository with a very large dataset
	repo := &collaboration.FakeCollaborationRepo{
		Activities: make([]collaboration.ActivityLog, 0),
	}

	// Generate 1000 activities
	for i := 0; i < 1000; i++ {
		repo.Activities = append(repo.Activities, collaboration.ActivityLog{
			ID:        fmt.Sprintf("activity-%d", i),
			ProjectID: "p1",
			Action:    fmt.Sprintf("action-%d", i),
			CreatedAt: time.Now().Add(time.Duration(i) * time.Minute),
		})
	}

	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	tests := []struct {
		name        string
		limit       int
		offset      int
		maxDuration time.Duration
	}{
		{
			name:        "small page size fast",
			limit:       10,
			offset:      0,
			maxDuration: 100 * time.Millisecond,
		},
		{
			name:        "medium page size fast",
			limit:       50,
			offset:      100,
			maxDuration: 100 * time.Millisecond,
		},
		{
			name:        "large page size fast",
			limit:       100,
			offset:      500,
			maxDuration: 100 * time.Millisecond,
		},
		{
			name:        "very large page size fast",
			limit:       200,
			offset:      0,
			maxDuration: 100 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := fmt.Sprintf("/api/v1/collaboration/projects/p1/activities?limit=%d&offset=%d", tt.limit, tt.offset)

			start := time.Now()

			req := httptest.NewRequest("GET", path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			duration := time.Since(start)

			assert.Equal(t, http.StatusOK, resp.Code)
			assert.Less(t, duration, tt.maxDuration,
				"Pagination request took %v, expected less than %v", duration, tt.maxDuration)

			var body []map[string]any
			require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
			assert.Len(t, body, tt.limit)
		})
	}
}

// TestCollaborationE2E_CompleteWorkflow tests a complete collaboration workflow
func TestCollaborationE2E_CompleteWorkflow(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	managerToken := bearerTokenForUser(t, tokenManager, "manager-user")
	contributorToken := bearerTokenForUser(t, tokenManager, "contributor-user")

	projectID := "project-workflow"

	t.Run("step 1: manager invites contributor", func(t *testing.T) {
		body := map[string]string{
			"email": "new-contributor@example.com",
			"role":  "Contributor",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/collaboration/projects/%s/invite", projectID), bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var invitation map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &invitation))
		assert.Equal(t, "new-contributor@example.com", invitation["email"])
		assert.Equal(t, "Contributor", invitation["role"])
		assert.Equal(t, "pending", invitation["status"])

		// Verify activity was logged
		assert.NotEmpty(t, repo.Activities)
		assert.Equal(t, "user_invited", repo.Activities[len(repo.Activities)-1].Action)
	})

	t.Run("step 2: contributor creates comment", func(t *testing.T) {
		body := map[string]string{
			"project_id": projectID,
			"content":    "Looking forward to working on this project!",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+contributorToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var comment map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &comment))
		assert.Equal(t, projectID, comment["project_id"])
		assert.Equal(t, "contributor-user", comment["user_id"])
		assert.Equal(t, "Looking forward to working on this project!", comment["content"])

		// Verify activity was logged
		assert.Equal(t, "comment_added", repo.Activities[len(repo.Activities)-1].Action)
	})

	t.Run("step 3: manager creates task", func(t *testing.T) {
		body := map[string]string{
			"project_id":  projectID,
			"title":       "Set up project infrastructure",
			"description": "Initialize repository and set up CI/CD",
			"priority":    "high",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var task map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &task))
		assert.Equal(t, projectID, task["project_id"])
		assert.Equal(t, "manager-user", task["created_by"])
		assert.Equal(t, "Set up project infrastructure", task["title"])

		// Verify activity was logged
		assert.Equal(t, "task_created", repo.Activities[len(repo.Activities)-1].Action)
	})

	t.Run("step 4: contributor updates task", func(t *testing.T) {
		body := map[string]string{
			"status": "in_progress",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/api/v1/collaboration/tasks/existing-task", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+contributorToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var updatedTask map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &updatedTask))
		assert.Equal(t, "in_progress", updatedTask["status"])
	})

	t.Run("step 5: manager adds resource", func(t *testing.T) {
		body := map[string]interface{}{
			"project_id": projectID,
			"type":       "document",
			"name":       "Project Requirements",
			"url":        "https://example.com/requirements.pdf",
			"metadata":   map[string]string{"version": "1.0"},
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/resources", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var resource map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &resource))
		assert.Equal(t, projectID, resource["project_id"])
		assert.Equal(t, "document", resource["type"])
		assert.Equal(t, "Project Requirements", resource["name"])
		assert.Equal(t, "manager-user", resource["uploaded_by"])

		// Verify activity was logged
		assert.Equal(t, "resource_added", repo.Activities[len(repo.Activities)-1].Action)
	})

	t.Run("step 6: check project activities", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/activities?limit=50", projectID), nil)
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var activities []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &activities))
		assert.NotEmpty(t, activities)

		// Verify all expected actions are present
		expectedActions := map[string]bool{
			"user_invited":   false,
			"comment_added":  false,
			"task_created":   false,
			"resource_added": false,
		}

		for _, activity := range activities {
			if action, ok := activity["action"].(string); ok {
				if _, exists := expectedActions[action]; exists {
					expectedActions[action] = true
				}
			}
		}

		for action, found := range expectedActions {
			assert.True(t, found, "Expected action %s to be logged", action)
		}
	})

	t.Run("step 7: list all project resources", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/resources", projectID), nil)
		req.Header.Set("Authorization", "Bearer "+contributorToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var resources []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &resources))
		assert.NotEmpty(t, resources)

		// Verify our resource is in the list
		found := false
		for _, resource := range resources {
			if resource["name"] == "Project Requirements" {
				found = true
				assert.Equal(t, "document", resource["type"])
				break
			}
		}
		assert.True(t, found, "Project Requirements resource should be in the list")
	})

	t.Run("step 8: list all project tasks", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/tasks", projectID), nil)
		req.Header.Set("Authorization", "Bearer "+contributorToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var tasks []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &tasks))
		assert.NotEmpty(t, tasks)

		// Verify our task is in the list
		found := false
		for _, task := range tasks {
			if task["title"] == "Set up project infrastructure" {
				found = true
				assert.Equal(t, "in_progress", task["status"])
				break
			}
		}
		assert.True(t, found, "Infrastructure task should be in the list")
	})

	t.Run("step 9: list all project comments", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/comments", projectID), nil)
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var comments []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &comments))
		assert.NotEmpty(t, comments)

		// Verify our comment is in the list
		found := false
		for _, comment := range comments {
			if comment["content"] == "Looking forward to working on this project!" {
				found = true
				assert.Equal(t, "contributor-user", comment["user_id"])
				break
			}
		}
		assert.True(t, found, "Welcome comment should be in the list")
	})
}
