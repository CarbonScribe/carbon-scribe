package config

import (
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	// DefaultJWTSecret is the historical hardcoded fallback for JWT_SECRET.
	// It is convenient for local development but publishes the key that signs
	// every session token, so Validate rejects it outside development. Kept in
	// sync with the fallback used in Load.
	DefaultJWTSecret = "your-secret-key-change-in-production"

	// MinJWTSecretLength is the minimum accepted JWT secret length outside
	// development. HMAC-backed tokens should use at least a 256-bit key; using
	// characters here is a proxy for entropy in the common case.
	MinJWTSecretLength = 32

	// DefaultSorobanTestnetRPCURL and DefaultTestnetPassphrase (#794) are the
	// single source of the Soroban testnet defaults, applied only in
	// development/test mode (see Load) — minting/tokenization no longer
	// declare their own copies of these.
	DefaultSorobanTestnetRPCURL = "https://soroban-testnet.stellar.org:443"
	DefaultTestnetPassphrase    = "Test SDF Network ; September 2015"
)

// insecureDatabaseMarkers are substrings that only appear in the documented
// example/placeholder database URLs. Their presence in a non-development
// deployment means the real credentials were never configured.
var insecureDatabaseMarkers = []string{
	"your_secure_password_here",
	"your_password",
	"change_in_production",
	"user:password@",
}

// Config holds application configuration
type Config struct {
	Port         string
	DatabaseURL  string
	Debug        bool
	SeedDevUsers bool
	// MaxRequestBodyBytes is the default request body size limit applied to
	// every route (#797), configurable via MAX_REQUEST_BODY_BYTES.
	MaxRequestBodyBytes int64
	// MaxWebhookBodyBytes is the tighter limit applied specifically to the
	// incoming-webhook endpoint (#797), configurable via
	// MAX_WEBHOOK_BODY_BYTES — unauthenticated callers can reach it, so it
	// is deliberately much smaller than the general default.
	MaxWebhookBodyBytes int64
	Elasticsearch       ElasticsearchConfig
	AWS                 AWSConfig
	Storage             StorageConfig
	Geospatial          GeospatialConfig
	Settings            SettingsConfig
	Auth                AuthConfig
	Redis               RedisConfig
	RateLimit           RateLimitConfig
	Soroban             SorobanConfig
	Notifications       NotificationsConfig
	MQTT                MQTTConfig
	SES                 SESConfig
	Monitoring          MonitoringConfig
	Minting             MintingConfig
}

// MonitoringConfig holds monitoring-module settings.
type MonitoringConfig struct {
	SLA SLAConfig
}

// SLAConfig holds the SLA thresholds the performance analytics service
// benchmarks observed monitoring data against. A zero threshold means
// "not configured": that metric is reported but not judged, so an unset SLA
// can never manufacture a breach.
type SLAConfig struct {
	// Latency ceilings, in milliseconds.
	LatencyP50Ms float64
	LatencyP95Ms float64
	LatencyP99Ms float64
	// MaxErrorRate is a ceiling expressed as a fraction in [0,1] (0.01 = 1%).
	MaxErrorRate float64
	// MinUptime is a floor expressed as a fraction in [0,1] (0.999 = 99.9%).
	MinUptime float64
	// Names of the stored metrics the observed latency and error rate are
	// read from.
	LatencyMetricName   string
	ErrorRateMetricName string
}

// MintingConfig holds the retry policy for Soroban carbon-credit minting.
// Backoff grows exponentially from BaseBackoff, doubling per attempt, capped
// at MaxBackoff, with jitter applied to each delay.
type MintingConfig struct {
	MaxAttempts int
	BaseBackoff time.Duration
	MaxBackoff  time.Duration
	// JitterFactor is the fraction of the computed delay that is randomised,
	// in [0,1]. 0.2 means the actual delay lands in [0.8d, 1.0d].
	JitterFactor float64
}

