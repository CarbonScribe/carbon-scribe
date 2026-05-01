package notifications

import (
	"bytes"
	"context"
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

type fakeRepo struct {
	notifications []Notification
	templates     map[string]NotificationTemplate
	rules         map[string]NotificationRule
	preferences   map[string]UserPreference
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		notifications: make([]Notification, 0),
		templates:     make(map[string]NotificationTemplate),
		rules:         make(map[string]NotificationRule),
		preferences:   make(map[string]UserPreference),
	}
}

func (f *fakeRepo) CreateNotification(_ context.Context, n *Notification) error {
	f.notifications = append(f.notifications, *n)
	return nil
}
func (f *fakeRepo) ListNotificationsByUser(_ context.Context, userID string, _ int64) ([]Notification, error) {
	out := make([]Notification, 0)
	for _, n := range f.notifications {
		if n.UserID == userID {
			out = append(out, n)
		}
	}
	return out, nil
}
func (f *fakeRepo) GetNotificationByID(_ context.Context, id string) (*Notification, error) {
	for _, n := range f.notifications {
		if n.ID == id {
			cp := n
			return &cp, nil
		}
	}
	return nil, nil
}
func (f *fakeRepo) CreateDeliveryAttempt(_ context.Context, _ *DeliveryAttempt) error { return nil }
func (f *fakeRepo) ListDeliveryAttempts(_ context.Context, _ string) ([]DeliveryAttempt, error) {
	return []DeliveryAttempt{}, nil
}
func (f *fakeRepo) UpdateNotificationStatus(_ context.Context, id string, status string, deliveredAt *time.Time) error {
	for i := range f.notifications {
		if f.notifications[i].ID == id {
			f.notifications[i].Status = status
			f.notifications[i].DeliveredAt = deliveredAt
			f.notifications[i].UpdatedAt = time.Now().UTC()
		}
	}
	return nil
}
func (f *fakeRepo) PutPreference(_ context.Context, pref *UserPreference) error {
	f.preferences[pref.ID] = *pref
	return nil
}
func (f *fakeRepo) ListPreferencesByUser(_ context.Context, userID string) ([]UserPreference, error) {
	out := make([]UserPreference, 0)
	for _, p := range f.preferences {
		if p.UserID == userID {
			out = append(out, p)
		}
	}
	return out, nil
}
func (f *fakeRepo) CreateTemplate(_ context.Context, template *NotificationTemplate) error {
	f.templates[template.ID] = *template
	return nil
}
func (f *fakeRepo) ListTemplates(_ context.Context) ([]NotificationTemplate, error) {
	out := make([]NotificationTemplate, 0, len(f.templates))
	for _, t := range f.templates {
		out = append(out, t)
	}
	return out, nil
}
func (f *fakeRepo) GetTemplateByID(_ context.Context, id string) (*NotificationTemplate, error) {
	t, ok := f.templates[id]
	if !ok {
		return nil, nil
	}
	cp := t
	return &cp, nil
}
func (f *fakeRepo) CreateRule(_ context.Context, rule *NotificationRule) error {
	f.rules[rule.ID] = *rule
	return nil
}
func (f *fakeRepo) UpdateRule(_ context.Context, rule *NotificationRule) error {
	f.rules[rule.ID] = *rule
	return nil
}
func (f *fakeRepo) ListRules(_ context.Context, projectID string) ([]NotificationRule, error) {
	out := make([]NotificationRule, 0)
	for _, r := range f.rules {
		if projectID == "" || r.ProjectID == projectID {
			out = append(out, r)
		}
	}
	return out, nil
}
func (f *fakeRepo) GetRuleByID(_ context.Context, id string) (*NotificationRule, error) {
	r, ok := f.rules[id]
	if !ok {
		return nil, nil
	}
	cp := r
	return &cp, nil
}
func (f *fakeRepo) UpsertConnection(_ context.Context, _ *WebSocketConnection) error { return nil }
func (f *fakeRepo) DeleteConnection(_ context.Context, _ string) error               { return nil }
func (f *fakeRepo) ListConnections(_ context.Context, _ string, _ string) ([]WebSocketConnection, error) {
	return []WebSocketConnection{}, nil
}
func (f *fakeRepo) Metrics(_ context.Context) (*DeliveryMetrics, error) {
	return &DeliveryMetrics{
		TotalNotifications: int64(len(f.notifications)),
		ByStatus:           map[string]int64{},
		ByChannel:          map[string]int64{},
		Last24h:            int64(len(f.notifications)),
		GeneratedAt:        time.Now().UTC(),
	}, nil
}

