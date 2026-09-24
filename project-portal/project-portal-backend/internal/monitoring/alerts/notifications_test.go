package alerts

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

type fakeAlertEmailer struct {
	mu   sync.Mutex
	sent []sentAlertEmail
}

type sentAlertEmail struct {
	to, subject, htmlBody, textBody string
}

func (f *fakeAlertEmailer) SendEmail(_ context.Context, to, subject, htmlBody, textBody string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentAlertEmail{to, subject, htmlBody, textBody})
	return nil
}

func (f *fakeAlertEmailer) emails() []sentAlertEmail {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]sentAlertEmail, len(f.sent))
	copy(out, f.sent)
	return out
}

func testAlert() *monitoring.SystemAlert {
	return &monitoring.SystemAlert{
		ID:          "alert-1",
		ServiceName: "api",
		Severity:    monitoring.AlertSeverityCritical,
		Title:       "High error rate",
		Message:     "Error rate exceeded 5% for 5 minutes",
		CreatedAt:   time.Now(),
	}
}

func TestSendAlert_EmailSentToConfiguredRecipients(t *testing.T) {
	emailer := &fakeAlertEmailer{}
	svc := NewNotificationService(WithEmailClient(emailer))

	rule := &AlertRule{
		Notification: &NotificationConfig{
			Channels: []string{"email"},
			Email:    &EmailConfig{To: []string{"oncall@example.com", "lead@example.com"}},
		},
	}

	svc.SendAlert(context.Background(), testAlert(), rule)

	sent := emailer.emails()
	require.Len(t, sent, 2)
	assert.Equal(t, "oncall@example.com", sent[0].to)
	assert.Equal(t, "lead@example.com", sent[1].to)
	assert.Contains(t, sent[0].htmlBody, "High error rate")
	assert.Contains(t, sent[0].textBody, "Error rate exceeded 5% for 5 minutes")
}

func TestSendAlertResolution_UsesResolvedStatus(t *testing.T) {
	emailer := &fakeAlertEmailer{}
	svc := NewNotificationService(WithEmailClient(emailer))

	resolvedAt := time.Now()
	alert := testAlert()
	alert.ResolvedAt = &resolvedAt

	rule := &AlertRule{
		Notification: &NotificationConfig{
			Channels: []string{"email"},
			Email:    &EmailConfig{To: []string{"oncall@example.com"}},
		},
	}

	svc.SendAlertResolution(context.Background(), alert, rule)

	sent := emailer.emails()
	require.Len(t, sent, 1)
	assert.Contains(t, sent[0].subject, "resolved")
}

func TestSendAlert_RespectsSubjectOverride(t *testing.T) {
	emailer := &fakeAlertEmailer{}
	svc := NewNotificationService(WithEmailClient(emailer))

	rule := &AlertRule{
		Notification: &NotificationConfig{
			Channels: []string{"email"},
			Email:    &EmailConfig{To: []string{"oncall@example.com"}, Subject: "Custom subject"},
		},
	}

	svc.SendAlert(context.Background(), testAlert(), rule)

	sent := emailer.emails()
	require.Len(t, sent, 1)
	assert.Equal(t, "Custom subject", sent[0].subject)
}

func TestSendAlert_NoEmailSentWithoutEmailChannel(t *testing.T) {
	emailer := &fakeAlertEmailer{}
	svc := NewNotificationService(WithEmailClient(emailer))

	rule := &AlertRule{
		Notification: &NotificationConfig{Channels: []string{"webhook"}},
	}

	svc.SendAlert(context.Background(), testAlert(), rule)

	assert.Empty(t, emailer.emails())
}

func TestSendAlert_NoEmailerConfiguredDoesNotPanic(t *testing.T) {
	svc := NewNotificationService()

	rule := &AlertRule{
		Notification: &NotificationConfig{
			Channels: []string{"email"},
			Email:    &EmailConfig{To: []string{"oncall@example.com"}},
		},
	}

	assert.NotPanics(t, func() {
		svc.SendAlert(context.Background(), testAlert(), rule)
	})
}

func TestSendAlert_NoRecipientsConfiguredDoesNotPanic(t *testing.T) {
	emailer := &fakeAlertEmailer{}
	svc := NewNotificationService(WithEmailClient(emailer))

	rule := &AlertRule{
		Notification: &NotificationConfig{Channels: []string{"email"}},
	}

	assert.NotPanics(t, func() {
		svc.SendAlert(context.Background(), testAlert(), rule)
	})
	assert.Empty(t, emailer.emails())
}
