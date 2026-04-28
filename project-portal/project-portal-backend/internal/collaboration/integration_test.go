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

func TestCollaborationIntegration_EndToEndFlow(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "owner-user-1")

	t.Run("invite user", func(t *testing.T) {
		body := map[string]any{"email": "new-user@example.com", "role": "Contributor"}
		payload, err := json.Marshal(body)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/projects/project-1/invite", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		resp := httptest.NewRecorder()

		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code, "body=%s", resp.Body.String())
		require.NotNil(t, repo.CreatedInvitation)
		assert.Equal(t, "project-1", repo.CreatedInvitation.ProjectID)
		assert.Equal(t, "new-user@example.com", repo.CreatedInvitation.Email)

		// Simulate the invited user as a member for the list_members test
		repo.Members = append(repo.Members, EnrichedProjectMember{
			UserID:      "new-user-id",
			ProjectID:   "project-1",
			Role:        "Contributor",
			DisplayName: "New User",
			Email:       "new-user@example.com",
			AvatarURL:   "https://example.com/avatar.png",
			Phone:       "",
			Location:    "",
			Title:       "",
			Bio:         "",
			JoinedAt:    time.Now(),
		})
	})

	t.Run("create comment", func(t *testing.T) {
		body := map[string]any{"project_id": "project-1", "content": "Can we update this section?"}
		payload, err := json.Marshal(body)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		resp := httptest.NewRecorder()

		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code, "body=%s", resp.Body.String())
		require.NotNil(t, repo.CreatedComment)
		assert.Equal(t, "project-1", repo.CreatedComment.ProjectID)
		assert.Equal(t, "owner-user-1", repo.CreatedComment.UserID)
		assert.Equal(t, "Can we update this section?", repo.CreatedComment.Content)
	})

	t.Run("create task", func(t *testing.T) {
		body := map[string]any{"project_id": "project-1", "title": "Validate project geofence", "description": "Run boundary checks"}
		payload, err := json.Marshal(body)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/tasks", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		resp := httptest.NewRecorder()

		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusCreated, resp.Code, "body=%s", resp.Body.String())
		require.NotNil(t, repo.CreatedTask)
		assert.Equal(t, "project-1", repo.CreatedTask.ProjectID)
		assert.Equal(t, "owner-user-1", repo.CreatedTask.CreatedBy)
		assert.Equal(t, "Validate project geofence", repo.CreatedTask.Title)
	})

	t.Run("list members", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/collaboration/projects/project-1/members", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp := httptest.NewRecorder()

		router.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		var body []map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
		assert.NotNil(t, body)
	})

	assert.GreaterOrEqual(t, len(repo.Activities), 3, "expected activities from invite/comment/task operations")
}

func TestCollaborationIntegration_AuthErrorMatrix(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	tests := []struct {
		name       string
		method     string
		path       string
		body       map[string]any
		authHeader string
		wantStatus int
	}{
		{
			name:       "missing token",
			method:     http.MethodPost,
			path:       "/api/v1/collaboration/comments",
			body:       map[string]any{"project_id": "project-1", "content": "message"},
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "malformed bearer token",
			method:     http.MethodPost,
			path:       "/api/v1/collaboration/comments",
			body:       map[string]any{"project_id": "project-1", "content": "message"},
			authHeader: "Bearer not-a-valid-token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "wrong auth header format",
			method:     http.MethodGet,
			path:       "/api/v1/collaboration/projects/project-1/members",
			authHeader: "Token abc",
			wantStatus: http.StatusUnauthorized,
		},
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
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)
			assert.Equal(t, tt.wantStatus, resp.Code, "body=%s", resp.Body.String())
		})
	}
}