// ElasticsearchConfig holds configuration for Elasticsearch
type ElasticsearchConfig struct {
	Addresses []string
	Username  string
	Password  string
	CloudID   string
	APIKey    string
}

// AWSConfig holds AWS credentials and region.
type AWSConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string // optional: LocalStack / MinIO override
}

// StorageConfig holds document storage settings.
type StorageConfig struct {
	S3BucketName    string
	MaxUploadSizeMB int64
	IPFSEnabled     bool
	IPFSNodeURL     string
}

type SettingsConfig struct {
	EncryptionKeyHex string
	// EncryptionKeyVersion is the version recorded against ciphertext
	// produced with EncryptionKeyHex. Bump it (and move the old value into
	// PreviousEncryptionKeysHex) when rotating the key (#795).
	EncryptionKeyVersion int
	// PreviousEncryptionKeysHex maps version -> hex key for versions no
	// longer current but still needed to decrypt/rotate rows written before
	// the last rotation.
	PreviousEncryptionKeysHex map[int]string
	APIKeyPrefix              string
	ProfileCDNBase            string
}

// SESConfig holds configuration for the SES transactional email client.
// AWS credentials/region/endpoint are shared with AWSConfig; the client is
// only constructed (see cmd/api/main.go) when FromAddress is set.
type SESConfig struct {
	FromAddress string // verified SES sender identity, e.g. "no-reply@carbonscribe.io"
}

type GeospatialConfig struct {
	DefaultProvider   string
	MapboxAccessToken string
	GoogleMapsAPIKey  string
	TileCacheTTL      string
}

