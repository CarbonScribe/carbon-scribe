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

// TestCollaborationE2E_ErrorHandling tests error handling across all endpoints
func TestCollaborationE2E_ErrorHandling(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	t.Run("malformed json returns 400", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer([]byte("{invalid json")))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("missing required fields returns 400", func(t *testing.T) {
		tests := []struct {
			name string
			path string
			body map[string]any
		}{
			{
				name: "create comment missing project_id",
				path: "/api/v1/collaboration/comments",
				body: map[string]any{"content": "test"},
			},
			{
				name: "create comment missing content",
				path: "/api/v1/collaboration/comments",
				body: map[string]any{"project_id": "p1"},
			},
			{
				name: "create task missing project_id",
				path: "/api/v1/collaboration/tasks",
				body: map[string]any{"title": "test"},
			},
			{
				name: "create task missing title",
				path: "/api/v1/collaboration/tasks",
				body: map[string]any{"project_id": "p1"},
			},
			{
				name: "invite user missing email",
				path: "/api/v1/collaboration/projects/p1/invite",
				body: map[string]any{"role": "Contributor"},
			},
			{
				name: "invite user missing role",
				path: "/api/v1/collaboration/projects/p1/invite",
				body: map[string]any{"email": "test@example.com"},
			},
			{
				name: "create resource missing project_id",
				path: "/api/v1/collaboration/resources",
				body: map[string]any{"type": "document", "name": "test"},
			},
			{
				name: "create resource missing type",
				path: "/api/v1/collaboration/resources",
				body: map[string]any{"project_id": "p1", "name": "test"},
			},
			{
				name: "create resource missing name",
				path: "/api/v1/collaboration/resources",
				body: map[string]any{"project_id": "p1", "type": "document"},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				payload, _ := json.Marshal(tt.body)

				req := httptest.NewRequest("POST", tt.path, bytes.NewBuffer(payload))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)

				resp := httptest.NewRecorder()
				router.ServeHTTP(resp, req)

				assert.Equal(t, http.StatusBadRequest, resp.Code)
			})
		}
	})

	t.Run("invalid email format returns 400", func(t *testing.T) {
		body := map[string]string{
			"email": "not-a-valid-email",
			"role":  "Contributor",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/projects/p1/invite", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("invalid field types return 400", func(t *testing.T) {
		tests := []struct {
			name string
			path string
			body map[string]any
		}{
			{
				name: "comment with numeric content",
				path: "/api/v1/collaboration/comments",
				body: map[string]any{"project_id": "p1", "content": 123},
			},
			{
				name: "task with numeric project_id",
				path: "/api/v1/collaboration/tasks",
				body: map[string]any{"project_id": 123, "title": "test"},
			},
			{
				name: "resource with boolean name",
				path: "/api/v1/collaboration/resources",
				body: map[string]any{"project_id": "p1", "type": "document", "name": true},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				payload, _ := json.Marshal(tt.body)

				req := httptest.NewRequest("POST", tt.path, bytes.NewBuffer(payload))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)

				resp := httptest.NewRecorder()
				router.ServeHTTP(resp, req)

				assert.Equal(t, http.StatusBadRequest, resp.Code)
			})
		}
	})
}

