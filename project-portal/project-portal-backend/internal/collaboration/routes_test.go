package collaboration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCollaborationRoutes_MountedReturnNon404(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	handler := NewHandler(NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	RegisterRoutes(v1, handler, tokenManager)

	tests := []struct {
		name   string
		method string
		path   string
		body   map[string]any
	}{
		{name: "list members", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/members"},
		{name: "remove member", method: http.MethodDelete, path: "/api/v1/collaboration/projects/p1/members/u1"},
		{name: "invite user", method: http.MethodPost, path: "/api/v1/collaboration/projects/p1/invite", body: map[string]any{"email": "invitee@example.com", "role": "Contributor"}},
		{name: "list invitations", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/invitations"},
		{name: "get activities", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/activities"},
		{name: "list comments", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/comments"},
		{name: "create comment", method: http.MethodPost, path: "/api/v1/collaboration/comments", body: map[string]any{"project_id": "p1", "content": "hi"}},
		{name: "list tasks", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/tasks"},
		{name: "create task", method: http.MethodPost, path: "/api/v1/collaboration/tasks", body: map[string]any{"project_id": "p1", "title": "Task"}},
		{name: "update task", method: http.MethodPatch, path: "/api/v1/collaboration/tasks/t1", body: map[string]any{"status": "done"}},
		{name: "list resources", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/resources"},
		{name: "create resource", method: http.MethodPost, path: "/api/v1/collaboration/resources", body: map[string]any{"project_id": "p1", "type": "document", "name": "Spec"}},
		{name: "resend invitation", method: http.MethodPost, path: "/api/v1/collaboration/invitations/inv1/resend"},
		{name: "cancel invitation", method: http.MethodPost, path: "/api/v1/collaboration/invitations/inv1/cancel"},
		{name: "accept invitation", method: http.MethodPost, path: "/api/v1/collaboration/invitations/inv1/accept"},
		{name: "decline invitation", method: http.MethodPost, path: "/api/v1/collaboration/invitations/inv1/decline"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var bodyBytes []byte
			if tt.body != nil {
				var err error
				bodyBytes, err = json.Marshal(tt.body)
				require.NoError(t, err)
			}

			req := httptest.NewRequest(tt.method, tt.path, bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)
			assert.NotEqual(t, http.StatusNotFound, resp.Code, "route unexpectedly returned 404")
		})
	}
}

func TestCollaborationRoutes_NotMountedReturn404(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Group("/api/v1")

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "list members", method: http.MethodGet, path: "/api/v1/collaboration/projects/p1/members"},
		{name: "invite user", method: http.MethodPost, path: "/api/v1/collaboration/projects/p1/invite"},
		{name: "create comment", method: http.MethodPost, path: "/api/v1/collaboration/comments"},
		{name: "create task", method: http.MethodPost, path: "/api/v1/collaboration/tasks"},
		{name: "create resource", method: http.MethodPost, path: "/api/v1/collaboration/resources"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)
			assert.Equal(t, http.StatusNotFound, resp.Code)
		})
	}
}

func TestCollaborationRoutes_PathPatternsMatchExpected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	handler := NewHandler(NewService(repo))

	router := gin.New()
	v1 := router.Group("/api/v1")
	RegisterRoutes(v1, handler, tokenManager)

	routes := router.Routes()
	collabPathByMethod := make(map[string]bool)
	for _, r := range routes {
		if strings.HasPrefix(r.Path, "/api/v1/collaboration") {
			collabPathByMethod[r.Method+" "+r.Path] = true
		}
	}

	expected := []string{
		http.MethodGet + " /api/v1/collaboration/projects/:id/members",
		http.MethodGet + " /api/v1/collaboration/projects/:id/members/:userId",
		http.MethodDelete + " /api/v1/collaboration/projects/:id/members/:userId",
		http.MethodPost + " /api/v1/collaboration/projects/:id/invite",
		http.MethodGet + " /api/v1/collaboration/projects/:id/invitations",
		http.MethodGet + " /api/v1/collaboration/projects/:id/activities",
		http.MethodGet + " /api/v1/collaboration/projects/:id/comments",
		http.MethodPost + " /api/v1/collaboration/comments",
		http.MethodGet + " /api/v1/collaboration/projects/:id/tasks",
		http.MethodPost + " /api/v1/collaboration/tasks",
		http.MethodPatch + " /api/v1/collaboration/tasks/:id",
		http.MethodGet + " /api/v1/collaboration/projects/:id/resources",
		http.MethodPost + " /api/v1/collaboration/resources",
		http.MethodPost + " /api/v1/collaboration/invitations/:invitationId/resend",
		http.MethodPost + " /api/v1/collaboration/invitations/:invitationId/cancel",
		http.MethodPost + " /api/v1/collaboration/invitations/:invitationId/accept",
		http.MethodPost + " /api/v1/collaboration/invitations/:invitationId/decline",
	}

	for _, route := range expected {
		assert.True(t, collabPathByMethod[route], "expected route not registered: %s", route)
	}
	assert.Equal(t, len(expected), len(collabPathByMethod), "unexpected collaboration route set registered")
}
