package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/mail"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
	"carbon-scribe/project-portal/project-portal-backend/pkg/utils"

	"github.com/google/uuid"
)

const (
	// DefaultPasswordHashCost defines the default bcrypt cost factor used when hashing passwords.
	DefaultPasswordHashCost = 12

	// EmailVerificationTokenTTL defines the lifespan of an email verification token.
	EmailVerificationTokenTTL = 24 * time.Hour

	// PasswordResetTokenTTL defines the lifespan of a password reset token.
	PasswordResetTokenTTL = 1 * time.Hour
)

// Service handles business logic for authentication
type Service struct {
	repository       *Repository
	tokenManager     *TokenManager
	stellarAuth      *StellarAuthenticator
	passwordHashCost int

	// emailer is optional: when nil, verification/reset tokens are still
	// generated and stored but no email is sent (matching this service's
	// pre-email-delivery behavior). Set via WithEmailer.
	emailer              aws.EmailClient
	verificationBaseURL  string
	passwordResetBaseURL string
}

// ServiceOption configures optional Service dependencies.
type ServiceOption func(*Service)

// WithEmailer wires a transactional email client into the service so
// registration and password-reset flows actually deliver their tokens by
// email instead of only generating them. verificationBaseURL and
// passwordResetBaseURL are the frontend URLs the token is appended to as a
// "?token=" query parameter (see internal/config's AuthConfig).
func WithEmailer(emailer aws.EmailClient, verificationBaseURL, passwordResetBaseURL string) ServiceOption {
	return func(s *Service) {
		s.emailer = emailer
		s.verificationBaseURL = verificationBaseURL
		s.passwordResetBaseURL = passwordResetBaseURL
	}
}

// NewService creates a new auth service
func NewService(repo *Repository, tm *TokenManager, sa *StellarAuthenticator, hashCost int, opts ...ServiceOption) *Service {
	if hashCost == 0 {
		hashCost = DefaultPasswordHashCost
	}
	s := &Service{
		repository:       repo,
		tokenManager:     tm,
		stellarAuth:      sa,
		passwordHashCost: hashCost,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Register registers a new user
func (s *Service) Register(email, password, fullName, organization string) (*UserResponse, string, error) {
	// Validate email format
	if _, err := mail.ParseAddress(email); err != nil {
		return nil, "", errors.New("invalid email format")
	}

	// Check if email already exists
	exists, err := s.repository.UserExists(email)
	if err != nil {
		return nil, "", fmt.Errorf("failed to check user existence: %w", err)
	}
	if exists {
		return nil, "", errors.New("user with this email already exists")
	}

	// Hash password
	passwordHash, err := utils.HashPassword(password, s.passwordHashCost)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &User{
		ID:            uuid.New().String(),
		Email:         email,
		PasswordHash:  passwordHash,
		FullName:      fullName,
		Organization:  organization,
		Role:          "farmer",
		EmailVerified: false,
		IsActive:      true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.repository.CreateUser(user); err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Generate email verification token
	verificationToken, err := s.generateAuthToken(user.ID, "email_verification", EmailVerificationTokenTTL)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate verification token: %w", err)
	}

	s.sendVerificationEmail(user.Email, verificationToken)

	return toUserResponse(user), verificationToken, nil
}

// Login authenticates a user with email and password
func (s *Service) Login(email, password string, ipAddress, userAgent string) (*AuthResponse, error) {
	// Get user by email
	user, err := s.repository.GetUserByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return nil, errors.New("invalid email or password")
	}

	// Verify password
	if err := utils.VerifyPassword(user.PasswordHash, password); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("user account is disabled")
	}
	if !user.EmailVerified {
		return nil, ErrEmailNotVerified
	}

	// Create session and generate tokens
	return s.createSessionAndTokens(user, ipAddress, userAgent)
}

