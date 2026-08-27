package auth

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newAuthTestService(t *testing.T) (*Service, *Repository, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	// SQLite does not support the PostgreSQL-specific inet type and UUID defaults.
	require.NoError(t, db.Exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT, wallet_address TEXT, full_name TEXT, organization TEXT, role TEXT, email_verified BOOLEAN, is_active BOOLEAN, last_login_at DATETIME, created_at DATETIME, updated_at DATETIME)").Error)
	require.NoError(t, db.Exec("CREATE TABLE auth_tokens (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL, token_type TEXT NOT NULL, expires_at DATETIME NOT NULL, used BOOLEAN, used_at DATETIME, created_at DATETIME)").Error)
	repo := NewRepository(db)
	tm := NewTokenManager("test-secret", 15*time.Minute, 24*time.Hour)
	return NewService(repo, tm, NewStellarAuthenticator("test-passphrase", time.Minute), 4), repo, db
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
