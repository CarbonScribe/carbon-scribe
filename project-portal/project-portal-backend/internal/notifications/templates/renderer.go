// Package templates renders stored notification templates into the final
// message bodies delivered to users.
//
// Rendering is channel-aware. Email templates are rendered through
// html/template so interpolated user data is contextually escaped and cannot
// break out of the surrounding markup; SMS, push and in-app templates are
// rendered through text/template, where HTML escaping would corrupt a plain
// text message.
package templates

import (
	"bytes"
	"fmt"
	htmltemplate "html/template"
	"regexp"
	"strings"
	texttemplate "text/template"
	"text/template/parse"
)

// Channel names understood by RenderForChannel. They mirror the channel
// constants in the notifications package, duplicated here so this package
// stays free of an import cycle with its own caller.
const (
	ChannelEmail     = "EMAIL"
	ChannelSMS       = "SMS"
	ChannelWebSocket = "WS"
	ChannelInApp     = "IN_APP"
)

// MissingVariablePolicy decides what happens when a template references a
// variable the caller did not supply.
type MissingVariablePolicy int

const (
	// MissingVariableError fails the render with an error naming the template.
	// This is the default: a notification silently sent with a hole in it is
	// worse than one that fails loudly and can be retried.
	MissingVariableError MissingVariablePolicy = iota
	// MissingVariableEmpty substitutes an empty string for absent variables
	// and renders successfully. Use for templates where optional fields are
	// expected to be absent.
	MissingVariableEmpty
)

// String implements fmt.Stringer for clearer test output and logs.
func (p MissingVariablePolicy) String() string {
	switch p {
	case MissingVariableEmpty:
		return "empty"
	default:
		return "error"
	}
}

// Renderer interpolates template strings against caller-supplied data.
// The zero value is usable and applies MissingVariableError.
type Renderer struct {
	policy MissingVariablePolicy
}

// NewRenderer constructs a Renderer with the given missing-variable policy.
func NewRenderer(policy MissingVariablePolicy) *Renderer {
	return &Renderer{policy: policy}
}

// Policy reports the renderer's missing-variable policy.
func (r *Renderer) Policy() MissingVariablePolicy { return r.policy }

// Rendered holds the interpolated parts of a notification.
type Rendered struct {
	Subject string
	Body    string
}

// RenderForChannel renders subject and body for a delivery channel. The email
// channel is rendered as HTML with contextual escaping; every other channel is
// rendered as plain text.
//
// The subject is always rendered as plain text, even for email: a subject
// header is not HTML and escaping it would leak entities like &amp; into the
// user's inbox.
func (r *Renderer) RenderForChannel(channel, subject, body string, data map[string]interface{}) (Rendered, error) {
	renderedSubject, err := r.Render(subject, data)
	if err != nil {
		return Rendered{}, fmt.Errorf("render subject: %w", err)
	}

	var renderedBody string
	if strings.EqualFold(strings.TrimSpace(channel), ChannelEmail) {
		renderedBody, err = r.RenderHTML(body, data)
	} else {
		renderedBody, err = r.Render(body, data)
	}
	if err != nil {
		return Rendered{}, fmt.Errorf("render body: %w", err)
	}

	return Rendered{Subject: renderedSubject, Body: renderedBody}, nil
}

// Render interpolates a plain-text template. Interpolated values are inserted
// verbatim, so this must not be used to build HTML — see RenderHTML.
func (r *Renderer) Render(tmpl string, data map[string]interface{}) (string, error) {
	if tmpl == "" {
		return "", nil
	}

	parsed, err := texttemplate.New("notification").
		Option(r.missingKeyOption()).
		Parse(normalizeLegacyPlaceholders(tmpl))
	if err != nil {
		return "", fmt.Errorf("parse template: %w", err)
	}

	data = r.withMissingDefaults(parsed.Tree, data)

	var buf bytes.Buffer
	if err := parsed.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute template: %w", err)
	}
	return buf.String(), nil
}

// RenderHTML interpolates an HTML template, contextually escaping every
// interpolated value so untrusted data cannot inject markup or script.
func (r *Renderer) RenderHTML(tmpl string, data map[string]interface{}) (string, error) {
	if tmpl == "" {
		return "", nil
	}

	parsed, err := htmltemplate.New("notification").
		Option(r.missingKeyOption()).
		Parse(normalizeLegacyPlaceholders(tmpl))
	if err != nil {
		return "", fmt.Errorf("parse html template: %w", err)
	}

	data = r.withMissingDefaults(parsed.Tree, data)

	var buf bytes.Buffer
	if err := parsed.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute html template: %w", err)
	}
	return buf.String(), nil
}

// legacyPlaceholder matches a template action containing nothing but a bare
// identifier, e.g. "{{user_name}}" or "{{ user_name }}".
var legacyPlaceholder = regexp.MustCompile(`{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}`)

