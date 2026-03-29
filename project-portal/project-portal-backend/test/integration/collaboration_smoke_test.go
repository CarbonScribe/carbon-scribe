//go:build integration

package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

type smokeCollaborationRepo struct{}

func (s *smokeCollaborationRepo) AddMember(ctx context.Context, member *collaboration.ProjectMember) error {
	return nil
}

func (s *smokeCollaborationRepo) GetMember(ctx context.Context, projectID, userID string) (*collaboration.ProjectMember, error) {
	return nil, errors.New("not implemented")
}

func (s *smokeCollaborationRepo) ListMembers(ctx context.Context, projectID string) ([]collaboration.ProjectMember, error) {
	return []collaboration.ProjectMember{}, nil
}

func (s *smokeCollaborationRepo) UpdateMember(ctx context.Context, member *collaboration.ProjectMember) error {
	return nil
}

func (s *smokeCollaborationRepo) RemoveMember(ctx context.Context, projectID, userID string) error {
	return nil
}

func (s *smokeCollaborationRepo) CreateInvitation(ctx context.Context, invite *collaboration.ProjectInvitation) error {
	return nil
}

func (s *smokeCollaborationRepo) GetInvitationByToken(ctx context.Context, token string) (*collaboration.ProjectInvitation, error) {
	return nil, errors.New("not implemented")
}

func (s *smokeCollaborationRepo) ListInvitations(ctx context.Context, projectID string) ([]collaboration.ProjectInvitation, error) {
	return []collaboration.ProjectInvitation{}, nil
}

func (s *smokeCollaborationRepo) CreateActivity(ctx context.Context, activity *collaboration.ActivityLog) error {
	return nil
}

func (s *smokeCollaborationRepo) ListActivities(ctx context.Context, projectID string, limit, offset int) ([]collaboration.ActivityLog, error) {
	return []collaboration.ActivityLog{}, nil
}

func (s *smokeCollaborationRepo) CreateComment(ctx context.Context, comment *collaboration.Comment) error {
	return nil
}

func (s *smokeCollaborationRepo) ListComments(ctx context.Context, projectID string) ([]collaboration.Comment, error) {
	return []collaboration.Comment{}, nil
}

func (s *smokeCollaborationRepo) CreateTask(ctx context.Context, task *collaboration.Task) error {
	return nil
}

func (s *smokeCollaborationRepo) GetTask(ctx context.Context, taskID string) (*collaboration.Task, error) {
	return nil, errors.New("not implemented")
}

func (s *smokeCollaborationRepo) ListTasks(ctx context.Context, projectID string) ([]collaboration.Task, error) {
	return []collaboration.Task{}, nil
}

func (s *smokeCollaborationRepo) UpdateTask(ctx context.Context, task *collaboration.Task) error {
	return nil
}

func (s *smokeCollaborationRepo) CreateResource(ctx context.Context, resource *collaboration.SharedResource) error {
	return nil
}

func (s *smokeCollaborationRepo) ListResources(ctx context.Context, projectID string) ([]collaboration.SharedResource, error) {
	return []collaboration.SharedResource{}, nil
}

func setupCollaborationSmokeRouter(t *testing.T) (*gin.Engine, *auth.TokenManager) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	tokenManager := auth.NewTokenManager("smoke-secret", 15*time.Minute, 24*time.Hour)
	repo := &smokeCollaborationRepo{}
	service := collaboration.NewService(repo)
	handler := collaboration.NewHandler(service)

	router := gin.New()
	v1 := router.Group("/api/v1")
	collaboration.RegisterRoutes(v1, handler, tokenManager)

	return router, tokenManager
}

func smokeBearerToken(t *testing.T, tokenManager *auth.TokenManager, userID string) string {
	t.Helper()
	token, err := tokenManager.GenerateAccessToken(&auth.User{ID: userID, Email: userID + "@example.com", Role: "user"}, []string{"collaboration:read", "collaboration:write"})
	require.NoError(t, err)
	return token
}

func TestCollaborationSmoke_RouteAvailabilityAndAuthContract(t *testing.T) {
	router, tokenManager := setupCollaborationSmokeRouter(t)
	validToken := smokeBearerToken(t, tokenManager, "smoke-user")

	tests := []struct {
		name         string
		method       string
		path         string
		body         map[string]any
		authHeader   string
		wantStatuses []int
	}{
		{
			name:         "members route requires auth and is mounted",
			method:       http.MethodGet,
			path:         "/api/v1/collaboration/projects/p1/members",
			authHeader:   "",
			wantStatuses: []int{http.StatusUnauthorized},
		},
		{
			name:         "members route accepts valid token",
			method:       http.MethodGet,
			path:         "/api/v1/collaboration/projects/p1/members",
			authHeader:   "Bearer " + validToken,
			wantStatuses: []int{http.StatusOK},
		},
		{
			name:         "create comment contract",
			method:       http.MethodPost,
			path:         "/api/v1/collaboration/comments",
			body:         map[string]any{"project_id": "p1", "content": "smoke comment"},
			authHeader:   "Bearer " + validToken,
			wantStatuses: []int{http.StatusCreated},
		},
		{
			name:         "create task contract",
			method:       http.MethodPost,
			path:         "/api/v1/collaboration/tasks",
			body:         map[string]any{"project_id": "p1", "title": "smoke task"},
			authHeader:   "Bearer " + validToken,
			wantStatuses: []int{http.StatusCreated},
		},
		{
			name:         "invite contract",
			method:       http.MethodPost,
			path:         "/api/v1/collaboration/projects/p1/invite",
			body:         map[string]any{"email": "invitee@example.com", "role": "Contributor"},
			authHeader:   "Bearer " + validToken,
			wantStatuses: []int{http.StatusCreated},
		},
		{
			name:         "invalid token is rejected",
			method:       http.MethodGet,
			path:         "/api/v1/collaboration/projects/p1/members",
			authHeader:   "Bearer invalid-token",
			wantStatuses: []int{http.StatusUnauthorized},
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

			assert.NotEqual(t, http.StatusNotFound, resp.Code, "route should be mounted")
			assert.Contains(t, tt.wantStatuses, resp.Code, "body=%s", resp.Body.String())
		})
	}
}
