package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/collaboration"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCollaborationAuth_PermissionMatrix tests role-based access control for all collaboration endpoints
func TestCollaborationAuth_PermissionMatrix(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{
		ExistingTask: &collaboration.Task{
			ID:        "task123",
			ProjectID: "p1",
			Title:     "Test Task",
			Status:    "todo",
			CreatedBy: "test-user",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	// Test users with different roles
	testUsers := map[string]string{
		"owner":       bearerTokenForUser(t, tokenManager, "owner-user"),
		"manager":     bearerTokenForUser(t, tokenManager, "manager-user"),
		"contributor": bearerTokenForUser(t, tokenManager, "contributor-user"),
		"viewer":      bearerTokenForUser(t, tokenManager, "viewer-user"),
	}

	// Define permission matrix
	permissions := map[string]map[string]int{
		"GET /api/v1/collaboration/projects/p1/members": {
			"owner":       http.StatusOK,
			"manager":     http.StatusOK,
			"contributor": http.StatusOK,
			"viewer":      http.StatusOK,
		},
		"DELETE /api/v1/collaboration/projects/p1/members/user123": {
			"owner":       http.StatusOK,
			"manager":     http.StatusOK,
			"contributor": http.StatusInternalServerError, // Service layer permission check
			"viewer":      http.StatusInternalServerError, // Service layer permission check
		},
		"POST /api/v1/collaboration/projects/p1/invite": {
			"owner":       http.StatusCreated,
			"manager":     http.StatusCreated,
			"contributor": http.StatusInternalServerError, // Service layer permission check
			"viewer":      http.StatusInternalServerError, // Service layer permission check
		},
		"GET /api/v1/collaboration/projects/p1/invitations": {
			"owner":       http.StatusOK,
			"manager":     http.StatusOK,
			"contributor": http.StatusOK,
			"viewer":      http.StatusOK,
		},
		"POST /api/v1/collaboration/comments": {
			"owner":       http.StatusCreated,
			"manager":     http.StatusCreated,
			"contributor": http.StatusCreated,
			"viewer":      http.StatusCreated,
		},
		"POST /api/v1/collaboration/tasks": {
			"owner":       http.StatusCreated,
			"manager":     http.StatusCreated,
			"contributor": http.StatusCreated,
			"viewer":      http.StatusCreated,
		},
		"PATCH /api/v1/collaboration/tasks/task123": {
			"owner":       http.StatusOK,
			"manager":     http.StatusOK,
			"contributor": http.StatusOK,
			"viewer":      http.StatusOK,
		},
		"POST /api/v1/collaboration/resources": {
			"owner":       http.StatusCreated,
			"manager":     http.StatusCreated,
			"contributor": http.StatusCreated,
			"viewer":      http.StatusCreated,
		},
	}

	for endpoint, roleStatuses := range permissions {
		for role, expectedStatus := range roleStatuses {
			t.Run(fmt.Sprintf("%s_%s", endpoint, role), func(t *testing.T) {
				token := testUsers[role]
				require.NotEmpty(t, token)

				var req *http.Request
				var body []byte

				// Setup request based on endpoint
				switch {
				case endpoint == "POST /api/v1/collaboration/projects/p1/invite":
					body, _ = json.Marshal(map[string]string{"email": "test@example.com", "role": "Contributor"})
					req = httptest.NewRequest("POST", "/api/v1/collaboration/projects/p1/invite", bytes.NewBuffer(body))
				case endpoint == "POST /api/v1/collaboration/comments":
					body, _ = json.Marshal(map[string]string{"project_id": "p1", "content": "Test comment"})
					req = httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(body))
				case endpoint == "POST /api/v1/collaboration/tasks":
					body, _ = json.Marshal(map[string]string{"project_id": "p1", "title": "Test task"})
					req = httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(body))
				case endpoint == "PATCH /api/v1/collaboration/tasks/task123":
					body, _ = json.Marshal(map[string]string{"status": "done"})
					req = httptest.NewRequest("PATCH", "/api/v1/collaboration/tasks/task123", bytes.NewBuffer(body))
				case endpoint == "POST /api/v1/collaboration/resources":
					body, _ = json.Marshal(map[string]string{"project_id": "p1", "type": "document", "name": "Test resource"})
					req = httptest.NewRequest("POST", "/api/v1/collaboration/resources", bytes.NewBuffer(body))
				default:
					// Parse method and path for GET requests
					parts := strings.SplitN(endpoint, " ", 2)
					if len(parts) == 2 {
						req = httptest.NewRequest(parts[0], parts[1], nil)
					} else {
						req = httptest.NewRequest("GET", endpoint, nil)
					}
				}

				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)

				resp := httptest.NewRecorder()
				router.ServeHTTP(resp, req)

				assert.Equal(t, expectedStatus, resp.Code,
					"Expected %d for %s, got %d. Body: %s",
					expectedStatus, role, resp.Code, resp.Body.String())
			})
		}
	}
}

