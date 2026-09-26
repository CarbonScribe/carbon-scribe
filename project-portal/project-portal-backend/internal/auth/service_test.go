package auth

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newAuthTestService(t *testing.T, opts ...ServiceOption) (*Service, *Repository, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	// SQLite does not support the PostgreSQL-specific inet type and UUID defaults.
	require.NoError(t, db.Exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT, wallet_address TEXT, full_name TEXT, organization TEXT, role TEXT, email_verified BOOLEAN, is_active BOOLEAN, last_login_at DATETIME, created_at DATETIME, updated_at DATETIME)").Error)
	require.NoError(t, db.Exec("CREATE TABLE auth_tokens (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL, token_type TEXT NOT NULL, expires_at DATETIME NOT NULL, used BOOLEAN, used_at DATETIME, created_at DATETIME)").Error)
	repo := NewRepository(db)
	tm := NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	return NewService(repo, tm, NewStellarAuthenticator("test-passphrase", time.Minute), 4, opts...), repo, db
}

// fakeEmailer records every SendEmail call for assertions and can be
// configured to return an error.
type fakeEmailer struct {
	mu   sync.Mutex
	sent []sentEmail
	err  error
}

type sentEmail struct {
	to, subject, htmlBody, textBody string
}

func (f *fakeEmailer) SendEmail(_ context.Context, to, subject, htmlBody, textBody string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.sent = append(f.sent, sentEmail{to, subject, htmlBody, textBody})
	return nil
}

func (f *fakeEmailer) emails() []sentEmail {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]sentEmail, len(f.sent))
	copy(out, f.sent)
	return out
}

func TestAuthConstants(t *testing.T) {
	require.Equal(t, 12, DefaultPasswordHashCost)
	require.Equal(t, 24*time.Hour, EmailVerificationTokenTTL)
	require.Equal(t, 1*time.Hour, PasswordResetTokenTTL)
}

func TestNewServiceDefaultPasswordHashCost(t *testing.T) {
	svc := NewService(nil, nil, nil, 0)
	require.Equal(t, DefaultPasswordHashCost, svc.passwordHashCost)
}

func TestLoginRejectsUnverifiedUser(t *testing.T) {
	svc, _, _ := newAuthTestService(t)
	_, _, err := svc.Register("user@example.com", "password123", "Test User", "Org")
	require.NoError(t, err)

	_, err = svc.Login("user@example.com", "password123", "127.0.0.1", "test")
	require.ErrorIs(t, err, ErrEmailNotVerified)
}

func TestVerifyEmailRejectsExpiredToken(t *testing.T) {
	svc, repo, db := newAuthTestService(t)
	user := &User{ID: "user-1", Email: "user@example.com", EmailVerified: false, IsActive: true}
	require.NoError(t, repo.CreateUser(user))
	token := &AuthToken{ID: "token-1", Token: "expired", UserID: user.ID, TokenType: "email_verification", ExpiresAt: time.Now().Add(-time.Minute), CreatedAt: time.Now()}
	require.NoError(t, repo.CreateAuthToken(token))

	err := svc.VerifyEmail(token.Token)
	require.EqualError(t, err, "verification token expired")

	var unchanged User
	require.NoError(t, db.First(&unchanged, "id = ?", user.ID).Error)
	require.False(t, unchanged.EmailVerified)
}

