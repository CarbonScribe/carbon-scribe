package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ChannelPush is a managed-template channel this package doesn't otherwise
// define. ChannelEmail and ChannelSMS are already declared in renderer.go
// and are reused here so validation and rendering always agree on the same
// spelling.
const ChannelPush = "PUSH"

// validChannels is the set of Channel values Create/Update accept.
var validChannels = map[string]struct{}{
	ChannelEmail: {},
	ChannelSMS:   {},
	ChannelPush:  {},
}

// Validation errors returned by Create/Update. Each names the failing
// field so a caller (or test) can react to a specific failure rather than
// string-matching a generic message.
var (
	ErrNameRequired    = errors.New("templates: name is required")
	ErrInvalidChannel  = errors.New("templates: channel must be one of EMAIL, SMS, or PUSH")
	ErrBodyRequired    = errors.New("templates: body is required")
	ErrSubjectRequired = errors.New("templates: subject is required for an EMAIL template")
	// ErrMalformedTemplate wraps the underlying parse error when a
	// template's subject or body is not valid template syntax (see
	// renderer.go) — an unclosed "{{if}}", a reference to an undefined
	// function, and so on.
	ErrMalformedTemplate = errors.New("templates: malformed template body")
)

// TemplateManager provides CRUD over managed notification templates (issue
// #689), validating each template's required fields and placeholder syntax
// before it is persisted.
//
// This sits alongside — not on top of — the simpler template support
// already in the root notifications package (NotificationTemplate,
// Service.CreateTemplate/ListTemplates, backed by MongoRepository there).
// That existing type can't be reused here: the root package already
// imports this templates package for Renderer, so this package importing
// it back would be an import cycle, and defining a second, independent
// type was the only way to add what was actually missing — an Update path
// with real version tracking, full field validation, and admin-gated HTTP
// routes of its own. See models.go's doc comment on NotificationTemplate
// for how the two relate, and cmd/api/main.go for how this is mounted at a
// distinct route so the two surfaces are never confused with one another.
type TemplateManager struct {
	repo     Repository
	renderer *Renderer
	// now and newID are injectable so tests can pin timestamps and IDs.
	now   func() time.Time
	newID func() string
}

// NewTemplateManager constructs a TemplateManager backed by repo.
func NewTemplateManager(repo Repository) *TemplateManager {
	return &TemplateManager{
		repo: repo,
		// MissingVariableEmpty, not MissingVariableError: validation parses
		// a template against no real send-time data at all, so a reference
		// to a variable that will legitimately be supplied later must not
		// itself be treated as a validation failure — only a genuine syntax
		// error should be.
		renderer: NewRenderer(MissingVariableEmpty),
		now:      func() time.Time { return time.Now().UTC() },
		newID:    uuid.NewString,
	}
}

// validate checks tpl's required fields, normalizes Channel to uppercase,
// and attempts to parse (not execute against real data) its subject and
// body through the channel-appropriate renderer, so a malformed body is
// rejected at authoring time rather than failing the next time a
// notification tries to use it.
func (m *TemplateManager) validate(tpl *NotificationTemplate) error {
	if strings.TrimSpace(tpl.Name) == "" {
		return ErrNameRequired
	}

	channel := strings.ToUpper(strings.TrimSpace(tpl.Channel))
	if _, ok := validChannels[channel]; !ok {
		return ErrInvalidChannel
	}
	tpl.Channel = channel

	if strings.TrimSpace(tpl.Body) == "" {
		return ErrBodyRequired
	}
	if channel == ChannelEmail && strings.TrimSpace(tpl.Subject) == "" {
		return ErrSubjectRequired
	}

	if _, err := m.renderer.RenderForChannel(channel, tpl.Subject, tpl.Body, map[string]interface{}{}); err != nil {
		return fmt.Errorf("%w: %v", ErrMalformedTemplate, err)
	}
	return nil
}

// Create validates and persists a new template, assigning its ID, an
// initial Version of 1, and both timestamps. Any ID/Version/timestamps the
// caller supplied are overwritten — creating a template always starts a
// fresh version history.
func (m *TemplateManager) Create(ctx context.Context, tpl NotificationTemplate) (*NotificationTemplate, error) {
	if err := m.validate(&tpl); err != nil {
		return nil, err
	}

	tpl.ID = m.newID()
	tpl.Version = 1
	now := m.now()
	tpl.CreatedAt = now
	tpl.UpdatedAt = now

	if err := m.repo.Create(ctx, &tpl); err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}
	return &tpl, nil
}

// Update validates and persists changes to the template stored under id,
// incrementing Version by exactly 1 and refreshing UpdatedAt. ID and
// CreatedAt are always taken from the existing stored record, never from
// updates, so a caller cannot retroactively change either. Returns
// ErrTemplateNotFound if id does not exist.
func (m *TemplateManager) Update(ctx context.Context, id string, updates NotificationTemplate) (*NotificationTemplate, error) {
	existing, err := m.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	updates.ID = existing.ID
	updates.CreatedAt = existing.CreatedAt
	if err := m.validate(&updates); err != nil {
		return nil, err
	}

	updates.Version = existing.Version + 1
	updates.UpdatedAt = m.now()

	if err := m.repo.Update(ctx, &updates); err != nil {
		return nil, fmt.Errorf("update template: %w", err)
	}
	return &updates, nil
}

// Get returns a single template by ID, or ErrTemplateNotFound.
func (m *TemplateManager) Get(ctx context.Context, id string) (*NotificationTemplate, error) {
	return m.repo.Get(ctx, id)
}

// List returns every managed template.
func (m *TemplateManager) List(ctx context.Context) ([]NotificationTemplate, error) {
	return m.repo.List(ctx)
}