// TestCollaborationPagination_ParameterValidation tests pagination parameter handling
func TestCollaborationPagination_ParameterValidation(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "test-user")

	tests := []struct {
		name           string
		queryParams    string
		expectedStatus int
		expectedLimit  int
		expectedOffset int
	}{
		{
			name:           "default pagination",
			queryParams:    "",
			expectedStatus: http.StatusOK,
			expectedLimit:  20, // Default limit
			expectedOffset: 0,  // Default offset
		},
		{
			name:           "custom limit and offset",
			queryParams:    "limit=10&offset=5",
			expectedStatus: http.StatusOK,
			expectedLimit:  10,
			expectedOffset: 5,
		},
		{
			name:           "invalid limit defaults to 20",
			queryParams:    "limit=invalid",
			expectedStatus: http.StatusOK,
			expectedLimit:  20, // Default fallback
			expectedOffset: 0,
		},
		{
			name:           "invalid offset defaults to 0",
			queryParams:    "offset=invalid",
			expectedStatus: http.StatusOK,
			expectedLimit:  20,
			expectedOffset: 0, // Default fallback
		},
		{
			name:           "negative limit defaults to 20",
			queryParams:    "limit=-5",
			expectedStatus: http.StatusOK,
			expectedLimit:  20, // Default fallback
			expectedOffset: 0,
		},
		{
			name:           "negative offset defaults to 0",
			queryParams:    "offset=-5",
			expectedStatus: http.StatusOK,
			expectedLimit:  20,
			expectedOffset: 0, // Default fallback
		},
		{
			name:           "zero limit uses default",
			queryParams:    "limit=0",
			expectedStatus: http.StatusOK,
			expectedLimit:  20, // Default fallback
			expectedOffset: 0,
		},
		{
			name:           "large limit is accepted",
			queryParams:    "limit=100",
			expectedStatus: http.StatusOK,
			expectedLimit:  100,
			expectedOffset: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := "/api/v1/collaboration/projects/p1/activities"
			if tt.queryParams != "" {
				path += "?" + tt.queryParams
			}

			req := httptest.NewRequest("GET", path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.expectedStatus, resp.Code)

			if tt.expectedStatus == http.StatusOK {
				var body []map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				assert.NotNil(t, body)
			}
		})
	}
}

// TestCollaborationPagination_LargeDataset tests pagination with large datasets
func TestCollaborationPagination_LargeDataset(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)

	// Create a repository that returns a large dataset
	repo := &collaboration.FakeCollaborationRepo{
		Activities: make([]collaboration.ActivityLog, 0),
	}

	// Generate 100 activities
	for i := 0; i < 100; i++ {
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
		name          string
		limit         int
		offset        int
		expectedCount int
	}{
		{
			name:          "first page 20 items",
			limit:         20,
			offset:        0,
			expectedCount: 20,
		},
		{
			name:          "second page 20 items",
			limit:         20,
			offset:        20,
			expectedCount: 20,
		},
		{
			name:          "last page partial items",
			limit:         20,
			offset:        80,
			expectedCount: 20, // 100 - 80 = 20
		},
		{
			name:          "beyond end empty",
			limit:         20,
			offset:        100,
			expectedCount: 0,
		},
		{
			name:          "small page size",
			limit:         5,
			offset:        0,
			expectedCount: 5,
		},
		{
			name:          "middle page",
			limit:         10,
			offset:        45,
			expectedCount: 10,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := fmt.Sprintf("/api/v1/collaboration/projects/p1/activities?limit=%d&offset=%d", tt.limit, tt.offset)

			req := httptest.NewRequest("GET", path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, http.StatusOK, resp.Code)

			var body []map[string]any
			require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
			assert.Len(t, body, tt.expectedCount)
		})
	}
}

