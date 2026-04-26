package collaboration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCollaborationHandler_ListMembers_ResponseContract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	// Add a member so the response is non-nil and non-empty
	repo.Members = append(repo.Members, EnrichedProjectMember{
		UserID:      "member-user-1",
		ProjectID:   "p1",
		Role:        "Contributor",
		DisplayName: "Test User",
		Email:       "test@example.com",
		AvatarURL:   "https://example.com/avatar.png",
		Phone:       "",
		Location:    "",
		Title:       "",
		Bio:         "",
		JoinedAt:    time.Now(),
	})
	router := newCollaborationTestRouter(repo, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "member-user-1")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/collaboration/projects/p1/members", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	var body []map[string]any
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
	assert.NotNil(t, body)
}

func TestCollaborationHandler_UnauthenticatedRequestsReturn401(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	tests := []struct {
		name   string
		method string
		path   string
		body   map[string]any
	}{
		{name: "list members", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/members"},
		{name: "create comment", method: http.MethodPost, path: "/api/v1/collaboration/comments", body: map[string]any{"project_id": "p1", "content": "hello"}},
		{name: "create task", method: http.MethodPost, path: "/api/v1/collaboration/tasks", body: map[string]any{"project_id": "p1", "title": "Task"}},
		{name: "invite user", method: http.MethodPost, path: "/api/v1/collaboration/projects/p1/invite", body: map[string]any{"email": "invitee@example.com", "role": "Contributor"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var payload []byte
			if tt.body != nil {
				var err error
				payload, err = json.Marshal(tt.body)
				require.NoError(t, err)
			}

			req := httptest.NewRequest(tt.method, tt.path, bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)
			assert.Equal(t, http.StatusUnauthorized, resp.Code)
		})
	}
}

func TestCollaborationHandler_InvalidTokenReturns401(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/collaboration/projects/p1/members", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusUnauthorized, resp.Code)
}

func TestCollaborationHandler_CreateComment_Contract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	validToken := bearerTokenForUser(t, tokenManager, "comment-user")

	tests := []struct {
		name       string
		payload    map[string]any
		authHeader string
		wantStatus int
	}{
		{
			name:       "valid comment creation",
			payload:    map[string]any{"project_id": "p1", "content": "Contract-test comment"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "missing content",
			payload:    map[string]any{"project_id": "p1", "content": ""},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing project_id",
			payload:    map[string]any{"content": "hello"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid field type",
			payload:    map[string]any{"project_id": 123, "content": "hello"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unauthenticated",
			payload:    map[string]any{"project_id": "p1", "content": "hello"},
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code, "body=%s", resp.Body.String())
			if tt.wantStatus == http.StatusCreated {
				var body map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				assert.Equal(t, "p1", body["project_id"])
				assert.Equal(t, "comment-user", body["user_id"])
				assert.Equal(t, "Contract-test comment", body["content"])
			}
		})
	}
}

func TestCollaborationHandler_CreateTask_Contract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	validToken := bearerTokenForUser(t, tokenManager, "task-user")

	tests := []struct {
		name       string
		payload    map[string]any
		authHeader string
		wantStatus int
	}{
		{
			name:       "valid task creation",
			payload:    map[string]any{"project_id": "p1", "title": "Prepare field visit", "description": "Coordinate crew"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "missing title",
			payload:    map[string]any{"project_id": "p1", "title": ""},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing project_id",
			payload:    map[string]any{"title": "Task"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid field type",
			payload:    map[string]any{"project_id": "p1", "title": "Task", "status": 100},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unauthenticated",
			payload:    map[string]any{"project_id": "p1", "title": "Task"},
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code, "body=%s", resp.Body.String())
			if tt.wantStatus == http.StatusCreated {
				var body map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				assert.Equal(t, "p1", body["project_id"])
				assert.Equal(t, "task-user", body["created_by"])
				assert.Equal(t, "Prepare field visit", body["title"])
			}
		})
	}
}

