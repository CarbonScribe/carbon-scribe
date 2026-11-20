package templates

import (
	"context"
	"errors"
	"testing"
	"time"
)

// fakeRepository is an in-memory Repository for unit tests, matching the
// package's own interface rather than hitting a real MongoDB.
type fakeRepository struct {
	byID map[string]NotificationTemplate
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{byID: map[string]NotificationTemplate{}}
}

func (f *fakeRepository) Create(_ context.Context, tpl *NotificationTemplate) error {
	f.byID[tpl.ID] = *tpl
	return nil
}

func (f *fakeRepository) Update(_ context.Context, tpl *NotificationTemplate) error {
	if _, ok := f.byID[tpl.ID]; !ok {
		return ErrTemplateNotFound
	}
	f.byID[tpl.ID] = *tpl
	return nil
}

func (f *fakeRepository) Get(_ context.Context, id string) (*NotificationTemplate, error) {
	tpl, ok := f.byID[id]
	if !ok {
		return nil, ErrTemplateNotFound
	}
	return &tpl, nil
}

func (f *fakeRepository) List(_ context.Context) ([]NotificationTemplate, error) {
	items := make([]NotificationTemplate, 0, len(f.byID))
	for _, tpl := range f.byID {
		items = append(items, tpl)
	}
	return items, nil
}

// newTestManager builds a TemplateManager with a pinned clock and a
// sequential ID generator, so tests can assert on exact values rather than
// real timestamps/UUIDs.
func newTestManager() (*TemplateManager, *fakeRepository) {
	repo := newFakeRepository()
	m := NewTemplateManager(repo)
	m.now = func() time.Time { return time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC) }
	n := 0
	m.newID = func() string {
		n++
		return "tpl-" + string(rune('0'+n))
	}
	return m, repo
}

func validTemplate() NotificationTemplate {
	return NotificationTemplate{
		Name:    "retirement_confirmation",
		Channel: "email",
		Subject: "Your {{.ProjectName}} retirement is confirmed",
		Body:    "<p>Thanks, {{.UserName}}!</p>",
	}
}

// --- Create ---

func TestCreateAssignsIDVersionAndTimestamps(t *testing.T) {
	m, _ := newTestManager()

	tpl, err := m.Create(context.Background(), validTemplate())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tpl.ID == "" {
		t.Error("expected an ID to be assigned")
	}
	if tpl.Version != 1 {
		t.Errorf("version = %d, want 1", tpl.Version)
	}
	if tpl.CreatedAt.IsZero() || tpl.UpdatedAt.IsZero() {
		t.Error("expected both timestamps to be set")
	}
	if tpl.Channel != "EMAIL" {
		t.Errorf("channel = %q, want normalized %q", tpl.Channel, "EMAIL")
	}
}

func TestCreatePersistsTheTemplate(t *testing.T) {
	m, repo := newTestManager()

	created, err := m.Create(context.Background(), validTemplate())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	stored, ok := repo.byID[created.ID]
	if !ok {
		t.Fatal("template was not persisted to the repository")
	}
	if stored.Name != created.Name {
		t.Errorf("stored name = %q, want %q", stored.Name, created.Name)
	}
}

