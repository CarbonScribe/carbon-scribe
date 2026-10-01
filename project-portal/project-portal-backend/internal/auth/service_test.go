package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newAuthTestService(t *testing.T, opts ...ServiceOption) (*Service, *Repository, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT, wallet_address TEXT, full_name TEXT, organization TEXT, role TEXT, email_verified BOOLEAN, is_active BOOLEAN, failed_login_attempts INT DEFAULT 0, locked_until DATETIME, last_login_at DATETIME, created_at DATETIME, updated_at DATETIME)").Error)
	require.NoError(t, db.Exec("CREATE TABLE auth_tokens (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL, token_type TEXT NOT NULL, expires_at DATETIME NOT NULL, used BOOLEAN, used_at DATETIME, created_at DATETIME)").Error)
	require.NoError(t, db.Exec("CREATE TABLE user_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, access_token_id TEXT UNIQUE NOT NULL, refresh_token_id TEXT UNIQUE NOT NULL, ip_address TEXT, user_agent TEXT, expires_at DATETIME NOT NULL, is_revoked BOOLEAN DEFAULT FALSE, created_at DATETIME)").Error)
	require.NoError(t, db.Exec("CREATE TABLE role_permissions (role TEXT PRIMARY KEY, permissions TEXT, description TEXT, created_at DATETIME, updated_at DATETIME)").Error)
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

func TestAccountLockoutThresholdReached(t *testing.T) {
	svc, repo, _ := newAuthTestService(t, WithLockoutConfig(3, 10*time.Minute))
	// Hash password properly
	_, token, err := svc.Register("lockout1@example.com", "Password123!", "Lockout Test 1", "Org")
	require.NoError(t, err)
	require.NoError(t, svc.VerifyEmail(token))

	// Attempt 1: bad password
	_, err = svc.Login("lockout1@example.com", "WrongPassword1", "127.0.0.1", "agent")
	require.EqualError(t, err, "invalid email or password")

	// Attempt 2: bad password
	_, err = svc.Login("lockout1@example.com", "WrongPassword2", "127.0.0.1", "agent")
	require.EqualError(t, err, "invalid email or password")

	// Attempt 3: threshold reached -> locked!
	_, err = svc.Login("lockout1@example.com", "WrongPassword3", "127.0.0.1", "agent")
	require.ErrorIs(t, err, ErrAccountLocked)

	// Verify user record in DB has lockout set
	dbUser, err := repo.GetUserByEmail("lockout1@example.com")
	require.NoError(t, err)
	require.Equal(t, 3, dbUser.FailedLoginAttempts)
	require.NotNil(t, dbUser.LockedUntil)
	require.True(t, dbUser.LockedUntil.After(time.Now()))
}

func TestAccountLockoutEnforcedWithoutPasswordCheck(t *testing.T) {
	svc, repo, _ := newAuthTestService(t, WithLockoutConfig(3, 10*time.Minute))
	_, token, err := svc.Register("lockout2@example.com", "ValidPassword123!", "Lockout Test 2", "Org")
	require.NoError(t, err)
	require.NoError(t, svc.VerifyEmail(token))

	user, err := repo.GetUserByEmail("lockout2@example.com")
	require.NoError(t, err)

	// Manually set account locked
	lockedTime := time.Now().Add(10 * time.Minute)
	require.NoError(t, repo.UpdateUserLockout(user.ID, 3, &lockedTime))

	// Login attempt even with VALID password must be rejected immediately
	_, err = svc.Login("lockout2@example.com", "ValidPassword123!", "127.0.0.1", "agent")
	require.ErrorIs(t, err, ErrAccountLocked)

	var lockedErr *AccountLockedError
	require.ErrorAs(t, err, &lockedErr)
	require.NotNil(t, lockedErr.LockedUntil)
}

func TestAccountLockoutExpiryAutoReset(t *testing.T) {
	svc, repo, _ := newAuthTestService(t, WithLockoutConfig(3, 10*time.Minute))
	_, token, err := svc.Register("lockout3@example.com", "ValidPassword123!", "Lockout Test 3", "Org")
	require.NoError(t, err)
	require.NoError(t, svc.VerifyEmail(token))

	user, err := repo.GetUserByEmail("lockout3@example.com")
	require.NoError(t, err)

	// Set lockout in the past (expired)
	expiredLock := time.Now().Add(-1 * time.Minute)
	require.NoError(t, repo.UpdateUserLockout(user.ID, 3, &expiredLock))

	// Login attempt should auto-clear expired lockout and succeed with valid password
	resp, err := svc.Login("lockout3@example.com", "ValidPassword123!", "127.0.0.1", "agent")
	require.NoError(t, err)
	require.NotNil(t, resp)

	// Verify DB state is reset
	dbUser, err := repo.GetUserByEmail("lockout3@example.com")
	require.NoError(t, err)
	require.Equal(t, 0, dbUser.FailedLoginAttempts)
	require.Nil(t, dbUser.LockedUntil)
}