func TestResendVerificationDoesNotCreateDuplicateActiveToken(t *testing.T) {
	svc, repo, db := newAuthTestService(t)
	user := &User{ID: "user-2", Email: "user2@example.com", EmailVerified: false, IsActive: true}
	require.NoError(t, repo.CreateUser(user))

	first, err := svc.ResendVerification(user.Email)
	require.NoError(t, err)
	require.NotEmpty(t, first)
	second, err := svc.ResendVerification(user.Email)
	require.NoError(t, err)
	require.Empty(t, second)

	var count int64
	require.NoError(t, db.Model(&AuthToken{}).Where("user_id = ? AND token_type = ?", user.ID, "email_verification").Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestUserResponseIncludesVerificationRequired(t *testing.T) {
	response := toUserResponse(&User{ID: "user-3", Email: "user3@example.com", EmailVerified: false})
	require.True(t, response.VerificationRequired)
	require.False(t, strings.Contains(response.Email, "password"))
	encoded, err := json.Marshal(response)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"verification_required":true`)

	response = toUserResponse(&User{ID: "user-4", Email: "user4@example.com", EmailVerified: true})
	require.False(t, response.VerificationRequired)
}

func TestRegisterSendsVerificationEmailWhenEmailerConfigured(t *testing.T) {
	emailer := &fakeEmailer{}
	svc, _, _ := newAuthTestService(t, WithEmailer(emailer, "https://app.example.com/verify-email", "https://app.example.com/reset-password"))

	_, token, err := svc.Register("user@example.com", "password123", "Test User", "Org")
	require.NoError(t, err)
	require.NotEmpty(t, token)

	sent := emailer.emails()
	require.Len(t, sent, 1)
	require.Equal(t, "user@example.com", sent[0].to)
	require.Contains(t, sent[0].htmlBody, token)
	require.Contains(t, sent[0].textBody, token)
}

func TestRegisterDoesNotSendEmailWhenNoEmailerConfigured(t *testing.T) {
	// newAuthTestService with no options: emailer is nil, matching this
	// service's pre-email-delivery behavior.
	svc, _, _ := newAuthTestService(t)

	_, token, err := svc.Register("user@example.com", "password123", "Test User", "Org")
	require.NoError(t, err)
	require.NotEmpty(t, token, "the token must still be generated and returned even without an emailer")
}

func TestRegisterSucceedsEvenWhenEmailSendFails(t *testing.T) {
	emailer := &fakeEmailer{err: errSESUnavailable}
	svc, _, _ := newAuthTestService(t, WithEmailer(emailer, "https://app.example.com/verify-email", "https://app.example.com/reset-password"))

	_, token, err := svc.Register("user@example.com", "password123", "Test User", "Org")
	require.NoError(t, err, "a transient email-send failure must not fail registration")
	require.NotEmpty(t, token)
}

func TestRequestPasswordResetSendsEmailWhenEmailerConfigured(t *testing.T) {
	emailer := &fakeEmailer{}
	svc, repo, _ := newAuthTestService(t, WithEmailer(emailer, "https://app.example.com/verify-email", "https://app.example.com/reset-password"))

	user := &User{ID: "user-5", Email: "user5@example.com", EmailVerified: true, IsActive: true}
	require.NoError(t, repo.CreateUser(user))

	token, err := svc.RequestPasswordReset(user.Email)
	require.NoError(t, err)
	require.NotEmpty(t, token)

	sent := emailer.emails()
	require.Len(t, sent, 1)
	require.Equal(t, user.Email, sent[0].to)
	require.Contains(t, sent[0].htmlBody, token)
}

func TestRequestPasswordResetDoesNotEmailUnknownAddress(t *testing.T) {
	emailer := &fakeEmailer{}
	svc, _, _ := newAuthTestService(t, WithEmailer(emailer, "https://app.example.com/verify-email", "https://app.example.com/reset-password"))

	token, err := svc.RequestPasswordReset("unknown@example.com")
	require.NoError(t, err)
	require.Empty(t, token)
	require.Empty(t, emailer.emails(), "must not reveal whether the address exists by emailing it")
}

func TestResendVerificationSendsEmailWhenEmailerConfigured(t *testing.T) {
	emailer := &fakeEmailer{}
	svc, repo, _ := newAuthTestService(t, WithEmailer(emailer, "https://app.example.com/verify-email", "https://app.example.com/reset-password"))

	user := &User{ID: "user-6", Email: "user6@example.com", EmailVerified: false, IsActive: true}
	require.NoError(t, repo.CreateUser(user))

	token, err := svc.ResendVerification(user.Email)
	require.NoError(t, err)
	require.NotEmpty(t, token)

	sent := emailer.emails()
	require.Len(t, sent, 1)
	require.Equal(t, user.Email, sent[0].to)
}

func TestBuildTokenLink(t *testing.T) {
	require.Equal(t, "https://app.example.com/verify?token=abc123", buildTokenLink("https://app.example.com/verify", "abc123"))
	require.Equal(t, "https://app.example.com/verify?ref=x&token=abc123", buildTokenLink("https://app.example.com/verify?ref=x", "abc123"))
}

var errSESUnavailable = &testEmailError{"SES temporarily unavailable"}

type testEmailError struct{ msg string }

func (e *testEmailError) Error() string { return e.msg }