// WalletLogin authenticates a user with Stellar wallet signature
func (s *Service) WalletLogin(publicKey, signedChallenge string, ipAddress, userAgent string) (*AuthResponse, error) {
	// Verify the wallet signature
	if err := s.stellarAuth.VerifyChallengeSignature(publicKey, signedChallenge); err != nil {
		return nil, fmt.Errorf("wallet signature verification failed: %w", err)
	}

	// Find or create user by wallet address
	user, err := s.repository.GetUserByWalletAddress(publicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}

	// If user doesn't exist, create a new one (wallet-only user)
	if user == nil {
		user = &User{
			ID:            uuid.New().String(),
			Email:         publicKey + "@stellar.local", // Temporary email for wallet-only users
			WalletAddress: publicKey,
			Role:          "farmer",
			EmailVerified: false,
			IsActive:      true,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}

		if err := s.repository.CreateUser(user); err != nil {
			return nil, fmt.Errorf("failed to create wallet user: %w", err)
		}
	}

	if !user.IsActive {
		return nil, errors.New("user account is disabled")
	}
	if !user.EmailVerified {
		return nil, ErrEmailNotVerified
	}

	return s.createSessionAndTokens(user, ipAddress, userAgent)
}

// RefreshToken issues a new access token using a refresh token
func (s *Service) RefreshToken(refreshToken string) (*TokenResponse, error) {
	// Validate refresh token
	claims, err := s.tokenManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Extract user ID from claims
	userID, ok := claims["user_id"].(string)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	// Get user
	user, err := s.repository.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return nil, errors.New("user not found")
	}
	if !user.IsActive {
		return nil, errors.New("user account is disabled")
	}
	if !user.EmailVerified {
		return nil, ErrEmailNotVerified
	}

	// Get user permissions
	permissions, err := s.getUserPermissions(user.Role)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve permissions: %w", err)
	}

	// Generate new access token
	accessToken, err := s.tokenManager.GenerateAccessToken(user, permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	return &TokenResponse{
		AccessToken: accessToken,
		ExpiresIn:   int64(s.tokenManager.AccessTokenExpiry.Seconds()),
		TokenType:   "Bearer",
	}, nil
}

// ChangePassword changes a user's password
func (s *Service) ChangePassword(userID, currentPassword, newPassword string) error {
	// Get user
	user, err := s.repository.GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return errors.New("user not found")
	}

	// Verify current password
	if err := utils.VerifyPassword(user.PasswordHash, currentPassword); err != nil {
		return errors.New("current password is incorrect")
	}

	// Hash new password
	newHash, err := utils.HashPassword(newPassword, s.passwordHashCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	user.PasswordHash = newHash
	user.UpdatedAt = time.Now()

	if err := s.repository.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Revoke all sessions
	if err := s.repository.RevokeUserSessions(userID); err != nil {
		return fmt.Errorf("failed to revoke sessions: %w", err)
	}

	return nil
}

// RequestPasswordReset sends a password reset token
func (s *Service) RequestPasswordReset(email string) (string, error) {
	user, err := s.repository.GetUserByEmail(email)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		// For security, don't reveal if email exists
		return "", nil
	}

	// Generate reset token
	resetToken, err := s.generateAuthToken(user.ID, "password_reset", PasswordResetTokenTTL)
	if err != nil {
		return "", fmt.Errorf("failed to generate reset token: %w", err)
	}

	s.sendPasswordResetEmail(user.Email, resetToken)

	return resetToken, nil
}

