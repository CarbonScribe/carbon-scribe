package auth

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// Repository handles data access for auth entities
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new auth repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateUser creates a new user in the database
func (r *Repository) CreateUser(user *User) error {
	return r.db.Create(user).Error
}

// GetUserByID retrieves a user by ID
func (r *Repository) GetUserByID(id string) (*User, error) {
	var user User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (r *Repository) GetUserByEmail(email string) (*User, error) {
	var user User
	if err := r.db.First(&user, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetUserByWalletAddress retrieves a user by wallet address
func (r *Repository) GetUserByWalletAddress(walletAddress string) (*User, error) {
	var user User
	if err := r.db.First(&user, "wallet_address = ?", walletAddress).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates a user's information
func (r *Repository) UpdateUser(user *User) error {
	return r.db.Model(user).Updates(user).Error
}

// UpdateUserLastLogin updates the last login timestamp for a user
func (r *Repository) UpdateUserLastLogin(userID string) error {
	return r.db.Model(&User{}).Where("id = ?", userID).Update("last_login_at", time.Now()).Error
}

// DeleteUser soft deletes a user (sets is_active to false)
func (r *Repository) DeleteUser(userID string) error {
	return r.db.Model(&User{}).Where("id = ?", userID).Update("is_active", false).Error
}

// CreateSession creates a new user session
func (r *Repository) CreateSession(session *UserSession) error {
	return r.db.Create(session).Error
}

// GetSessionByAccessTokenID retrieves a session by access token ID
func (r *Repository) GetSessionByAccessTokenID(tokenID string) (*UserSession, error) {
	var session UserSession
	if err := r.db.First(&session, "access_token_id = ? AND is_revoked = false", tokenID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &session, nil
}

// RevokeSession revokes a session by marking it as revoked
func (r *Repository) RevokeSession(sessionID string) error {
	return r.db.Model(&UserSession{}).Where("id = ?", sessionID).Update("is_revoked", true).Error
}

// RevokeUserSessions revokes all sessions for a user
func (r *Repository) RevokeUserSessions(userID string) error {
	return r.db.Model(&UserSession{}).Where("user_id = ?", userID).Update("is_revoked", true).Error
}

// DeleteExpiredSessions deletes expired sessions
func (r *Repository) DeleteExpiredSessions() error {
	return r.db.Where("expires_at < ?", time.Now()).Delete(&UserSession{}).Error
}

// CreateAuthToken creates a new auth token (for email verification or password reset)
func (r *Repository) CreateAuthToken(token *AuthToken) error {
	return r.db.Create(token).Error
}

// GetAuthToken retrieves an active auth token by token string.
func (r *Repository) GetAuthToken(tokenStr string) (*AuthToken, error) {
	var token AuthToken
	if err := r.db.First(&token, "token = ? AND used = false", tokenStr).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &token, nil
}

// GetLatestAuthToken retrieves the newest token of a given type for a user.
func (r *Repository) GetLatestAuthToken(userID, tokenType string) (*AuthToken, error) {
	var token AuthToken
	if err := r.db.Where("user_id = ? AND token_type = ? AND used = false", userID, tokenType).
		Order("created_at DESC").First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &token, nil
}

// MarkAuthTokenAsUsed marks an auth token as used
func (r *Repository) MarkAuthTokenAsUsed(tokenID string) error {
	now := time.Now()
	return r.db.Model(&AuthToken{}).Where("id = ?", tokenID).Updates(map[string]interface{}{
		"used":    true,
		"used_at": now,
	}).Error
}

// GetRolePermissions retrieves permissions for a role
func (r *Repository) GetRolePermissions(role string) (*RolePermission, error) {
	var rolePerms RolePermission
	if err := r.db.First(&rolePerms, "role = ?", role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rolePerms, nil
}

// CreateUserWallet creates a new wallet association for a user
func (r *Repository) CreateUserWallet(wallet *UserWallet) error {
	return r.db.Create(wallet).Error
}

// GetUserWallets retrieves all wallets for a user
func (r *Repository) GetUserWallets(userID string) ([]UserWallet, error) {
	var wallets []UserWallet
	if err := r.db.Where("user_id = ?", userID).Find(&wallets).Error; err != nil {
		return nil, err
	}
	return wallets, nil
}

// GetUserWalletByAddress retrieves a wallet by address
func (r *Repository) GetUserWalletByAddress(address string) (*UserWallet, error) {
	var wallet UserWallet
	if err := r.db.First(&wallet, "wallet_address = ?", address).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &wallet, nil
}

// UpdateUserWallet updates a wallet's information
func (r *Repository) UpdateUserWallet(wallet *UserWallet) error {
	return r.db.Model(wallet).Updates(wallet).Error
}

// GetActiveSession retrieves an active session that hasn't expired
func (r *Repository) GetActiveSession(sessionID string) (*UserSession, error) {
	var session UserSession
	if err := r.db.First(&session, "id = ? AND is_revoked = false AND expires_at > ?", sessionID, time.Now()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &session, nil
}

// UserExists checks if user exists by email
func (r *Repository) UserExists(email string) (bool, error) {
	var count int64
	if err := r.db.Model(&User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
