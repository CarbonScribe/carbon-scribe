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
	repo := &fakeCollaborationRepo{}
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
	repo := &fakeCollaborationRepo{}
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
	repo := &fakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/collaboration/projects/p1/members", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusUnauthorized, resp.Code)
}

func TestCollaborationHandler_CreateComment_Contract(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &fakeCollaborationRepo{}
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
	repo := &fakeCollaborationRepo{}
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
	repo := &fakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	validToken := bearerTokenForUser(t, tokenManager, "inviter-user")

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