// ResetPassword resets a user's password using a reset token
func (s *Service) ResetPassword(token, newPassword string) error {
	// Get auth token
	authToken, err := s.repository.GetAuthToken(token)
	if err != nil {
		return fmt.Errorf("failed to retrieve token: %w", err)
	}

	if authToken == nil {
		return errors.New("invalid or expired reset token")
	}

	if authToken.TokenType != "password_reset" {
		return errors.New("invalid token type")
	}

	// Get user
	user, err := s.repository.GetUserByID(authToken.UserID)
	if err != nil {
		return fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return errors.New("user not found")
	}

	// Hash new password
	newHash, err := utils.HashPassword(newPassword, s.passwordHashCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	user.PasswordHash = newHash
	user.UpdatedAt = time.Now()

	if err := s.repository.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	if err := s.repository.MarkAuthTokenAsUsed(authToken.ID); err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	// Revoke all sessions
	if err := s.repository.RevokeUserSessions(user.ID); err != nil {
		return fmt.Errorf("failed to revoke sessions: %w", err)
	}

	return nil
}

// VerifyEmail verifies a user's email
func (s *Service) VerifyEmail(token string) error {
	// Get auth token
	authToken, err := s.repository.GetAuthToken(token)
	if err != nil {
		return fmt.Errorf("failed to retrieve token: %w", err)
	}

	if authToken == nil {
		return errors.New("invalid or expired verification token")
	}

	if authToken.TokenType != "email_verification" {
		return errors.New("invalid token type")
	}
	if !authToken.ExpiresAt.After(time.Now()) {
		return errors.New("verification token expired")
	}

	// Get user
	user, err := s.repository.GetUserByID(authToken.UserID)
	if err != nil {
		return fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return errors.New("user not found")
	}

	// Update email verified
	user.EmailVerified = true
	user.UpdatedAt = time.Now()

	if err := s.repository.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Mark token as used
	if err := s.repository.MarkAuthTokenAsUsed(authToken.ID); err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	return nil
}

// ResendVerification creates a fresh 24-hour verification token for an existing user.
// It intentionally returns no indication of whether the email exists.
func (s *Service) ResendVerification(email string) (string, error) {
	user, err := s.repository.GetUserByEmail(email)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve user: %w", err)
	}
	if user == nil || user.EmailVerified {
		return "", nil
	}

	if latest, err := s.repository.GetLatestAuthToken(user.ID, "email_verification"); err != nil {
		return "", fmt.Errorf("failed to retrieve verification token: %w", err)
	} else if latest != nil && latest.ExpiresAt.After(time.Now()) {
		return "", nil
	}

	token, err := s.generateAuthToken(user.ID, "email_verification", EmailVerificationTokenTTL)
	if err != nil {
		return "", err
	}

	s.sendVerificationEmail(user.Email, token)

	return token, nil
}

// GetUserProfile retrieves a user's profile
func (s *Service) GetUserProfile(userID string) (*UserResponse, error) {
	user, err := s.repository.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return nil, errors.New("user not found")
	}

	return toUserResponse(user), nil
}

// UpdateUserProfile updates a user's profile
func (s *Service) UpdateUserProfile(userID string, fullName, organization string) (*UserResponse, error) {
	user, err := s.repository.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return nil, errors.New("user not found")
	}

	if fullName != "" {
		user.FullName = fullName
	}
	if organization != "" {
		user.Organization = organization
	}
	user.UpdatedAt = time.Now()

	if err := s.repository.UpdateUser(user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return toUserResponse(user), nil
}

// Logout revokes a user's session
func (s *Service) Logout(sessionID string, accessToken string) error {
	// Revoke the session
	if err := s.repository.RevokeSession(sessionID); err != nil {
		return fmt.Errorf("failed to revoke session: %w", err)
	}

	// Blacklist the access token
	if err := s.tokenManager.RevokeToken(accessToken); err != nil {
		return fmt.Errorf("failed to revoke token: %w", err)
	}

	return nil
}

// Helper methods

