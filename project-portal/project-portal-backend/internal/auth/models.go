package auth

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/lib/pq"
)

// User represents a user account in the system
type User struct {
	ID            string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Email         string     `json:"email" gorm:"uniqueIndex;type:varchar(255);not null"`
	PasswordHash  string     `json:"-" gorm:"type:varchar(255)"`
	WalletAddress string     `json:"wallet_address,omitempty" gorm:"type:varchar(56);uniqueIndex:,where:wallet_address IS NOT NULL"`
	FullName      string     `json:"full_name" gorm:"type:varchar(255)"`
	Organization  string     `json:"organization" gorm:"type:varchar(255)"`
	Role          string     `json:"role" gorm:"type:varchar(50);default:'farmer';index"`
	EmailVerified bool       `json:"email_verified" gorm:"default:false"`
	IsActive      bool       `json:"is_active" gorm:"default:true"`
	LastLoginAt   *time.Time `json:"last_login_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time  `json:"updated_at" gorm:"autoUpdateTime"`

	// Relations
	Sessions []UserSession `json:"-" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Wallets  []UserWallet  `json:"-" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
}

// UserSession represents a user session
type UserSession struct {
	ID             string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	UserID         string    `json:"user_id" gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE"`
	AccessTokenID  string    `json:"access_token_id" gorm:"type:varchar(100);uniqueIndex;not null"`
	RefreshTokenID string    `json:"refresh_token_id" gorm:"type:varchar(100);uniqueIndex;not null"`
	IPAddress      string    `json:"ip_address" gorm:"type:inet"`
	UserAgent      string    `json:"user_agent" gorm:"type:text"`
	ExpiresAt      time.Time `json:"expires_at" gorm:"not null;index"`
	IsRevoked      bool      `json:"is_revoked" gorm:"default:false"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// UserWallet represents a wallet associated with a user
type UserWallet struct {
	ID            string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	UserID        string     `json:"user_id" gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE"`
	WalletAddress string     `json:"wallet_address" gorm:"type:varchar(56);uniqueIndex;not null"`
	WalletType    string     `json:"wallet_type" gorm:"type:varchar(50);default:'stellar'"`
	IsPrimary     bool       `json:"is_primary" gorm:"default:false"`
	Verified      bool       `json:"verified" gorm:"default:false"`
	VerifiedAt    *time.Time `json:"verified_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at" gorm:"autoCreateTime"`
}

// AuthToken represents email verification and password reset tokens
type AuthToken struct {
	ID        string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Token     string     `json:"-" gorm:"type:varchar(255);uniqueIndex;not null"`
	UserID    string     `json:"user_id" gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE"`
	TokenType string     `json:"token_type" gorm:"type:varchar(50);not null;index"`
	ExpiresAt time.Time  `json:"expires_at" gorm:"not null"`
	Used      bool       `json:"used" gorm:"default:false"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at" gorm:"autoCreateTime"`
}

// RolePermission represents role-based access control permissions
type RolePermission struct {
	Role        string      `json:"role" gorm:"primaryKey;type:varchar(50)"`
	Permissions Permissions `json:"permissions" gorm:"type:jsonb;default:'[]'"`
	Description string      `json:"description" gorm:"type:text"`
	CreatedAt   time.Time   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time   `json:"updated_at" gorm:"autoUpdateTime"`
}

// Permissions is a custom type for storing permission arrays in PostgreSQL
type Permissions pq.StringArray

// Value implements the driver.Valuer interface
func (p Permissions) Value() (driver.Value, error) {
	if p == nil {
		return pq.StringArray{}, nil
	}
	return pq.StringArray(p).Value()
}

// Scan implements the sql.Scanner interface
func (p *Permissions) Scan(value interface{}) error {
	var arr pq.StringArray
	if err := arr.Scan(value); err != nil {
		return err
	}
	*p = Permissions(arr)
	return nil
}

// MarshalJSON for JSON marshaling
func (p Permissions) MarshalJSON() ([]byte, error) {
	return json.Marshal(pq.StringArray(p))
}

// UnmarshalJSON for JSON unmarshaling
func (p *Permissions) UnmarshalJSON(data []byte) error {
	var arr pq.StringArray
	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}
	*p = Permissions(arr)
	return nil
}

// Claims represents JWT token claims
type Claims struct {
	UserID        string      `json:"user_id"`
	Email         string      `json:"email"`
	Role          string      `json:"role"`
	Permissions   Permissions `json:"permissions"`
	WalletAddress string      `json:"wallet_address,omitempty"`
	JTI           string      `json:"jti"`        // JWT ID for token tracking
	TokenType     string      `json:"token_type"` // "access" or "refresh"
	IssuedAt      int64       `json:"iat"`        // Issued at timestamp
	ExpiresAt     int64       `json:"exp"`        // Expiration timestamp
}

// Request/Response DTOs

// ResendVerificationRequest represents a request to resend an email verification link.
type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
	FullName     string `json:"full_name" binding:"required"`
	Organization string `json:"organization"`
}

// LoginRequest represents an email/password login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// WalletLoginRequest represents a Stellar wallet login request
type WalletLoginRequest struct {
	PublicKey       string `json:"public_key" binding:"required"`
	SignedChallenge string `json:"signed_challenge" binding:"required"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// VerifyEmailRequest represents an email verification request
type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// RequestPasswordResetRequest represents a password reset request
type RequestPasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordRequest represents a password reset confirmation
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// UpdateProfileRequest represents a profile update request
type UpdateProfileRequest struct {
	FullName     string `json:"full_name"`
	Organization string `json:"organization"`
}

// AuthResponse represents successful authentication response
type AuthResponse struct {
	User         *UserResponse `json:"user"`
	AccessToken  string        `json:"access_token"`
	RefreshToken string        `json:"refresh_token"`
	ExpiresIn    int64         `json:"expires_in"`
}

// UserResponse represents user data in responses
type UserResponse struct {
	ID                   string     `json:"id"`
	Email                string     `json:"email"`
	FullName             string     `json:"full_name"`
	Organization         string     `json:"organization"`
	Role                 string     `json:"role"`
	EmailVerified        bool       `json:"email_verified"`
	VerificationRequired bool       `json:"verification_required"`
	IsActive             bool       `json:"is_active"`
	WalletAddress        string     `json:"wallet_address,omitempty"`
	LastLoginAt          *time.Time `json:"last_login_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
}

// TokenResponse represents a token response
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}