func TestNotificationRoutes_MountedReturnNon404(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := newFakeRepo()
	h := NewHandler(NewService(repo))

	r := gin.New()
	v1 := r.Group("/api/v1")
	RegisterRoutes(v1, h, tm)

	user := &auth.User{ID: "user-1", Email: "u@example.com", Role: "admin"}
	token, err := tm.GenerateAccessToken(user, []string{
		"notifications:read",
		"notifications:send",
		"notifications:manage_rules",
		"notifications:write",
		"notifications:manage_templates",
		"notifications:analytics",
	})
	require.NoError(t, err)

	tests := []struct {
		name   string
		method string
		path   string
		body   map[string]any
	}{
		{name: "list notifications", method: http.MethodGet, path: "/api/v1/notifications"},
		{name: "send notification", method: http.MethodPost, path: "/api/v1/notifications/send", body: map[string]any{"user_id": "user-1", "category": "SYSTEM", "channels": []string{"IN_APP"}, "content": "hello"}},
		{name: "get preferences", method: http.MethodGet, path: "/api/v1/notifications/preferences"},
		{name: "update preferences", method: http.MethodPut, path: "/api/v1/notifications/preferences", body: map[string]any{"category": "SYSTEM", "enabled_channels": []string{"EMAIL"}}},
		{name: "list templates", method: http.MethodGet, path: "/api/v1/notifications/templates"},
		{name: "create template", method: http.MethodPost, path: "/api/v1/notifications/templates", body: map[string]any{"type": "SYSTEM", "body": "Hello {{user_name}}"}},
		{name: "list rules", method: http.MethodGet, path: "/api/v1/notifications/rules?project_id=p1"},
		{name: "create rule", method: http.MethodPost, path: "/api/v1/notifications/rules", body: map[string]any{"project_id": "p1", "name": "threshold", "conditions": []map[string]any{{"type": "threshold", "field": "value", "operator": "gt", "value": 10}}, "actions": []map[string]any{{"channel": "EMAIL"}}}},
		{name: "metrics", method: http.MethodGet, path: "/api/v1/notifications/metrics"},
		{name: "webhook sns", method: http.MethodPost, path: "/api/v1/notifications/webhooks/sns", body: map[string]any{"notification_id": "n1", "status": "DELIVERED"}},
		{name: "webhook ses", method: http.MethodPost, path: "/api/v1/notifications/webhooks/ses", body: map[string]any{"notification_id": "n1", "status": "DELIVERED"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if tt.body != nil {
				var marshalErr error
				body, marshalErr = json.Marshal(tt.body)
				require.NoError(t, marshalErr)
			}
			req := httptest.NewRequest(tt.method, tt.path, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			if !strings.Contains(tt.path, "/webhooks/") {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			res := httptest.NewRecorder()
			r.ServeHTTP(res, req)
			assert.NotEqual(t, http.StatusNotFound, res.Code)
		})
	}
}

func TestNotificationRoutes_PatternsRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := auth.NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	repo := newFakeRepo()
	h := NewHandler(NewService(repo))

	r := gin.New()
	v1 := r.Group("/api/v1")
	RegisterRoutes(v1, h, tm)

	routes := r.Routes()
	notifPathByMethod := make(map[string]bool)
	for _, route := range routes {
		if strings.Contains(route.Path, "/api/v1/notifications") {
			notifPathByMethod[route.Method+" "+route.Path] = true
		}
	}

	expected := []string{
		http.MethodGet + " /api/v1/notifications",
		http.MethodPost + " /api/v1/notifications/send",
		http.MethodPost + " /api/v1/notifications/rules",
		http.MethodPut + " /api/v1/notifications/rules/:id",
		http.MethodGet + " /api/v1/notifications/rules",
		http.MethodPost + " /api/v1/notifications/rules/:id/test",
		http.MethodGet + " /api/v1/notifications/preferences",
		http.MethodPut + " /api/v1/notifications/preferences",
		http.MethodGet + " /api/v1/notifications/templates",
		http.MethodPost + " /api/v1/notifications/templates",
		http.MethodGet + " /api/v1/notifications/templates/:id/preview",
		http.MethodGet + " /api/v1/notifications/:id/status",
		http.MethodGet + " /api/v1/notifications/metrics",
		http.MethodPost + " /api/v1/notifications/ws/broadcast",
		http.MethodPost + " /api/v1/notifications/ws/connect",
		http.MethodPost + " /api/v1/notifications/ws/disconnect/:connectionId",
		http.MethodPost + " /api/v1/notifications/webhooks/sns",
		http.MethodPost + " /api/v1/notifications/webhooks/ses",
	}

	for _, route := range expected {
		assert.True(t, notifPathByMethod[route], "expected route not registered: %s", route)
	}
}