type AuthConfig struct {
	JWTSecret                string
	JWTAccessTokenExpiry     string
	JWTRefreshTokenExpiry    string
	PasswordHashCost         int
	EmailVerificationURL     string
	PasswordResetURL         string
	StellarNetworkPassphrase string
	MaxLoginAttempts         int
	LockoutDuration          time.Duration
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// RateLimitConfig holds per-route rate limiting configuration.
type RateLimitConfig struct {
	// Auth endpoints
	LoginMaxRequests          int // attempts per window (default: 5)
	LoginWindowSeconds        int // window in seconds (default: 900 — 15 min)
	RegisterMaxRequests       int // default: 3
	RegisterWindowSeconds     int // default: 3600 — 1 hour
	RefreshMaxRequests        int // default: 10
	RefreshWindowSeconds      int // default: 3600 — 1 hour
	ForgotPasswordMaxRequests int // default: 3
	ForgotPasswordWindowSecs  int // default: 3600 — 1 hour
	WalletChallengeMax        int // default: 5
	WalletChallengeWindowSecs int // default: 60 — 1 min
	// Minting / payment endpoints
	MintMaxRequests      int // default: 10
	MintWindowSeconds    int // default: 60
	PaymentMaxRequests   int // default: 5
	PaymentWindowSeconds int // default: 60
	// Whitelist (comma-separated CIDRs or IPs that bypass rate limiting)
	IPWhitelist string
	// Graduated cooldown: lock duration multiplier after N consecutive violations
	GraduatedCooldownEnabled     bool
	GraduatedCooldownThreshold   int // violations before cooldown doubles (default: 3)
	GraduatedCooldownBaseSeconds int // initial lock extension in seconds (default: 60)
}

type SorobanConfig struct {
	RPCURL              string
	NetworkPassphrase   string
	CarbonAssetContract string
	InventoryCacheTTL   string
}

// MQTTConfig holds configuration for the IoT telemetry MQTT client.
// The client is only started (see cmd/api/main.go) when BrokerURL is set.
type MQTTConfig struct {
	BrokerURL             string // e.g. "tls://broker.example.com:8883" or "tcp://localhost:1883"
	ClientID              string
	Username              string
	Password              string
	TLSCACertFile         string // optional custom CA for verifying the broker
	TLSCertFile           string // client certificate, for mutual TLS
	TLSKeyFile            string // client private key, for mutual TLS
	TLSInsecureSkipVerify bool   // dev-only; never enable in production
	QoS                   int
	QueueSize             int
	Workers               int
}

type NotificationsConfig struct {
	MongoURI          string
	MongoDatabase     string
	MongoEnabled      bool
	ReconnectQueueMax int
	SMSProvider       string
	AWSSNSSenderID    string
	TwilioAccountSID  string
	TwilioAuthToken   string
	TwilioFromNumber  string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	debug := os.Getenv("DEBUG") == "true" || os.Getenv("SERVER_MODE") == "development"
	seedDevUsers := getEnvOrDefault("SEED_DEV_USERS", "true") == "true"

	// Soroban RPC URL / network passphrase (#794): no testnet fallback is
	// applied here when unset — only in development/test mode, with a
	// warning, since a silent fallback in production is exactly how a real
	// deployment ends up minting against testnet without anyone noticing.
	// Validate() refuses to start in production when either is empty.
	sorobanRPCURL := os.Getenv("SOROBAN_RPC_URL")
	sorobanNetworkPassphrase := os.Getenv("STELLAR_NETWORK_PASSPHRASE")
	if debug {
		if sorobanRPCURL == "" {
			log.Println("⚠️  SOROBAN_RPC_URL not set — defaulting to Soroban testnet (development mode only)")
			sorobanRPCURL = DefaultSorobanTestnetRPCURL
		}
		if sorobanNetworkPassphrase == "" {
			log.Println("⚠️  STELLAR_NETWORK_PASSPHRASE not set — defaulting to the testnet passphrase (development mode only)")
			sorobanNetworkPassphrase = DefaultTestnetPassphrase
		}
	}

	esAddresses := os.Getenv("ELASTICSEARCH_ADDRESSES")
	if esAddresses == "" {
		esAddresses = "http://localhost:9200"
	}

	maxUpload, _ := strconv.ParseInt(os.Getenv("MAX_UPLOAD_SIZE_MB"), 10, 64)
	if maxUpload <= 0 {
		maxUpload = 100
	}

	passwordHashCost := 12
	if cost := os.Getenv("PASSWORD_HASH_COST"); cost != "" {
		if parsedCost, err := strconv.Atoi(cost); err == nil && parsedCost > 0 {
			passwordHashCost = parsedCost
		}
	}

	redisDBAbc := 0
	if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
		if parsedDB, err := strconv.Atoi(dbStr); err == nil {
			redisDBAbc = parsedDB
		}
	}

	return &Config{
		Port:                port,
		DatabaseURL:         databaseURL,
		Debug:               debug,
		SeedDevUsers:        seedDevUsers,
		MaxRequestBodyBytes: getInt64OrDefault("MAX_REQUEST_BODY_BYTES", 1<<20),  // 1 MiB
		MaxWebhookBodyBytes: getInt64OrDefault("MAX_WEBHOOK_BODY_BYTES", 64<<10), // 64 KiB
		Elasticsearch: ElasticsearchConfig{
			Addresses: strings.Split(esAddresses, ","),
			Username:  os.Getenv("ELASTICSEARCH_USERNAME"),
			Password:  os.Getenv("ELASTICSEARCH_PASSWORD"),
			CloudID:   os.Getenv("ELASTICSEARCH_CLOUD_ID"),
			APIKey:    os.Getenv("ELASTICSEARCH_API_KEY"),
		},
		AWS: AWSConfig{
			Region:          getEnvOrDefault("AWS_REGION", "us-east-1"),
			AccessKeyID:     os.Getenv("AWS_ACCESS_KEY_ID"),
			SecretAccessKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
			Endpoint:        os.Getenv("AWS_ENDPOINT_URL"), // for LocalStack
		},
		Storage: StorageConfig{
			S3BucketName:    getEnvOrDefault("S3_BUCKET_NAME", "carbon-scribe-documents"),
			MaxUploadSizeMB: maxUpload,
			IPFSEnabled:     os.Getenv("IPFS_ENABLED") == "true",
			IPFSNodeURL:     getEnvOrDefault("IPFS_NODE_URL", "http://localhost:5001"),
		},
		Geospatial: GeospatialConfig{
			DefaultProvider:   getEnvOrDefault("MAPS_DEFAULT_PROVIDER", "mapbox"),
			MapboxAccessToken: os.Getenv("MAPS_MAPBOX_ACCESS_TOKEN"),
			GoogleMapsAPIKey:  os.Getenv("MAPS_GOOGLE_MAPS_API_KEY"),
			TileCacheTTL:      getEnvOrDefault("MAPS_TILE_CACHE_TTL", "24h"),
		},
		Settings: SettingsConfig{
			EncryptionKeyHex:          os.Getenv("SETTINGS_ENCRYPTION_KEY_HEX"),
			EncryptionKeyVersion:      getIntOrDefault("SETTINGS_ENCRYPTION_KEY_VERSION", 1),
			PreviousEncryptionKeysHex: parseVersionedKeys(os.Getenv("SETTINGS_ENCRYPTION_PREVIOUS_KEYS")),
			APIKeyPrefix:              getEnvOrDefault("SETTINGS_API_KEY_PREFIX", "ppk_live"),
			ProfileCDNBase:            getEnvOrDefault("SETTINGS_PROFILE_CDN_BASE", "https://cdn.carbonscribe.local"),
		},
		Auth: AuthConfig{
			JWTSecret:                getEnvOrDefault("JWT_SECRET", DefaultJWTSecret),
			JWTAccessTokenExpiry:     getEnvOrDefault("JWT_ACCESS_TOKEN_EXPIRY", "15m"),
			JWTRefreshTokenExpiry:    getEnvOrDefault("JWT_REFRESH_TOKEN_EXPIRY", "7d"),
			PasswordHashCost:         passwordHashCost,
			EmailVerificationURL:     getEnvOrDefault("EMAIL_VERIFICATION_URL", "https://app.carbonscribe.local/verify-email"),
			PasswordResetURL:         getEnvOrDefault("PASSWORD_RESET_URL", "https://app.carbonscribe.local/reset-password"),
			StellarNetworkPassphrase: getEnvOrDefault("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),
			MaxLoginAttempts:         getIntOrDefault("AUTH_MAX_LOGIN_ATTEMPTS", 5),
			LockoutDuration:          getDurationOrDefault("AUTH_LOCKOUT_DURATION", time.Duration(getIntOrDefault("AUTH_LOCKOUT_DURATION_SECS", 900))*time.Second),
		},
		Redis: RedisConfig{
			Host:     getEnvOrDefault("REDIS_HOST", "localhost"),
			Port:     getEnvOrDefault("REDIS_PORT", "6379"),
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       redisDBAbc,
		},
		RateLimit: RateLimitConfig{
			// Auth limits
			LoginMaxRequests:          getIntOrDefault("RATE_LIMIT_LOGIN_MAX", 5),
			LoginWindowSeconds:        getIntOrDefault("RATE_LIMIT_LOGIN_WINDOW_SECS", 900),
			RegisterMaxRequests:       getIntOrDefault("RATE_LIMIT_REGISTER_MAX", 3),
			RegisterWindowSeconds:     getIntOrDefault("RATE_LIMIT_REGISTER_WINDOW_SECS", 3600),
			RefreshMaxRequests:        getIntOrDefault("RATE_LIMIT_REFRESH_MAX", 10),
			RefreshWindowSeconds:      getIntOrDefault("RATE_LIMIT_REFRESH_WINDOW_SECS", 3600),
			ForgotPasswordMaxRequests: getIntOrDefault("RATE_LIMIT_FORGOT_PASSWORD_MAX", 3),
			ForgotPasswordWindowSecs:  getIntOrDefault("RATE_LIMIT_FORGOT_PASSWORD_WINDOW_SECS", 3600),
			WalletChallengeMax:        getIntOrDefault("RATE_LIMIT_WALLET_CHALLENGE_MAX", 5),
			WalletChallengeWindowSecs: getIntOrDefault("RATE_LIMIT_WALLET_CHALLENGE_WINDOW_SECS", 60),
			// Minting / payment limits
			MintMaxRequests:      getIntOrDefault("RATE_LIMIT_MINT_MAX", 10),
			MintWindowSeconds:    getIntOrDefault("RATE_LIMIT_MINT_WINDOW_SECS", 60),
			PaymentMaxRequests:   getIntOrDefault("RATE_LIMIT_PAYMENT_MAX", 5),
			PaymentWindowSeconds: getIntOrDefault("RATE_LIMIT_PAYMENT_WINDOW_SECS", 60),
			// Whitelist and graduated cooldown
			IPWhitelist:                  os.Getenv("RATE_LIMIT_IP_WHITELIST"),
			GraduatedCooldownEnabled:     getEnvOrDefault("RATE_LIMIT_GRADUATED_COOLDOWN", "true") == "true",
			GraduatedCooldownThreshold:   getIntOrDefault("RATE_LIMIT_COOLDOWN_THRESHOLD", 3),
			GraduatedCooldownBaseSeconds: getIntOrDefault("RATE_LIMIT_COOLDOWN_BASE_SECS", 60),
		},
		Soroban: SorobanConfig{
			RPCURL:              sorobanRPCURL,
			NetworkPassphrase:   sorobanNetworkPassphrase,
			CarbonAssetContract: getEnvOrDefault("CARBON_ASSET_CONTRACT_ID", "CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM"),
			InventoryCacheTTL:   getEnvOrDefault("INVENTORY_CACHE_TTL", "5m"),
		},
		SES: SESConfig{
			FromAddress: os.Getenv("SES_FROM_ADDRESS"),
		},
		MQTT: MQTTConfig{
			BrokerURL:             os.Getenv("MQTT_BROKER_URL"),
			ClientID:              os.Getenv("MQTT_CLIENT_ID"),
			Username:              os.Getenv("MQTT_USERNAME"),
			Password:              os.Getenv("MQTT_PASSWORD"),
			TLSCACertFile:         os.Getenv("MQTT_TLS_CA_CERT_FILE"),
			TLSCertFile:           os.Getenv("MQTT_TLS_CERT_FILE"),
			TLSKeyFile:            os.Getenv("MQTT_TLS_KEY_FILE"),
			TLSInsecureSkipVerify: os.Getenv("MQTT_TLS_INSECURE_SKIP_VERIFY") == "true",
			QoS:                   getIntOrDefault("MQTT_QOS", 1),
			QueueSize:             getIntOrDefault("MQTT_QUEUE_SIZE", 1000),
			Workers:               getIntOrDefault("MQTT_WORKERS", 4),
		},
		Notifications: NotificationsConfig{
			MongoURI:          getEnvOrDefault("NOTIFICATIONS_MONGO_URI", "mongodb://localhost:27017"),
			MongoDatabase:     getEnvOrDefault("NOTIFICATIONS_MONGO_DB", "carbon_scribe_notifications"),
			MongoEnabled:      getEnvOrDefault("NOTIFICATIONS_STORAGE", "mongo") == "mongo",
			ReconnectQueueMax: getIntOrDefault("NOTIFICATIONS_RECONNECT_QUEUE_MAX", 100),
			SMSProvider:       getEnvOrDefault("SMS_PROVIDER", "mock"),
			AWSSNSSenderID:    getEnvOrDefault("AWS_SNS_SMS_SENDER_ID", "CarbonScribe"),
			TwilioAccountSID:  os.Getenv("TWILIO_ACCOUNT_SID"),
			TwilioAuthToken:   os.Getenv("TWILIO_AUTH_TOKEN"),
			TwilioFromNumber:  os.Getenv("TWILIO_FROM_NUMBER"),
		},
		Monitoring: MonitoringConfig{
			SLA: SLAConfig{
				LatencyP50Ms:        getFloatOrDefault("SLA_LATENCY_P50_MS", 100),
				LatencyP95Ms:        getFloatOrDefault("SLA_LATENCY_P95_MS", 300),
				LatencyP99Ms:        getFloatOrDefault("SLA_LATENCY_P99_MS", 750),
				MaxErrorRate:        getFloatOrDefault("SLA_MAX_ERROR_RATE", 0.01),
				MinUptime:           getFloatOrDefault("SLA_MIN_UPTIME", 0.99),
				LatencyMetricName:   getEnvOrDefault("SLA_LATENCY_METRIC", "api_request_latency_ms"),
				ErrorRateMetricName: getEnvOrDefault("SLA_ERROR_RATE_METRIC", "api_error_rate"),
			},
		},
		Minting: MintingConfig{
			MaxAttempts:  getIntOrDefault("MINTING_MAX_ATTEMPTS", 3),
			BaseBackoff:  getDurationOrDefault("MINTING_BACKOFF_BASE", 2*time.Second),
			MaxBackoff:   getDurationOrDefault("MINTING_BACKOFF_MAX", 60*time.Second),
			JitterFactor: getFloatOrDefault("MINTING_BACKOFF_JITTER", 0.2),
		},
	}, nil
}

// Validate checks that security-critical configuration is present and is not
// left at an insecure default. It is intended to be called once at startup,
// immediately after Load, so a misconfigured deployment fails fast instead of
// booting with a publicly-known secret and only failing at the first request
// that needs it.
//
// Development mode (SERVER_MODE=development or DEBUG=true) keeps the
// documented defaults for local convenience. Every other mode fails closed:
// an unset SERVER_MODE is treated as production, mirroring the minting client
// check in cmd/api/main.go.
func (c *Config) Validate() error {
	if c.Debug {
		return nil
	}

	var problems []string

	// JWT signing secret — signs every session token.
	switch {
	case strings.TrimSpace(c.Auth.JWTSecret) == "":
		problems = append(problems, "JWT_SECRET must be set: it signs every session token")
	case c.Auth.JWTSecret == DefaultJWTSecret:
		problems = append(problems, fmt.Sprintf("JWT_SECRET is still the documented insecure default (%q); set a unique random value", DefaultJWTSecret))
	case len(c.Auth.JWTSecret) < MinJWTSecretLength:
		problems = append(problems, fmt.Sprintf("JWT_SECRET must be at least %d characters to resist brute-forcing", MinJWTSecretLength))
	}

	// Settings encryption key — encrypts stored integration credentials.
	if err := validateEncryptionKey(c.Settings.EncryptionKeyHex); err != nil {
		problems = append(problems, fmt.Sprintf("SETTINGS_ENCRYPTION_KEY_HEX %v", err))
	}

	// Soroban RPC URL / network passphrase (#794) — minting silently
	// defaulting to testnet in production is exactly the failure mode this
	// guards against; Load only applies that default in development mode.
	if strings.TrimSpace(c.Soroban.RPCURL) == "" {
		problems = append(problems, "SOROBAN_RPC_URL must be set in production — there is no testnet fallback outside development mode")
	}
	if strings.TrimSpace(c.Soroban.NetworkPassphrase) == "" {
		problems = append(problems, "STELLAR_NETWORK_PASSPHRASE must be set in production — there is no testnet fallback outside development mode")
	}

	// Database connection string.
	if strings.TrimSpace(c.DatabaseURL) == "" {
		problems = append(problems, "DATABASE_URL must be set")
	} else if marker := findInsecureDatabaseMarker(c.DatabaseURL); marker != "" {
		problems = append(problems, fmt.Sprintf("DATABASE_URL still contains the placeholder %q; set the real database credentials", marker))
	}

	// SMS credentials are only required when a real provider is selected, so a
	// mock/default deployment is never blocked by unrelated settings.
	if strings.EqualFold(strings.TrimSpace(c.Notifications.SMSProvider), "twilio") {
		requiredSMSFields := []struct {
			name  string
			value string
		}{
			{"TWILIO_ACCOUNT_SID", c.Notifications.TwilioAccountSID},
			{"TWILIO_AUTH_TOKEN", c.Notifications.TwilioAuthToken},
			{"TWILIO_FROM_NUMBER", c.Notifications.TwilioFromNumber},
		}
		for _, field := range requiredSMSFields {
			if strings.TrimSpace(field.value) == "" {
				problems = append(problems, fmt.Sprintf("%s is required when SMS_PROVIDER=twilio", field.name))
			}
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("invalid configuration — refusing to start:\n  - %s", strings.Join(problems, "\n  - "))
	}
	return nil
}

// validateEncryptionKey ensures SETTINGS_ENCRYPTION_KEY_HEX is a usable AES
// key. The settings vault accepts 16, 24 or 32-byte keys, i.e. 32, 48 or 64
// hex characters. An empty key is rejected outside development because
// settings.NewService otherwise silently falls back to a hardcoded dev key.
func validateEncryptionKey(hexKey string) error {
	trimmed := strings.TrimSpace(hexKey)
	if trimmed == "" {
		return fmt.Errorf("must be set to a random 32-byte key encoded as 64 hex characters")
	}
	decoded, err := hex.DecodeString(trimmed)
	if err != nil {
		return fmt.Errorf("must be valid hex: %v", err)
	}
	switch len(decoded) {
	case 16, 24, 32:
		return nil
	default:
		return fmt.Errorf("must decode to a 16, 24 or 32-byte AES key (got %d bytes)", len(decoded))
	}
}

// findInsecureDatabaseMarker returns the first placeholder marker found in the
// database URL, or the empty string when none are present.
func findInsecureDatabaseMarker(databaseURL string) string {
	lower := strings.ToLower(databaseURL)
	for _, marker := range insecureDatabaseMarkers {
		if strings.Contains(lower, marker) {
			return marker
		}
	}
	return ""
}

// parseVersionedKeys parses "version:hexkey,version:hexkey" into a map, for
// previous encryption key versions still needed to decrypt or rotate rows
// written before the last key rotation (#795). Malformed entries are
// skipped rather than failing startup — a typo in an optional, rarely-used
// rotation variable shouldn't block the whole service from booting.
func parseVersionedKeys(raw string) map[int]string {
	result := map[int]string{}
	if strings.TrimSpace(raw) == "" {
		return result
	}
	for part := range strings.SplitSeq(raw, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), ":", 2)
		if len(kv) != 2 {
			continue
		}
		version, err := strconv.Atoi(strings.TrimSpace(kv[0]))
		if err != nil {
			continue
		}
		result[version] = strings.TrimSpace(kv[1])
	}
	return result
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// getInt64OrDefault reads an int64 from the environment (used for byte-size
// limits, #797), falling back to defaultVal when unset, unparsable, or not
// strictly positive — a zero or negative body limit would either reject
// every request or disable enforcement entirely, neither of which is a sane
// override.
func getInt64OrDefault(key string, defaultVal int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	parsed, err := strconv.ParseInt(v, 10, 64)
	if err != nil || parsed <= 0 {
		return defaultVal
	}
	return parsed
}

func getIntOrDefault(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return parsed
}

// getFloatOrDefault reads a float64 from the environment, falling back to
// defaultVal when unset or unparsable.
func getFloatOrDefault(key string, defaultVal float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	parsed, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return defaultVal
	}
	return parsed
}

// getDurationOrDefault reads a Go duration string (e.g. "2s", "500ms") from
// the environment, falling back to defaultVal when unset or unparsable.
func getDurationOrDefault(key string, defaultVal time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	parsed, err := time.ParseDuration(v)
	if err != nil {
		return defaultVal
	}
	return parsed
}