// templateKeywords are bare words that are legal on their own inside an action
// and must never be rewritten into field references.
var templateKeywords = map[string]struct{}{
	"if": {}, "else": {}, "end": {}, "range": {}, "with": {},
	"template": {}, "block": {}, "define": {}, "break": {}, "continue": {},
	"nil": {}, "true": {}, "false": {},
}

// normalizeLegacyPlaceholders rewrites the notification module's established
// "{{user_name}}" placeholder syntax into the "{{.user_name}}" field syntax
// Go's template engine requires.
//
// Stored templates predate this renderer and were written against a regex
// substituter that accepted bare identifiers; text/template reads the same
// text as a call to an undefined function and fails to parse. Rewriting keeps
// every existing template working while newly authored templates can use
// standard "{{.Field}}" syntax, pipelines and conditionals unchanged.
//
// Only an action consisting solely of one identifier is rewritten. Anything
// with a dot, "$", a function call or a pipeline is already valid template
// syntax and is left untouched, as are the keywords that may legally stand
// alone.
func normalizeLegacyPlaceholders(tmpl string) string {
	if !strings.Contains(tmpl, "{{") {
		return tmpl
	}
	return legacyPlaceholder.ReplaceAllStringFunc(tmpl, func(match string) string {
		groups := legacyPlaceholder.FindStringSubmatch(match)
		if len(groups) != 2 {
			return match
		}
		if _, reserved := templateKeywords[groups[1]]; reserved {
			return match
		}
		return "{{." + groups[1] + "}}"
	})
}

// missingKeyOption maps the policy onto text/template's missingkey option.
//
// Only the error policy is expressed through the option. The empty policy is
// implemented by pre-populating absent keys in withMissingDefaults, because
// missingkey=zero on a map[string]interface{} yields a nil interface that
// renders as the literal "<no value>" rather than an empty string.
func (r *Renderer) missingKeyOption() string {
	if r.policy == MissingVariableEmpty {
		return "missingkey=zero"
	}
	return "missingkey=error"
}

// withMissingDefaults returns data augmented with empty strings for every
// top-level variable the template references but the caller did not supply.
// Under MissingVariableError it returns data untouched, leaving the template
// engine to raise the error.
func (r *Renderer) withMissingDefaults(tree *parse.Tree, data map[string]interface{}) map[string]interface{} {
	if r.policy != MissingVariableEmpty || tree == nil {
		return data
	}

	referenced := map[string]struct{}{}
	collectFieldNames(tree.Root, referenced)
	if len(referenced) == 0 {
		return data
	}

	// Copy rather than mutate: the caller's map may be reused across channels.
	filled := make(map[string]interface{}, len(data)+len(referenced))
	for k, v := range data {
		filled[k] = v
	}
	for name := range referenced {
		if _, ok := filled[name]; !ok {
			filled[name] = ""
		}
	}
	return filled
}

// collectFieldNames walks a parsed template and records the first identifier
// of every field reference (the "Name" in {{.Name}} or {{.Name.Sub}}).
//
// References inside a range or with block are resolved against the block's own
// value rather than the root, so a name collected from one may not be a root
// variable at all. Adding a spurious empty key is harmless — it is only ever
// consulted for a name the template asked for and the data lacked.
func collectFieldNames(node parse.Node, out map[string]struct{}) {
	switch n := node.(type) {
	case nil:
		return
	case *parse.ListNode:
		if n == nil {
			return
		}
		for _, child := range n.Nodes {
			collectFieldNames(child, out)
		}
	case *parse.ActionNode:
		collectFieldNames(n.Pipe, out)
	case *parse.PipeNode:
		if n == nil {
			return
		}
		for _, cmd := range n.Cmds {
			collectFieldNames(cmd, out)
		}
	case *parse.CommandNode:
		for _, arg := range n.Args {
			collectFieldNames(arg, out)
		}
	case *parse.FieldNode:
		if len(n.Ident) > 0 {
			out[n.Ident[0]] = struct{}{}
		}
	case *parse.IfNode:
		collectBranch(&n.BranchNode, out)
	case *parse.RangeNode:
		collectBranch(&n.BranchNode, out)
	case *parse.WithNode:
		collectBranch(&n.BranchNode, out)
	case *parse.TemplateNode:
		collectFieldNames(n.Pipe, out)
	}
}

// collectBranch walks the pipe and both bodies of a branching node.
func collectBranch(b *parse.BranchNode, out map[string]struct{}) {
	collectFieldNames(b.Pipe, out)
	if b.List != nil {
		collectFieldNames(b.List, out)
	}
	if b.ElseList != nil {
		collectFieldNames(b.ElseList, out)
	}
}