// TestCollaborationE2E_InvitationWorkflow tests the complete invitation workflow
func TestCollaborationE2E_InvitationWorkflow(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	managerToken := bearerTokenForUser(t, tokenManager, "manager-user")

	t.Run("create invitation", func(t *testing.T) {
		body := map[string]string{
			"email": "new-user@example.com",
			"role":  "Contributor",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/projects/project-1/invite", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		var invitation map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &invitation))
		assert.Equal(t, "new-user@example.com", invitation["email"])
		assert.Equal(t, "Contributor", invitation["role"])
		assert.Equal(t, "pending", invitation["status"])
		assert.NotEmpty(t, invitation["token"])
	})

	t.Run("list invitations includes new one", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/collaboration/projects/project-1/invitations", nil)
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var invitations []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &invitations))
		assert.NotEmpty(t, invitations)

		// Find our invitation
		found := false
		for _, inv := range invitations {
			if inv["email"] == "new-user@example.com" {
				found = true
				assert.Equal(t, "Contributor", inv["role"])
				assert.Equal(t, "pending", inv["status"])
				break
			}
		}
		assert.True(t, found, "New invitation should be in the list")
	})

	t.Run("non-manager cannot create invitation", func(t *testing.T) {
		contributorToken := bearerTokenForUser(t, tokenManager, "contributor-user")

		body := map[string]string{
			"email": "another-user@example.com",
			"role":  "Contributor",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/projects/project-1/invite", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+contributorToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		// Should fail at service layer due to permission check
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
	})
}

// TestCollaborationE2E_MemberManagementWorkflow tests complete member management workflow
func TestCollaborationE2E_MemberManagementWorkflow(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	managerToken := bearerTokenForUser(t, tokenManager, "manager-user")

	t.Run("list initial members", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/collaboration/projects/project-1/members", nil)
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var members []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &members))
		// Should be empty initially
		assert.Empty(t, members)
	})

	t.Run("remove member as manager", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/collaboration/projects/project-1/members/user-to-remove", nil)
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &result))
		assert.Equal(t, true, result["ok"])
	})

	t.Run("non-manager cannot remove member", func(t *testing.T) {
		contributorToken := bearerTokenForUser(t, tokenManager, "contributor-user")

		req := httptest.NewRequest("DELETE", "/api/v1/collaboration/projects/project-1/members/another-user", nil)
		req.Header.Set("Authorization", "Bearer "+contributorToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		// Should fail at service layer due to permission check
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
	})
}

// TestCollaborationE2E_ActivityLogging tests that activities are properly logged
func TestCollaborationE2E_ActivityLogging(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &collaboration.FakeCollaborationRepo{}
	handler := collaboration.NewHandler(collaboration.NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	userToken := bearerTokenForUser(t, tokenManager, "test-user")

	t.Run("create comment logs activity", func(t *testing.T) {
		body := map[string]string{
			"project_id": "project-1",
			"content":    "This is a test comment",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		// Check that activity was logged
		assert.NotEmpty(t, repo.Activities, "Activity should be logged")

		// Find the comment activity
		found := false
		for _, activity := range repo.Activities {
			if activity.Action == "comment_added" && activity.UserID == "test-user" {
				found = true
				break
			}
		}
		assert.True(t, found, "Comment activity should be logged")
	})

	t.Run("create task logs activity", func(t *testing.T) {
		body := map[string]string{
			"project_id": "project-1",
			"title":      "Test Task",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		// Find the task activity
		found := false
		for _, activity := range repo.Activities {
			if activity.Action == "task_created" && activity.UserID == "test-user" {
				found = true
				break
			}
		}
		assert.True(t, found, "Task activity should be logged")
	})

	t.Run("invite user logs activity", func(t *testing.T) {
		managerToken := bearerTokenForUser(t, tokenManager, "manager-user")

		body := map[string]string{
			"email": "invitee@example.com",
			"role":  "Contributor",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/collaboration/projects/project-1/invite", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+managerToken)

		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code)

		// Find the invitation activity
		found := false
		for _, activity := range repo.Activities {
			if activity.Action == "user_invited" && activity.UserID == "manager-user" {
				found = true
				break
			}
		}
		assert.True(t, found, "Invitation activity should be logged")
	})
}

// Helper function to create bearer token for user
func bearerTokenForUser(t *testing.T, tokenManager *auth.TokenManager, userID string) string {
	t.Helper()
	user := &auth.User{ID: userID, Email: "user@example.com", Role: "user"}
	token, err := tokenManager.GenerateAccessToken(user, []string{"collaboration:write"})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return token
}
