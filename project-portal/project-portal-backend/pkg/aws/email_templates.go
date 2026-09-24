package aws

import (
	"bytes"
	"fmt"
	"html/template"
	"time"
)

// Templates render as html/template (auto-escaping untrusted values like
// alert titles/messages) for the HTML body, and plain fmt.Sprintf for the
// text body — there's no untrusted-markup risk in a plain-text body.

var verificationEmailTemplate = template.Must(template.New("verification").Parse(`<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
  <h2>Verify your CarbonScribe account</h2>
  <p>Thanks for signing up. Please confirm your email address to activate your account.</p>
  <p>
    <a href="{{.Link}}" style="display:inline-block;padding:10px 20px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;">Verify Email</a>
  </p>
  <p>Or copy and paste this link into your browser:<br>{{.Link}}</p>
  <p style="color:#6b7280;font-size:13px;">This link expires in {{.ExpiryHours}} hours. If you didn't create this account, you can safely ignore this email.</p>
</body>
</html>`))

var passwordResetEmailTemplate = template.Must(template.New("password_reset").Parse(`<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
  <h2>Reset your CarbonScribe password</h2>
  <p>We received a request to reset the password for your account.</p>
  <p>
    <a href="{{.Link}}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">Reset Password</a>
  </p>
  <p>Or copy and paste this link into your browser:<br>{{.Link}}</p>
  <p style="color:#6b7280;font-size:13px;">This link expires in {{.ExpiryMinutes}} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
</body>
</html>`))

var alertEmailTemplate = template.Must(template.New("alert").Parse(`<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
  <h2>{{if eq .Status "resolved"}}✅ Alert resolved{{else}}🚨 Alert triggered{{end}}: {{.Title}}</h2>
  <table style="border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Service</td><td>{{.ServiceName}}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Severity</td><td>{{.Severity}}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Status</td><td>{{.Status}}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Time</td><td>{{.Timestamp}}</td></tr>
  </table>
  <p>{{.Message}}</p>
</body>
</html>`))

type verificationEmailData struct {
	Link        string
	ExpiryHours int
}

// RenderVerificationEmail returns the subject, HTML body, and plain-text
// body for an email-verification message linking to link.
func RenderVerificationEmail(link string, expiry time.Duration) (subject, htmlBody, textBody string) {
	data := verificationEmailData{Link: link, ExpiryHours: int(expiry.Hours())}

	var buf bytes.Buffer
	// The template is a package-level constant parsed with template.Must at
	// init; Execute only fails for data/template mismatches, which a fixed
	// struct against a fixed template can't produce.
	_ = verificationEmailTemplate.Execute(&buf, data)

	subject = "Verify your CarbonScribe email address"
	htmlBody = buf.String()
	textBody = fmt.Sprintf(
		"Verify your CarbonScribe account by visiting:\n%s\n\nThis link expires in %d hours. If you didn't create this account, you can safely ignore this email.",
		link, data.ExpiryHours,
	)
	return subject, htmlBody, textBody
}

type passwordResetEmailData struct {
	Link          string
	ExpiryMinutes int
}

// RenderPasswordResetEmail returns the subject, HTML body, and plain-text
// body for a password-reset message linking to link.
func RenderPasswordResetEmail(link string, expiry time.Duration) (subject, htmlBody, textBody string) {
	data := passwordResetEmailData{Link: link, ExpiryMinutes: int(expiry.Minutes())}

	var buf bytes.Buffer
	_ = passwordResetEmailTemplate.Execute(&buf, data)

	subject = "Reset your CarbonScribe password"
	htmlBody = buf.String()
	textBody = fmt.Sprintf(
		"Reset your CarbonScribe password by visiting:\n%s\n\nThis link expires in %d minutes. If you didn't request this, you can safely ignore this email.",
		link, data.ExpiryMinutes,
	)
	return subject, htmlBody, textBody
}

// AlertEmailData carries the fields rendered into an alert notification
// email, for both the triggered and resolved cases.
type AlertEmailData struct {
	Title       string
	Message     string
	Severity    string
	ServiceName string
	Status      string // "triggered" or "resolved"
	Timestamp   time.Time
}

// RenderAlertEmail returns the subject, HTML body, and plain-text body for
// an alert notification email (triggered or resolved, per data.Status).
func RenderAlertEmail(data AlertEmailData) (subject, htmlBody, textBody string) {
	var buf bytes.Buffer
	_ = alertEmailTemplate.Execute(&buf, struct {
		AlertEmailData
		Timestamp string
	}{data, data.Timestamp.Format(time.RFC3339)})

	statusLabel := data.Status
	if statusLabel == "" {
		statusLabel = "triggered"
	}
	subject = fmt.Sprintf("[%s] Alert %s: %s", data.ServiceName, statusLabel, data.Title)
	htmlBody = buf.String()
	textBody = fmt.Sprintf(
		"Alert %s: %s\nService: %s\nSeverity: %s\nStatus: %s\nTime: %s\n\n%s",
		statusLabel, data.Title, data.ServiceName, data.Severity, data.Status,
		data.Timestamp.Format(time.RFC3339), data.Message,
	)
	return subject, htmlBody, textBody
}