func TestCreateIgnoresCallerSuppliedIDAndVersion(t *testing.T) {
	m, _ := newTestManager()

	req := validTemplate()
	req.ID = "attacker-chosen-id"
	req.Version = 999

	tpl, err := m.Create(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tpl.ID == "attacker-chosen-id" {
		t.Error("Create must assign its own ID, not trust the caller's")
	}
	if tpl.Version != 1 {
		t.Errorf("version = %d, want 1 regardless of caller input", tpl.Version)
	}
}

func TestCreateRejectsEmptyName(t *testing.T) {
	m, _ := newTestManager()

	req := validTemplate()
	req.Name = "  "
	_, err := m.Create(context.Background(), req)
	if !errors.Is(err, ErrNameRequired) {
		t.Fatalf("expected ErrNameRequired, got %v", err)
	}
}

func TestCreateRejectsInvalidChannel(t *testing.T) {
	m, _ := newTestManager()

	req := validTemplate()
	req.Channel = "CARRIER_PIGEON"
	_, err := m.Create(context.Background(), req)
	if !errors.Is(err, ErrInvalidChannel) {
		t.Fatalf("expected ErrInvalidChannel, got %v", err)
	}
}

func TestCreateAcceptsEveryValidChannelCaseInsensitively(t *testing.T) {
	for _, channel := range []string{"email", "EMAIL", "sms", "Sms", "push", "PUSH"} {
		t.Run(channel, func(t *testing.T) {
			m, _ := newTestManager()
			req := NotificationTemplate{
				Name:    "t",
				Channel: channel,
				Subject: "s",
				Body:    "hello {{.Name}}",
			}
			if channel == "sms" || channel == "Sms" || channel == "push" || channel == "PUSH" {
				req.Subject = "" // not required outside EMAIL
			}
			if _, err := m.Create(context.Background(), req); err != nil {
				t.Fatalf("unexpected error for channel %q: %v", channel, err)
			}
		})
	}
}

func TestCreateRejectsEmptyBody(t *testing.T) {
	m, _ := newTestManager()

	req := validTemplate()
	req.Body = ""
	_, err := m.Create(context.Background(), req)
	if !errors.Is(err, ErrBodyRequired) {
		t.Fatalf("expected ErrBodyRequired, got %v", err)
	}
}

func TestCreateRejectsMissingSubjectForEmail(t *testing.T) {
	m, _ := newTestManager()

	req := validTemplate()
	req.Subject = ""
	_, err := m.Create(context.Background(), req)
	if !errors.Is(err, ErrSubjectRequired) {
		t.Fatalf("expected ErrSubjectRequired, got %v", err)
	}
}

func TestCreateAllowsMissingSubjectForSMS(t *testing.T) {
	m, _ := newTestManager()

	req := NotificationTemplate{
		Name:    "sms_alert",
		Channel: "sms",
		Body:    "Hi {{.Name}}, your code is {{.Code}}",
	}
	if _, err := m.Create(context.Background(), req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// TestCreateRejectsMalformedTemplateBody is the acceptance-criteria test
// for rejecting malformed template bodies.
func TestCreateRejectsMalformedTemplateBody(t *testing.T) {
	cases := map[string]NotificationTemplate{
		"unclosed action in body": {
			Name: "t", Channel: "sms", Body: "Hello {{.Name",
		},
		"unclosed if in body": {
			Name: "t", Channel: "sms", Body: "{{if .Flag}}yes",
		},
		"unclosed html action in email body": {
			Name: "t", Channel: "email", Subject: "s", Body: "<p>{{.Name",
		},
		"malformed subject": {
			Name: "t", Channel: "sms", Subject: "{{.Name", Body: "fine",
		},
	}
	for name, tpl := range cases {
		t.Run(name, func(t *testing.T) {
			m, _ := newTestManager()
			_, err := m.Create(context.Background(), tpl)
			if !errors.Is(err, ErrMalformedTemplate) {
				t.Fatalf("expected ErrMalformedTemplate, got %v", err)
			}
		})
	}
}

// TestCreateDoesNotRejectAReferenceToAnUndeclaredVariable ensures
// validation parses the template rather than fully executing it against
// real send-time data: a variable the template references but that won't
// exist until send time must not fail at authoring time.
func TestCreateDoesNotRejectAReferenceToAnUndeclaredVariable(t *testing.T) {
	m, _ := newTestManager()

	req := NotificationTemplate{
		Name:    "t",
		Channel: "sms",
		Body:    "Hello {{.SomeVariableNoOneSuppliedYet}}",
	}
	if _, err := m.Create(context.Background(), req); err != nil {
		t.Fatalf("unexpected error for an undeclared-but-syntactically-valid variable: %v", err)
	}
}

// --- Update ---

func TestUpdateIncrementsVersionAndRefreshesUpdatedAt(t *testing.T) {
	m, _ := newTestManager()
	created, err := m.Create(context.Background(), validTemplate())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	m.now = func() time.Time { return time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC) }
	updated := validTemplate()
	updated.Body = "<p>Updated body, {{.UserName}}!</p>"

	result, err := m.Update(context.Background(), created.ID, updated)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Version != 2 {
		t.Errorf("version = %d, want 2", result.Version)
	}
	if !result.UpdatedAt.Equal(time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("updated_at = %v, want the refreshed clock value", result.UpdatedAt)
	}
	if !result.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("created_at changed on update: got %v, want %v", result.CreatedAt, created.CreatedAt)
	}
	if result.Body != updated.Body {
		t.Errorf("body = %q, want the updated body", result.Body)
	}
}

func TestUpdatePersistsEachVersionIncrementSequentially(t *testing.T) {
	m, _ := newTestManager()
	created, _ := m.Create(context.Background(), validTemplate())

	for i := range 3 {
		updated, err := m.Update(context.Background(), created.ID, validTemplate())
		if err != nil {
			t.Fatalf("update %d: unexpected error: %v", i, err)
		}
		if want := i + 2; updated.Version != want {
			t.Errorf("update %d: version = %d, want %d", i, updated.Version, want)
		}
	}
}

func TestUpdatePreservesIDAndCreatedAtRegardlessOfCallerInput(t *testing.T) {
	m, _ := newTestManager()
	created, _ := m.Create(context.Background(), validTemplate())

	tampered := validTemplate()
	tampered.ID = "some-other-id"
	tampered.CreatedAt = time.Date(1999, 1, 1, 0, 0, 0, 0, time.UTC)

	result, err := m.Update(context.Background(), created.ID, tampered)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID != created.ID {
		t.Errorf("ID changed on update: got %q, want %q", result.ID, created.ID)
	}
	if !result.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("CreatedAt changed on update: got %v, want %v", result.CreatedAt, created.CreatedAt)
	}
}

