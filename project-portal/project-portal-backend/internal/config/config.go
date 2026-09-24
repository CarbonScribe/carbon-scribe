package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds application configuration
type Config struct {
	Port          string
	DatabaseURL   string
	Debug         bool
	SeedDevUsers  bool
	Elasticsearch ElasticsearchConfig
	AWS           AWSConfig
	Storage       StorageConfig
	Geospatial    GeospatialConfig
	Settings      SettingsConfig
	Auth          AuthConfig
	Redis         RedisConfig
	RateLimit     RateLimitConfig
	Soroban       SorobanConfig
	Notifications NotificationsConfig
	MQTT          MQTTConfig
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
	APIKeyPrefix     string
	ProfileCDNBase   string
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
	LoginMaxRequests          int    // attempts per window (default: 5)
	LoginWindowSeconds        int    // window in seconds (default: 900 — 15 min)
	RegisterMaxRequests       int    // default: 3
	RegisterWindowSeconds     int    // default: 3600 — 1 hour
	RefreshMaxRequests        int    // default: 10
	RefreshWindowSeconds      int    // default: 3600 — 1 hour
	ForgotPasswordMaxRequests int    // default: 3
	ForgotPasswordWindowSecs  int    // default: 3600 — 1 hour
	WalletChallengeMax        int    // default: 5
	WalletChallengeWindowSecs int    // default: 60 — 1 min
	// Minting / payment endpoints
	MintMaxRequests     int // default: 10
	MintWindowSeconds   int // default: 60
	PaymentMaxRequests  int // default: 5
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
		Port:         port,
		DatabaseURL:  databaseURL,
		Debug:        debug,
		SeedDevUsers: seedDevUsers,
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
			EncryptionKeyHex: os.Getenv("SETTINGS_ENCRYPTION_KEY_HEX"),
			APIKeyPrefix:     getEnvOrDefault("SETTINGS_API_KEY_PREFIX", "ppk_live"),
			ProfileCDNBase:   getEnvOrDefault("SETTINGS_PROFILE_CDN_BASE", "https://cdn.carbonscribe.local"),
		},
		Auth: AuthConfig{
			JWTSecret:                getEnvOrDefault("JWT_SECRET", "your-secret-key-change-in-production"),
			JWTAccessTokenExpiry:     getEnvOrDefault("JWT_ACCESS_TOKEN_EXPIRY", "15m"),
			JWTRefreshTokenExpiry:    getEnvOrDefault("JWT_REFRESH_TOKEN_EXPIRY", "7d"),
			PasswordHashCost:         passwordHashCost,
			EmailVerificationURL:     getEnvOrDefault("EMAIL_VERIFICATION_URL", "https://app.carbonscribe.local/verify-email"),
			PasswordResetURL:         getEnvOrDefault("PASSWORD_RESET_URL", "https://app.carbonscribe.local/reset-password"),
			StellarNetworkPassphrase: getEnvOrDefault("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),
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
			RPCURL:              getEnvOrDefault("SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org"),
			NetworkPassphrase:   getEnvOrDefault("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),
			CarbonAssetContract: getEnvOrDefault("CARBON_ASSET_CONTRACT_ID", "CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM"),
			InventoryCacheTTL:   getEnvOrDefault("INVENTORY_CACHE_TTL", "5m"),
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
	}, nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
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