func (s *Service) createSessionAndTokens(user *User, ipAddress, userAgent string) (*AuthResponse, error) {
	// Get user permissions
	permissions, err := s.getUserPermissions(user.Role)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve permissions: %w", err)
	}

	// Generate token pair
	tokenResp, err := s.tokenManager.GenerateTokenPair(user, permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Extract JTI from tokens to store in session
	// In a real implementation, you would properly extract JTI from JWT tokens
	accessJTI := uuid.New().String()
	refreshJTI := uuid.New().String()

	// Create session
	session := &UserSession{
		ID:             uuid.New().String(),
		UserID:         user.ID,
		AccessTokenID:  accessJTI,
		RefreshTokenID: refreshJTI,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
		ExpiresAt:      time.Now().Add(s.tokenManager.AccessTokenExpiry),
		IsRevoked:      false,
		CreatedAt:      time.Now(),
	}

	if err := s.repository.CreateSession(session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Update last login
	if err := s.repository.UpdateUserLastLogin(user.ID); err != nil {
		return nil, fmt.Errorf("failed to update last login: %w", err)
	}

	return &AuthResponse{
		User:         toUserResponse(user),
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresIn:    tokenResp.ExpiresIn,
	}, nil
}

func (s *Service) generateAuthToken(userID, tokenType string, expiry time.Duration) (string, error) {
	if expiry == 0 {
		expiry = EmailVerificationTokenTTL
	}

	// Generate random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}

	tokenStr := hex.EncodeToString(tokenBytes)

	// Store in database
	authToken := &AuthToken{
		ID:        uuid.New().String(),
		Token:     tokenStr,
		UserID:    userID,
		TokenType: tokenType,
		ExpiresAt: time.Now().Add(expiry),
		Used:      false,
		CreatedAt: time.Now(),
	}

	if err := s.repository.CreateAuthToken(authToken); err != nil {
		return "", fmt.Errorf("failed to store auth token: %w", err)
	}

	return tokenStr, nil
}

// sendVerificationEmail emails a freshly generated verification token, if
// an emailer is configured. A send failure is logged, not returned: the
// token is already stored and valid, so a transient SES hiccup shouldn't
// fail registration/resend — the caller can request another resend.
func (s *Service) sendVerificationEmail(toEmail, token string) {
	link := buildTokenLink(s.verificationBaseURL, token)
	if s.emailer == nil {
		// No SES client configured (e.g. local dev without SES_FROM_ADDRESS
		// set): log the link instead of silently discarding it. Never
		// returned over HTTP — see internal/auth/handler.go.
		log.Printf("auth: no emailer configured; verification link for %s: %s", toEmail, link)
		return
	}
	subject, htmlBody, textBody := aws.RenderVerificationEmail(link, EmailVerificationTokenTTL)
	if err := s.emailer.SendEmail(context.Background(), toEmail, subject, htmlBody, textBody); err != nil {
		log.Printf("auth: failed to send verification email to %s: %v", toEmail, err)
	}
}

// sendPasswordResetEmail emails a freshly generated password-reset token,
// if an emailer is configured. Like sendVerificationEmail, a send failure
// is logged rather than propagated.
func (s *Service) sendPasswordResetEmail(toEmail, token string) {
	link := buildTokenLink(s.passwordResetBaseURL, token)
	if s.emailer == nil {
		log.Printf("auth: no emailer configured; password reset link for %s: %s", toEmail, link)
		return
	}
	subject, htmlBody, textBody := aws.RenderPasswordResetEmail(link, PasswordResetTokenTTL)
	if err := s.emailer.SendEmail(context.Background(), toEmail, subject, htmlBody, textBody); err != nil {
		log.Printf("auth: failed to send password reset email to %s: %v", toEmail, err)
	}
}

// buildTokenLink appends a "token" query parameter to baseURL, handling
// baseURL both with and without a pre-existing query string.
func buildTokenLink(baseURL, token string) string {
	separator := "?"
	if strings.Contains(baseURL, "?") {
		separator = "&"
	}
	return fmt.Sprintf("%s%stoken=%s", baseURL, separator, token)
}

func (s *Service) getUserPermissions(role string) ([]string, error) {
	rolePerms, err := s.repository.GetRolePermissions(role)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve role permissions: %w", err)
	}

	if rolePerms == nil {
		return []string{}, nil
	}

	return []string(rolePerms.Permissions), nil
}

var ErrEmailNotVerified = errors.New("email not verified")

func toUserResponse(user *User) *UserResponse {
	return &UserResponse{
		ID:                   user.ID,
		Email:                user.Email,
		FullName:             user.FullName,
		Organization:         user.Organization,
		Role:                 user.Role,
		EmailVerified:        user.EmailVerified,
		VerificationRequired: !user.EmailVerified,
		IsActive:             user.IsActive,
		WalletAddress:        user.WalletAddress,
		LastLoginAt:          user.LastLoginAt,
		CreatedAt:            user.CreatedAt,
	}
}