func TestSuccessfulLoginResetsLockoutCount(t *testing.T) {
	svc, repo, _ := newAuthTestService(t, WithLockoutConfig(5, 10*time.Minute))
	_, token, err := svc.Register("lockout4@example.com", "ValidPassword123!", "Lockout Test 4", "Org")
	require.NoError(t, err)
	require.NoError(t, svc.VerifyEmail(token))

	// 2 failed attempts
	_, err = svc.Login("lockout4@example.com", "Wrong1", "127.0.0.1", "agent")
	require.Error(t, err)
	_, err = svc.Login("lockout4@example.com", "Wrong2", "127.0.0.1", "agent")
	require.Error(t, err)

	dbUser, _ := repo.GetUserByEmail("lockout4@example.com")
	require.Equal(t, 2, dbUser.FailedLoginAttempts)

	// Successful login resets count to 0
	_, err = svc.Login("lockout4@example.com", "ValidPassword123!", "127.0.0.1", "agent")
	require.NoError(t, err)

	dbUser, _ = repo.GetUserByEmail("lockout4@example.com")
	require.Equal(t, 0, dbUser.FailedLoginAttempts)
	require.Nil(t, dbUser.LockedUntil)
}

func TestAdminClearLockout(t *testing.T) {
	svc, repo, _ := newAuthTestService(t, WithLockoutConfig(3, 10*time.Minute))
	_, token, err := svc.Register("lockout5@example.com", "ValidPassword123!", "Lockout Test 5", "Org")
	require.NoError(t, err)
	require.NoError(t, svc.VerifyEmail(token))

	user, _ := repo.GetUserByEmail("lockout5@example.com")
	lockedTime := time.Now().Add(10 * time.Minute)
	require.NoError(t, repo.UpdateUserLockout(user.ID, 3, &lockedTime))

	// Locked initially
	_, err = svc.Login("lockout5@example.com", "ValidPassword123!", "127.0.0.1", "agent")
	require.ErrorIs(t, err, ErrAccountLocked)

	// Admin unlocks account
	require.NoError(t, svc.ClearLockout(user.ID))

	// User can now log in
	resp, err := svc.Login("lockout5@example.com", "ValidPassword123!", "127.0.0.1", "agent")
	require.NoError(t, err)
	require.NotNil(t, resp)
}

func TestRepositoryLoginFailureIncrementIsThresholded(t *testing.T) {
	svc, repo, _ := newAuthTestService(t)
	_, token, err := svc.Register("atomic-lock@example.com", "Password123!", "Atomic Test", "Org")
	require.NoError(t, err)
	require.NoError(t, svc.VerifyEmail(token))
	user, err := repo.GetUserByEmail("atomic-lock@example.com")
	require.NoError(t, err)
	for want := 1; want <= DefaultMaxLoginAttempts; want++ {
		attempts, lockedUntil, recordErr := repo.RecordUserLoginFailure(user.ID, DefaultMaxLoginAttempts, DefaultLockoutDuration)
		require.NoError(t, recordErr)
		require.Equal(t, want, attempts)
		if want < DefaultMaxLoginAttempts {
			require.Nil(t, lockedUntil)
		} else {
			require.NotNil(t, lockedUntil)
		}
	}
}

func TestIPBasedLockoutHTTPIncludesRetryAfter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc, _, _ := newAuthTestService(t, WithLockoutConfig(1, time.Minute))
	svc.ipTracker.RecordFailure("192.0.2.10", 1, time.Minute)
	router := gin.New()
	router.POST("/login", NewHandler(svc).Login)
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"nobody@example.com","password":"wrong"}`))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.10:12345"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	require.Equal(t, http.StatusLocked, response.Code)
	require.NotEmpty(t, response.Header().Get("Retry-After"))
	require.Contains(t, response.Body.String(), `"retry_after_seconds"`)
}

func TestIPBasedAttemptTracking(t *testing.T) {
	svc, _, _ := newAuthTestService(t, WithLockoutConfig(3, 10*time.Minute))

	testIP := "192.168.1.100"
	// 3 failures from same IP with non-existent accounts
	_, err := svc.Login("nonexistent1@example.com", "pass", testIP, "agent")
	require.EqualError(t, err, "invalid email or password")
	_, err = svc.Login("nonexistent2@example.com", "pass", testIP, "agent")
	require.EqualError(t, err, "invalid email or password")
	_, err = svc.Login("nonexistent3@example.com", "pass", testIP, "agent")
	require.EqualError(t, err, "invalid email or password")

	// 4th request from same IP is blocked at IP level
	_, err = svc.Login("nonexistent4@example.com", "pass", testIP, "agent")
	require.ErrorIs(t, err, ErrAccountLocked)
}

var errSESUnavailable = &testEmailError{"SES temporarily unavailable"}

type testEmailError struct{ msg string }

func (e *testEmailError) Error() string { return e.msg }