// TestCollaborationE2E_ConcurrentRequests tests concurrent request handling
func TestCollaborationE2E_ConcurrentRequests(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	t.Run("concurrent comment creation", func(t *testing.T) {
		const numRequests = 10
		results := make(chan error, numRequests)

		for i := 0; i < numRequests; i++ {
			go func(i int) {
				body := map[string]string{
					"project_id": "p1",
					"content":    fmt.Sprintf("Concurrent comment %d", i),
				}
				payload, _ := json.Marshal(body)

				req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)

				resp := httptest.NewRecorder()
				router.ServeHTTP(resp, req)

				if resp.Code != http.StatusCreated {
					results <- fmt.Errorf("expected 201, got %d", resp.Code)
					return
				}

				results <- nil
			}(i)
		}

		// Wait for all requests to complete
		for i := 0; i < numRequests; i++ {
			err := <-results
			assert.NoError(t, err)
		}

		// Verify all comments were created
		assert.Len(t, repo.Comments, numRequests)
	})

	t.Run("concurrent task creation", func(t *testing.T) {
		const numRequests = 5
		results := make(chan error, numRequests)

		for i := 0; i < numRequests; i++ {
			go func(i int) {
				body := map[string]string{
					"project_id": "p1",
					"title":      fmt.Sprintf("Concurrent task %d", i),
				}
				payload, _ := json.Marshal(body)

				req := httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)

				resp := httptest.NewRecorder()
				router.ServeHTTP(resp, req)

				if resp.Code != http.StatusCreated {
					results <- fmt.Errorf("expected 201, got %d", resp.Code)
					return
				}

				results <- nil
			}(i)
		}

		// Wait for all requests to complete
		for i := 0; i < numRequests; i++ {
			err := <-results
			assert.NoError(t, err)
		}

		// Verify all tasks were created
		assert.Len(t, repo.Tasks, numRequests)
	})
}

// TestCollaborationE2E_DataConsistency tests data consistency across operations
func TestCollaborationE2E_DataConsistency(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")
	projectID := "consistency-test"

	t.Run("create and retrieve same entity", func(t *testing.T) {
		// Create comment
		body := map[string]string{
			"project_id": projectID,
			"content":    "Consistency test comment",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var createdComment map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &createdComment))

		// Retrieve all comments for the project
		req = httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/comments", projectID), nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp = httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var comments []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &comments))

		// Find our comment in the list
		found := false
		for _, comment := range comments {
			if comment["id"] == createdComment["id"] {
				found = true
				assert.Equal(t, createdComment["content"], comment["content"])
				assert.Equal(t, createdComment["project_id"], comment["project_id"])
				assert.Equal(t, createdComment["user_id"], comment["user_id"])
				break
			}
		}
		assert.True(t, found, "Created comment should be in the project comments list")
	})

	t.Run("create task and update it", func(t *testing.T) {
		// Create task
		body := map[string]string{
			"project_id": projectID,
			"title":      "Original task title",
			"status":     "todo",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var createdTask map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &createdTask))
		taskID := createdTask["id"].(string)

		// Update the task
		updateBody := map[string]string{
			"title":  "Updated task title",
			"status": "in_progress",
		}
		payload, _ = json.Marshal(updateBody)

		req = httptest.NewRequest("PATCH", fmt.Sprintf("/api/v1/collaboration/tasks/%s", taskID), bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp = httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var updatedTask map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &updatedTask))

		// Verify updates were applied
		assert.Equal(t, "Updated task title", updatedTask["title"])
		assert.Equal(t, "in_progress", updatedTask["status"])
		assert.Equal(t, taskID, updatedTask["id"])
		assert.Equal(t, createdTask["project_id"], updatedTask["project_id"])
	})
}

// TestCollaborationE2E_EdgeCases tests edge cases and boundary conditions
func TestCollaborationE2E_EdgeCases(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	t.Run("very long content", func(t *testing.T) {
		// Create comment with very long content
		longContent := ""
		for i := 0; i < 1000; i++ {
			longContent += "This is a very long comment. "
		}

		body := map[string]string{
			"project_id": "p1",
			"content":    longContent,
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var comment map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &comment))
		assert.Equal(t, longContent, comment["content"])
	})

	t.Run("special characters in content", func(t *testing.T) {
		specialContent := "Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>? Unicode: 你好 🚀 ñáéíóú"

		body := map[string]string{
			"project_id": "p1",
			"content":    specialContent,
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var comment map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &comment))
		assert.Equal(t, specialContent, comment["content"])
	})

	t.Run("empty strings in optional fields", func(t *testing.T) {
		body := map[string]interface{}{
			"project_id":  "p1",
			"title":       "Task with empty description",
			"description": "",
			"priority":    "",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var task map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &task))
		assert.Equal(t, "Task with empty description", task["title"])
	})

	t.Run("maximum pagination limits", func(t *testing.T) {
		// Test with very large limit and offset values
		req := httptest.NewRequest("GET", "/api/v1/collaboration/projects/p1/activities?limit=10000&offset=50000", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var activities []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &activities))
		// Should handle gracefully without crashing
	})
}

