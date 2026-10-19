package templates

import "time"

// NotificationTemplate is a managed, versioned notification template:
// reusable subject/body copy (with placeholder syntax — see Renderer in
// this same package) for a specific delivery channel, administered through
// TemplateManager rather than hand-edited in application code.
//
// This is a distinct type from notifications.NotificationTemplate (the
// root notifications package's own, simpler Create/List/Get-only template
// used at send time). The two can't share a type: the root package already
// imports this one for Renderer, so this package importing the root one
// back would be a cycle. This type is also where the genuinely missing
// capability issue #689 asks for — an actual Update path with version
// tracking, which the root type has a bare Version field for but nothing
// that ever increments it — actually lives. See manager.go's doc comment
// for the full reasoning.
type NotificationTemplate struct {
	ID string `json:"id" bson:"_id"`
	// Name is a human-readable label for this template, e.g.
	// "retirement_confirmation_v2" — not shown to the notification's
	// recipient.
	Name string `json:"name" bson:"name"`
	// Channel is one of ChannelEmail, ChannelSMS, or ChannelPush.
	Channel string `json:"channel" bson:"channel"`
	// Subject is rendered as plain text even for an email template (a mail
	// header is not HTML — see Renderer.RenderForChannel). Required for
	// ChannelEmail; SMS and push notifications have no subject line, so it's
	// optional for them.
	Subject string `json:"subject,omitempty" bson:"subject,omitempty"`
	// Body contains the template's placeholder syntax — either
	// "{{.VarName}}" or the legacy bare "{{var_name}}" form; see
	// normalizeLegacyPlaceholders in renderer.go. Rendered as HTML (with
	// contextual escaping) for ChannelEmail, plain text otherwise.
	Body string `json:"body" bson:"body"`
	// Version starts at 1 on creation and increments by exactly 1 on every
	// successful Update, so which copy of a template's body was live at any
	// given point in time can be reconstructed for audit/debugging — the
	// versioning concept issue #689 asks for.
	Version   int       `json:"version" bson:"version"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}