func TestUpdateUnknownIDReturnsNotFound(t *testing.T) {
	m, _ := newTestManager()

	_, err := m.Update(context.Background(), "does-not-exist", validTemplate())
	if !errors.Is(err, ErrTemplateNotFound) {
		t.Fatalf("expected ErrTemplateNotFound, got %v", err)
	}
}

func TestUpdateRejectsMalformedTemplateBody(t *testing.T) {
	m, _ := newTestManager()
	created, _ := m.Create(context.Background(), validTemplate())

	broken := validTemplate()
	broken.Body = "{{if .Flag}}unterminated"

	_, err := m.Update(context.Background(), created.ID, broken)
	if !errors.Is(err, ErrMalformedTemplate) {
		t.Fatalf("expected ErrMalformedTemplate, got %v", err)
	}

	// The bad update must not have been persisted — Get should still
	// return the original, valid version.
	stored, getErr := m.Get(context.Background(), created.ID)
	if getErr != nil {
		t.Fatalf("unexpected error fetching stored template: %v", getErr)
	}
	if stored.Version != 1 {
		t.Errorf("version = %d after a rejected update, want unchanged 1", stored.Version)
	}
}

func TestUpdateRejectsInvalidChannel(t *testing.T) {
	m, _ := newTestManager()
	created, _ := m.Create(context.Background(), validTemplate())

	broken := validTemplate()
	broken.Channel = "fax"

	_, err := m.Update(context.Background(), created.ID, broken)
	if !errors.Is(err, ErrInvalidChannel) {
		t.Fatalf("expected ErrInvalidChannel, got %v", err)
	}
}

// --- Get / List ---

func TestGetUnknownIDReturnsNotFound(t *testing.T) {
	m, _ := newTestManager()

	_, err := m.Get(context.Background(), "nope")
	if !errors.Is(err, ErrTemplateNotFound) {
		t.Fatalf("expected ErrTemplateNotFound, got %v", err)
	}
}

func TestListReturnsEveryCreatedTemplate(t *testing.T) {
	m, _ := newTestManager()

	first := validTemplate()
	first.Name = "first"
	second := validTemplate()
	second.Name = "second"

	if _, err := m.Create(context.Background(), first); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := m.Create(context.Background(), second); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	items, err := m.List(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("list length = %d, want 2", len(items))
	}
}

func TestListOnEmptyRepositoryReturnsEmptyNotNil(t *testing.T) {
	m, _ := newTestManager()

	items, err := m.List(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if items == nil {
		t.Error("expected an empty slice, got nil")
	}
	if len(items) != 0 {
		t.Errorf("length = %d, want 0", len(items))
	}
}