func TestCollaborationHandler_InviteUser_Contract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	validToken := bearerTokenForUser(t, tokenManager, "owner-user")

	tests := []struct {
		name       string
		payload    map[string]any
		authHeader string
		wantStatus int
	}{
		{
			name:       "valid invitation",
			payload:    map[string]any{"email": "invitee@example.com", "role": "Contributor"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "missing email",
			payload:    map[string]any{"role": "Contributor"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid email",
			payload:    map[string]any{"email": "bad-email", "role": "Contributor"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing role",
			payload:    map[string]any{"email": "invitee@example.com"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unauthenticated",
			payload:    map[string]any{"email": "invitee@example.com", "role": "Contributor"},
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/projects/p1/invite", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code, "body=%s", resp.Body.String())
			if tt.wantStatus == http.StatusCreated {
				var body map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				assert.Equal(t, "p1", body["project_id"])
				assert.Equal(t, "invitee@example.com", body["email"])
				assert.Equal(t, "pending", body["status"])
			}
		})
	}
}

func TestCollaborationHandler_ListMembers_Permissions(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	tests := []struct {
		name       string
		userToken  string
		wantStatus int
	}{
		{
			name:       "owner can list members",
			userToken:  bearerTokenForUser(t, tokenManager, "owner-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "manager can list members",
			userToken:  bearerTokenForUser(t, tokenManager, "manager-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "contributor can list members",
			userToken:  bearerTokenForUser(t, tokenManager, "contributor-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "viewer can list members",
			userToken:  bearerTokenForUser(t, tokenManager, "viewer-user"),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/collaboration/projects/p1/members", nil)
			req.Header.Set("Authorization", "Bearer "+tt.userToken)
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code)
		})
	}
}

func TestCollaborationHandler_RemoveMember_Permissions(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	tests := []struct {
		name       string
		userToken  string
		wantStatus int
	}{
		{
			name:       "owner can remove member",
			userToken:  bearerTokenForUser(t, tokenManager, "owner-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "manager can remove member",
			userToken:  bearerTokenForUser(t, tokenManager, "manager-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "contributor cannot remove member",
			userToken:  bearerTokenForUser(t, tokenManager, "contributor-user"),
			wantStatus: http.StatusInternalServerError, // Service returns error for unauthorized
		},
		{
			name:       "viewer cannot remove member",
			userToken:  bearerTokenForUser(t, tokenManager, "viewer-user"),
			wantStatus: http.StatusInternalServerError, // Service returns error for unauthorized
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/collaboration/projects/p1/members/user-123", nil)
			req.Header.Set("Authorization", "Bearer "+tt.userToken)
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code)
		})
	}
}

func TestCollaborationHandler_ListInvitations_Permissions(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	tests := []struct {
		name       string
		userToken  string
		wantStatus int
	}{
		{
			name:       "owner can list invitations",
			userToken:  bearerTokenForUser(t, tokenManager, "owner-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "manager can list invitations",
			userToken:  bearerTokenForUser(t, tokenManager, "manager-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "contributor can list invitations",
			userToken:  bearerTokenForUser(t, tokenManager, "contributor-user"),
			wantStatus: http.StatusOK,
		},
		{
			name:       "viewer can list invitations",
			userToken:  bearerTokenForUser(t, tokenManager, "viewer-user"),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/collaboration/projects/p1/invitations", nil)
			req.Header.Set("Authorization", "Bearer "+tt.userToken)
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code)
		})
	}
}

func TestCollaborationHandler_GetActivities_Pagination(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{
		Activities: []ActivityLog{
			{ID: "1", ProjectID: "p1", UserID: "user1", Type: "user", Action: "created_task", Metadata: map[string]any{"task_id": "task1"}, CreatedAt: time.Now()},
			{ID: "2", ProjectID: "p1", UserID: "user2", Type: "user", Action: "updated_comment", Metadata: map[string]any{"comment_id": "comment1"}, CreatedAt: time.Now()},
		},
	}
	router := newCollaborationTestRouter(repo, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "member-user-1")

	tests := []struct {
		name       string
		query      string
		wantStatus int
	}{
		{
			name:       "default pagination",
			query:      "",
			wantStatus: http.StatusOK,
		},
		{
			name:       "custom limit",
			query:      "limit=10",
			wantStatus: http.StatusOK,
		},
		{
			name:       "custom offset",
			query:      "offset=5",
			wantStatus: http.StatusOK,
		},
		{
			name:       "both limit and offset",
			query:      "limit=10&offset=20",
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid limit defaults to 20",
			query:      "limit=invalid",
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid offset defaults to 0",
			query:      "offset=invalid",
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := "/api/v1/collaboration/projects/p1/activities"
			if tt.query != "" {
				path += "?" + tt.query
			}

			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Authorization", "Bearer "+token)
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code)
			if tt.wantStatus == http.StatusOK {
				var body []map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				assert.NotNil(t, body)
			}
		})
	}
}

func TestCollaborationHandler_UpdateTask_Contract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{
		ExistingTask: &Task{
			ID:          "existing-task",
			ProjectID:   "p1",
			Title:       "Test Task",
			Description: "Test Description",
			Status:      "todo",
			Priority:    "medium",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	}
	router := newCollaborationTestRouter(repo, tokenManager)

	validToken := bearerTokenForUser(t, tokenManager, "task-user")

	tests := []struct {
		name       string
		taskID     string
		payload    map[string]any
		authHeader string
		wantStatus int
	}{
		{
			name:       "valid status update",
			taskID:     "existing-task",
			payload:    map[string]any{"status": "done"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusOK,
		},
		{
			name:       "valid assignment update",
			taskID:     "existing-task",
			payload:    map[string]any{"assigned_to": "user-123"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusOK,
		},
		{
			name:       "valid title update",
			taskID:     "existing-task",
			payload:    map[string]any{"title": "Updated Title"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusOK,
		},
		{
			name:       "multiple field update",
			taskID:     "existing-task",
			payload:    map[string]any{"status": "in_progress", "priority": "high", "title": "New Title"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusOK,
		},
		{
			name:       "task not found",
			taskID:     "non-existent-task",
			payload:    map[string]any{"status": "done"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "unauthenticated",
			taskID:     "existing-task",
			payload:    map[string]any{"status": "done"},
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPatch, "/api/v1/collaboration/tasks/"+tt.taskID, bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code, "body=%s", resp.Body.String())
		})
	}
}

func TestCollaborationHandler_CreateResource_Contract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	validToken := bearerTokenForUser(t, tokenManager, "resource-user")

	tests := []struct {
		name       string
		payload    map[string]any
		authHeader string
		wantStatus int
	}{
		{
			name:       "valid document resource",
			payload:    map[string]any{"project_id": "p1", "type": "document", "name": "Project Spec"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "valid link resource",
			payload:    map[string]any{"project_id": "p1", "type": "link", "name": "External Link", "url": "https://example.com"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "missing project_id",
			payload:    map[string]any{"type": "document", "name": "Spec"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing type",
			payload:    map[string]any{"project_id": "p1", "name": "Spec"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing name",
			payload:    map[string]any{"project_id": "p1", "type": "document"},
			authHeader: "Bearer " + validToken,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unauthenticated",
			payload:    map[string]any{"project_id": "p1", "type": "document", "name": "Spec"},
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/resources", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, tt.wantStatus, resp.Code, "body=%s", resp.Body.String())
			if tt.wantStatus == http.StatusCreated {
				var body map[string]any
				require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
				assert.Equal(t, "p1", body["project_id"])
				assert.Equal(t, "resource-user", body["uploaded_by"])
			}
		})
	}
}
