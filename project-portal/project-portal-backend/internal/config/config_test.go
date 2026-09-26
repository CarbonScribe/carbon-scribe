package config

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// validEncryptionKeyHex is a 32-byte AES key encoded as hex (64 characters).
const validEncryptionKeyHex = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"

// validProductionConfig returns a Config that passes Validate in production
// mode. Individual tests mutate the fields they care about.
func validProductionConfig() *Config {
	return &Config{
		DatabaseURL: "postgres://app_rw:s3cr3t-password@db.internal:5432/carbonscribe?sslmode=require",
		Debug:       false,
		Auth: AuthConfig{
			JWTSecret: strings.Repeat("a", MinJWTSecretLength),
		},
		Settings: SettingsConfig{
			EncryptionKeyHex: validEncryptionKeyHex,
		},
		Notifications: NotificationsConfig{
			SMSProvider: "mock",
		},
	}
}

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name        string
		mutate      func(*Config)
		wantErr     bool
		errContains []string
	}{
		{
			name:   "fully valid production config passes",
			mutate: func(*Config) {},
		},
		{
			name: "development mode allows the documented defaults",
			mutate: func(c *Config) {
				c.Debug = true
				c.Auth.JWTSecret = DefaultJWTSecret
				c.Settings.EncryptionKeyHex = ""
			},
		},
		{
			name: "missing JWT secret is rejected",
			mutate: func(c *Config) {
				c.Auth.JWTSecret = ""
			},
			wantErr:     true,
			errContains: []string{"JWT_SECRET", "must be set"},
		},
		{
			name: "default JWT secret is rejected in production",
			mutate: func(c *Config) {
				c.Auth.JWTSecret = DefaultJWTSecret
			},
			wantErr:     true,
			errContains: []string{"JWT_SECRET", "insecure default"},
		},
		{
			name: "short JWT secret is rejected",
			mutate: func(c *Config) {
				c.Auth.JWTSecret = "too-short"
			},
			wantErr:     true,
			errContains: []string{"JWT_SECRET", "at least"},
		},
		{
			name: "missing settings encryption key is rejected",
			mutate: func(c *Config) {
				c.Settings.EncryptionKeyHex = ""
			},
			wantErr:     true,
			errContains: []string{"SETTINGS_ENCRYPTION_KEY_HEX", "must be set"},
		},
		{
			name: "malformed settings encryption key is rejected",
			mutate: func(c *Config) {
				c.Settings.EncryptionKeyHex = "not-hex"
			},
			wantErr:     true,
			errContains: []string{"SETTINGS_ENCRYPTION_KEY_HEX", "valid hex"},
		},
		{
			name: "wrong-length settings encryption key is rejected",
			mutate: func(c *Config) {
				c.Settings.EncryptionKeyHex = "0011223344556677" // 8 bytes, not a valid AES key
			},
			wantErr:     true,
			errContains: []string{"SETTINGS_ENCRYPTION_KEY_HEX", "16, 24 or 32-byte"},
		},
		{
			name: "empty database URL is rejected",
			mutate: func(c *Config) {
				c.DatabaseURL = ""
			},
			wantErr:     true,
			errContains: []string{"DATABASE_URL"},
		},
		{
			name: "placeholder database URL is rejected",
			mutate: func(c *Config) {
				c.DatabaseURL = "postgres://user:password@localhost:5432/carbonscribe?sslmode=disable"
			},
			wantErr:     true,
			errContains: []string{"DATABASE_URL", "placeholder"},
		},
		{
			name: "twilio provider without credentials is rejected",
			mutate: func(c *Config) {
				c.Notifications.SMSProvider = "twilio"
			},
			wantErr:     true,
			errContains: []string{"TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"},
		},
		{
			name: "twilio provider with credentials passes",
			mutate: func(c *Config) {
				c.Notifications.SMSProvider = "twilio"
				c.Notifications.TwilioAccountSID = "AC123"
				c.Notifications.TwilioAuthToken = "token"
				c.Notifications.TwilioFromNumber = "+15550000000"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := validProductionConfig()
			tt.mutate(cfg)

			err := cfg.Validate()
			if !tt.wantErr {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			for _, want := range tt.errContains {
				require.ErrorContains(t, err, want)
			}
		})
	}
}

// TestLoad_ProductionDefaultsFailValidation verifies the end-to-end path: with
// no JWT_SECRET in the environment, Load falls back to the documented default
// and Validate then refuses to start.
func TestLoad_ProductionDefaultsFailValidation(t *testing.T) {
	t.Setenv("DEBUG", "false")
	t.Setenv("SERVER_MODE", "production")
	t.Setenv("DATABASE_URL", "postgres://app_rw:s3cr3t-password@db.internal:5432/carbonscribe?sslmode=require")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SETTINGS_ENCRYPTION_KEY_HEX", validEncryptionKeyHex)

	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, DefaultJWTSecret, cfg.Auth.JWTSecret)
	require.ErrorContains(t, cfg.Validate(), "JWT_SECRET")
}

// TestLoad_ValidProductionSecretsPassValidation is the happy path: every
// enforced secret is present and non-default.
func TestLoad_ValidProductionSecretsPassValidation(t *testing.T) {
	t.Setenv("DEBUG", "false")
	t.Setenv("SERVER_MODE", "production")
	t.Setenv("DATABASE_URL", "postgres://app_rw:s3cr3t-password@db.internal:5432/carbonscribe?sslmode=require")
	t.Setenv("JWT_SECRET", strings.Repeat("b", MinJWTSecretLength))
	t.Setenv("SETTINGS_ENCRYPTION_KEY_HEX", validEncryptionKeyHex)

	cfg, err := Load()
	require.NoError(t, err)
	require.NoError(t, cfg.Validate())
}

// TestLoad_DevelopmentDefaultsPassValidation confirms local development can
// still boot with the documented defaults.
func TestLoad_DevelopmentDefaultsPassValidation(t *testing.T) {
	t.Setenv("DEBUG", "true")
	t.Setenv("SERVER_MODE", "development")
	t.Setenv("DATABASE_URL", "postgres://user:password@localhost:5432/carbonscribe?sslmode=disable")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SETTINGS_ENCRYPTION_KEY_HEX", "")

	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, DefaultJWTSecret, cfg.Auth.JWTSecret)
	require.NoError(t, cfg.Validate())
}