// TestCollaborationE2E_CrossProjectIsolation tests that projects are properly isolated
func TestCollaborationE2E_CrossProjectIsolation(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	project1 := "project-isolation-1"
	project2 := "project-isolation-2"

	t.Run("comments are isolated by project", func(t *testing.T) {
		// Create comment in project 1
		body1 := map[string]string{
			"project_id": project1,
			"content":    "Comment for project 1",
		}
		payload1, _ := json.Marshal(body1)

		req1 := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload1))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", "Bearer "+token)

		resp1 := httptest.NewRecorder()
		router.ServeHTTP(resp1, req1)

		assert.Equal(t, http.StatusCreated, resp1.Code)

		// Create comment in project 2
		body2 := map[string]string{
			"project_id": project2,
			"content":    "Comment for project 2",
		}
		payload2, _ := json.Marshal(body2)

		req2 := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload2))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", "Bearer "+token)

		resp2 := httptest.NewRecorder()
		router.ServeHTTP(resp2, req2)

		assert.Equal(t, http.StatusCreated, resp2.Code)

		// List comments for project 1 - should only contain project 1 comments
		reqList1 := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/comments", project1), nil)
		reqList1.Header.Set("Authorization", "Bearer "+token)

		respList1 := httptest.NewRecorder()
		router.ServeHTTP(respList1, reqList1)

		assert.Equal(t, http.StatusOK, respList1.Code)

		var comments1 []map[string]any
		require.NoError(t, json.Unmarshal(respList1.Body.Bytes(), &comments1))

		// Should only contain project 1 comment
		for _, comment := range comments1 {
			assert.Equal(t, project1, comment["project_id"])
		}

		// List comments for project 2 - should only contain project 2 comments
		reqList2 := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/comments", project2), nil)
		reqList2.Header.Set("Authorization", "Bearer "+token)

		respList2 := httptest.NewRecorder()
		router.ServeHTTP(respList2, reqList2)

		assert.Equal(t, http.StatusOK, respList2.Code)

		var comments2 []map[string]any
		require.NoError(t, json.Unmarshal(respList2.Body.Bytes(), &comments2))

		// Should only contain project 2 comment
		for _, comment := range comments2 {
			assert.Equal(t, project2, comment["project_id"])
		}
	})

	t.Run("tasks are isolated by project", func(t *testing.T) {
		// Similar test for tasks
		body1 := map[string]string{
			"project_id": project1,
			"title":      "Task for project 1",
		}
		payload1, _ := json.Marshal(body1)

		req1 := httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(payload1))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", "Bearer "+token)

		resp1 := httptest.NewRecorder()
		router.ServeHTTP(resp1, req1)

		assert.Equal(t, http.StatusCreated, resp1.Code)

		// List tasks for project 1
		reqList1 := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/collaboration/projects/%s/tasks", project1), nil)
		reqList1.Header.Set("Authorization", "Bearer "+token)

		respList1 := httptest.NewRecorder()
		router.ServeHTTP(respList1, reqList1)

		assert.Equal(t, http.StatusOK, respList1.Code)

		var tasks1 []map[string]any
		require.NoError(t, json.Unmarshal(respList1.Body.Bytes(), &tasks1))

		// Should only contain project 1 tasks
		for _, task := range tasks1 {
			assert.Equal(t, project1, task["project_id"])
		}
	})
}
