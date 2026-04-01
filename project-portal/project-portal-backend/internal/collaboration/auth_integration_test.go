package collaboration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"

	"github.com/gin-gonic/gin"
)

func newCollaborationTestRouter(repo *FakeCollaborationRepo, tokenManager *auth.TokenManager) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/api/v1")
	handler := NewHandler(NewService(repo))
	RegisterRoutes(v1, handler, tokenManager)
	return r
}

func bearerTokenForUser(t *testing.T, tokenManager *auth.TokenManager, userID string) string {
	t.Helper()
	user := &auth.User{ID: userID, Email: "user@example.com", Role: "user"}
	token, err := tokenManager.GenerateAccessToken(user, []string{"collaboration:write"})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return token
}

func TestCollaborationWriteEndpointsRequireAuth(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	tests := []struct {
		name string
		path string
		body map[string]any
	}{
		{name: "create comment", path: "/api/v1/collaboration/comments", body: map[string]any{"project_id": "p1", "content": "hello"}},
		{name: "create task", path: "/api/v1/collaboration/tasks", body: map[string]any{"project_id": "p1", "title": "Do work"}},
		{name: "create resource", path: "/api/v1/collaboration/resources", body: map[string]any{"project_id": "p1", "type": "document", "name": "Spec"}},
		{name: "invite user", path: "/api/v1/collaboration/projects/p1/invite", body: map[string]any{"email": "invitee@example.com", "role": "Contributor"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := json.Marshal(tt.body)
			if err != nil {
				t.Fatalf("marshal payload: %v", err)
			}

			req := httptest.NewRequest(http.MethodPost, tt.path, bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d", resp.Code)
			}
		})
	}
}

func TestCreateCommentUsesJWTUserIDNotBodyUserID(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "jwt-user-123")
	body := map[string]any{
		"project_id": "p1",
		"user_id":    "spoofed-user",
		"content":    "token must win",
	}
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/comments", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", resp.Code, resp.Body.String())
	}
	if repo.CreatedComment == nil {
		t.Fatalf("expected comment to be created")
	}
	if repo.CreatedComment.UserID != "jwt-user-123" {
		t.Fatalf("expected user id from token, got %q", repo.CreatedComment.UserID)
	}
}

func TestInviteUserActivityUsesJWTActorID(t *testing.T) {
	tokenManager := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := &FakeCollaborationRepo{}
	router := newCollaborationTestRouter(repo, tokenManager)

	token := bearerTokenForUser(t, tokenManager, "inviter-1")
	body := map[string]any{
		"email": "invitee@example.com",
		"role":  "Contributor",
	}
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/collaboration/projects/p1/invite", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", resp.Code, resp.Body.String())
	}
	if len(repo.Activities) == 0 {
		t.Fatalf("expected invite activity log")
	}
	lastActivity := repo.Activities[len(repo.Activities)-1]
	if lastActivity.UserID != "inviter-1" {
		t.Fatalf("expected actor user id from token, got %q", lastActivity.UserID)
	}
}
