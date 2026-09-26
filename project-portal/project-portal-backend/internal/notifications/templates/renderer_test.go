package templates

import (
	"strings"
	"testing"
)

func TestRenderInterpolatesVariables(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.Render("Project {{.ProjectName}} issued {{.Credits}} credits", map[string]interface{}{
		"ProjectName": "Kasigau Corridor",
		"Credits":     1250,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := "Project Kasigau Corridor issued 1250 credits"
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderEmptyTemplateReturnsEmpty(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.Render("", map[string]interface{}{"A": 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "" {
		t.Errorf("Render(\"\") = %q, want empty", got)
	}
}

// TestZeroValueRendererDefaultsToErrorPolicy pins the documented default.
func TestZeroValueRendererDefaultsToErrorPolicy(t *testing.T) {
	var r Renderer

	if r.Policy() != MissingVariableError {
		t.Fatalf("zero-value policy = %v, want %v", r.Policy(), MissingVariableError)
	}
	if _, err := r.Render("Hello {{.Name}}", map[string]interface{}{}); err == nil {
		t.Error("expected zero-value Renderer to error on a missing variable")
	}
}

// ---------------------------------------------------------------------------
// Missing-variable policy
// ---------------------------------------------------------------------------

func TestRenderMissingVariableErrorPolicy(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	_, err := r.Render("Hello {{.Name}}, welcome to {{.Missing}}", map[string]interface{}{
		"Name": "Ada",
	})
	if err == nil {
		t.Fatal("expected an error for a missing variable under the error policy")
	}
	if !strings.Contains(err.Error(), "execute template") {
		t.Errorf("error should identify the failing stage, got: %v", err)
	}
}

func TestRenderMissingVariableEmptyPolicy(t *testing.T) {
	r := NewRenderer(MissingVariableEmpty)

	got, err := r.Render("Hello {{.Name}}!{{.Missing}}", map[string]interface{}{
		"Name": "Ada",
	})
	if err != nil {
		t.Fatalf("unexpected error under the empty policy: %v", err)
	}

	want := "Hello Ada!"
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
	// Guard against the text/template default, which renders a nil map value
	// as the literal "<no value>".
	if strings.Contains(got, "<no value>") {
		t.Errorf("missing variable leaked %q into output: %q", "<no value>", got)
	}
}

// TestEmptyPolicyDoesNotMutateCallerData ensures rendering for one channel
// cannot pollute the data map used for the next.
func TestEmptyPolicyDoesNotMutateCallerData(t *testing.T) {
	r := NewRenderer(MissingVariableEmpty)
	data := map[string]interface{}{"Name": "Ada"}

	if _, err := r.Render("{{.Name}} {{.Absent}}", data); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, present := data["Absent"]; present {
		t.Error("renderer mutated the caller's data map")
	}
	if len(data) != 1 {
		t.Errorf("caller data grew to %d keys, want 1", len(data))
	}
}

func TestEmptyPolicyFillsVariablesInsideConditionals(t *testing.T) {
	r := NewRenderer(MissingVariableEmpty)

	got, err := r.Render("{{if .Flag}}on{{else}}off{{end}}:{{.Absent}}", map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "off:" {
		t.Errorf("Render() = %q, want %q", got, "off:")
	}
}

// ---------------------------------------------------------------------------
// Legacy placeholder compatibility
// ---------------------------------------------------------------------------

// TestRenderLegacyBarePlaceholders covers templates stored before this
// renderer existed, which use "{{user_name}}" rather than "{{.user_name}}".
// text/template reads a bare identifier as an undefined function, so these
// must be normalised or every stored template breaks.
func TestRenderLegacyBarePlaceholders(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.Render("Hello {{user_name}}, you have {{ credit_count }} credits", map[string]interface{}{
		"user_name":    "Ada",
		"credit_count": 7,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := "Hello Ada, you have 7 credits"
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

// TestBothPlaceholderSyntaxesInteroperate confirms new dotted syntax and the
// legacy bare syntax can coexist in one template.
func TestBothPlaceholderSyntaxesInteroperate(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.Render("{{.ProjectName}} / {{project_id}}", map[string]interface{}{
		"ProjectName": "Kasigau",
		"project_id":  "PRJ-1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "Kasigau / PRJ-1" {
		t.Errorf("Render() = %q, want %q", got, "Kasigau / PRJ-1")
	}
}

// TestNormalizeLeavesRealTemplateSyntaxAlone guards against the rewrite
// corrupting pipelines, conditionals or variables.
func TestNormalizeLeavesRealTemplateSyntaxAlone(t *testing.T) {
	for _, tmpl := range []string{
		"{{if .Flag}}a{{else}}b{{end}}",
		"{{range .Items}}x{{end}}",
		"{{.Name | printf \"%s\"}}",
		"{{$x := .Name}}{{$x}}",
		"plain text only",
	} {
		if got := normalizeLegacyPlaceholders(tmpl); got != tmpl {
			t.Errorf("normalizeLegacyPlaceholders(%q) = %q, want unchanged", tmpl, got)
		}
	}
}

func TestLegacyPlaceholderEscapedInEmailBody(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.RenderForChannel(ChannelEmail, "s", "<p>{{user_name}}</p>", map[string]interface{}{
		"user_name": "<script>x</script>",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(got.Body, "<script>") {
		t.Errorf("legacy placeholder bypassed HTML escaping: %q", got.Body)
	}
}

// ---------------------------------------------------------------------------
// Malformed templates
// ---------------------------------------------------------------------------

func TestRenderMalformedTemplateReturnsError(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	for name, tmpl := range map[string]string{
		"unclosed action": "Hello {{.Name",
		"unclosed if":     "{{if .Flag}}yes",
		"bad function":    "{{ nonexistentFunc .Name }}",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := r.Render(tmpl, map[string]interface{}{"Name": "Ada", "Flag": true})
			if err == nil {
				t.Fatalf("expected a parse error for %q", tmpl)
			}
			if !strings.Contains(err.Error(), "parse template") {
				t.Errorf("expected a parse-stage error, got: %v", err)
			}
		})
	}
}

func TestRenderHTMLMalformedTemplateReturnsError(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	if _, err := r.RenderHTML("<p>{{.Name", map[string]interface{}{"Name": "Ada"}); err == nil {
		t.Fatal("expected a parse error for a malformed HTML template")
	}
}

// TestMalformedTemplateDoesNotPanic guards the acceptance criterion that a
// bad template is an error, never a panic taking the dispatcher down.
func TestMalformedTemplateDoesNotPanic(t *testing.T) {
	defer func() {
		if rec := recover(); rec != nil {
			t.Fatalf("renderer panicked on malformed input: %v", rec)
		}
	}()

	r := NewRenderer(MissingVariableEmpty)
	_, _ = r.Render("{{range .Items}}{{end", nil)
	_, _ = r.RenderHTML("{{if}}", nil)
	_, _ = r.RenderForChannel(ChannelEmail, "{{", "{{", nil)
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

func TestRenderHTMLEscapesInterpolatedData(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.RenderHTML("<p>Hello {{.Name}}</p>", map[string]interface{}{
		"Name": `<script>alert("xss")</script>`,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if strings.Contains(got, "<script>") {
		t.Errorf("interpolated data was not escaped: %q", got)
	}
	if !strings.Contains(got, "&lt;script&gt;") {
		t.Errorf("expected escaped markup in output, got: %q", got)
	}
	// The template's own markup must survive escaping.
	if !strings.HasPrefix(got, "<p>Hello ") {
		t.Errorf("template markup was escaped as well: %q", got)
	}
}

func TestRenderPlainTextDoesNotEscape(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.Render("Hello {{.Name}}", map[string]interface{}{"Name": "Ada & Grace"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// An SMS body must not carry HTML entities.
	if got != "Hello Ada & Grace" {
		t.Errorf("Render() = %q, want %q", got, "Hello Ada & Grace")
	}
}

// ---------------------------------------------------------------------------
// Channel-aware rendering
// ---------------------------------------------------------------------------

func TestRenderForChannelEmailEscapesBody(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.RenderForChannel(
		ChannelEmail,
		"Update for {{.ProjectName}}",
		"<p>{{.Note}}</p>",
		map[string]interface{}{
			"ProjectName": "Kasigau",
			"Note":        `<img src=x onerror="steal()">`,
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// The payload must survive only as inert text: no real <img> tag, and the
	// angle brackets and quotes that would form one must be entity-encoded.
	if strings.Contains(got.Body, "<img") {
		t.Errorf("email body rendered a live <img> tag: %q", got.Body)
	}
	if !strings.Contains(got.Body, "&lt;img") {
		t.Errorf("expected the injected tag to be escaped, got: %q", got.Body)
	}
	if strings.Contains(got.Body, `onerror="steal()"`) {
		t.Errorf("email body kept an unescaped event handler: %q", got.Body)
	}
	if got.Subject != "Update for Kasigau" {
		t.Errorf("subject = %q, want %q", got.Subject, "Update for Kasigau")
	}
}

// TestRenderForChannelSubjectIsNeverHTMLEscaped documents that the subject is
// a mail header rather than markup, so entities must not leak into it.
func TestRenderForChannelSubjectIsNeverHTMLEscaped(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.RenderForChannel(ChannelEmail, "{{.Name}} & co", "<p>body</p>", map[string]interface{}{
		"Name": "Ada",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got.Subject != "Ada & co" {
		t.Errorf("subject = %q, want %q", got.Subject, "Ada & co")
	}
}

func TestRenderForChannelNonEmailUsesPlainText(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	for _, channel := range []string{ChannelSMS, ChannelWebSocket, ChannelInApp} {
		t.Run(channel, func(t *testing.T) {
			got, err := r.RenderForChannel(channel, "s", "Tom & Jerry: {{.Name}}", map[string]interface{}{
				"Name": "A&B",
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.Body != "Tom & Jerry: A&B" {
				t.Errorf("%s body = %q, want unescaped text", channel, got.Body)
			}
		})
	}
}

func TestRenderForChannelIsCaseInsensitive(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	got, err := r.RenderForChannel("  email  ", "s", "<p>{{.Name}}</p>", map[string]interface{}{
		"Name": "<b>x</b>",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(got.Body, "<b>") {
		t.Errorf("lowercase/padded email channel was not treated as email: %q", got.Body)
	}
}

func TestRenderForChannelPropagatesSubjectError(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	_, err := r.RenderForChannel(ChannelSMS, "{{.Missing}}", "body", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected an error from the subject render")
	}
	if !strings.Contains(err.Error(), "render subject") {
		t.Errorf("error should identify the subject stage, got: %v", err)
	}
}

func TestRenderForChannelPropagatesBodyError(t *testing.T) {
	r := NewRenderer(MissingVariableError)

	_, err := r.RenderForChannel(ChannelEmail, "subject", "{{.Missing}}", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected an error from the body render")
	}
	if !strings.Contains(err.Error(), "render body") {
		t.Errorf("error should identify the body stage, got: %v", err)
	}
}
