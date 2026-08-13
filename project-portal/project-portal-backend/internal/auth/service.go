package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/utils"

	"github.com/google/uuid"
)

// Service handles business logic for authentication
type Service struct {
	repository       *Repository
	tokenManager     *TokenManager
	stellarAuth      *StellarAuthenticator
	passwordHashCost int
}

// NewService creates a new auth service
func NewService(repo *Repository, tm *TokenManager, sa *StellarAuthenticator, hashCost int) *Service {
	if hashCost == 0 {
		hashCost = 12
	}
	return &Service{
		repository:       repo,
		tokenManager:     tm,
		stellarAuth:      sa,
		passwordHashCost: hashCost,
	}
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
		IsActive:      false, // pending email verification — cannot log in until verified (#470)
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.repository.CreateUser(user); err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Generate email verification token
	verificationToken, err := s.generateAuthToken(user.ID, "email_verification", 24*time.Hour)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate verification token: %w", err)
	}

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

	// Reject unverified users — they must confirm email ownership before login (#470)
	if !user.EmailVerified {
		return nil, errors.New("email not verified — please check your inbox for the verification link")
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("user account is disabled")
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
	resetToken, err := s.generateAuthToken(user.ID, "password_reset", 1*time.Hour)
	if err != nil {
		return "", fmt.Errorf("failed to generate reset token: %w", err)
	}

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

	// Get user
	user, err := s.repository.GetUserByID(authToken.UserID)
	if err != nil {
		return fmt.Errorf("failed to retrieve user: %w", err)
	}

	if user == nil {
		return errors.New("user not found")
	}

	// Update email verified and activate the account
	user.EmailVerified = true
	user.IsActive = true
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
		expiry = 24 * time.Hour
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

func toUserResponse(user *User) *UserResponse {
	return &UserResponse{
		ID:            user.ID,
		Email:         user.Email,
		FullName:      user.FullName,
		Organization:  user.Organization,
		Role:          user.Role,
		EmailVerified: user.EmailVerified,
		IsActive:      user.IsActive,
		WalletAddress: user.WalletAddress,
		LastLoginAt:   user.LastLoginAt,
		CreatedAt:     user.CreatedAt,
	}
}
