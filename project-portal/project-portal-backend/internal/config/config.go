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
	Elasticsearch ElasticsearchConfig
	AWS           AWSConfig
	Storage       StorageConfig
	Geospatial    GeospatialConfig
	Settings      SettingsConfig
	Auth          AuthConfig
	Redis         RedisConfig
	Soroban       SorobanConfig
	Notifications NotificationsConfig
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

type SorobanConfig struct {
	RPCURL              string
	NetworkPassphrase   string
	CarbonAssetContract string
	InventoryCacheTTL   string
}

type NotificationsConfig struct {
	MongoURI          string
	MongoDatabase     string
	MongoEnabled      bool
	ReconnectQueueMax int
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
		Port:        port,
		DatabaseURL: databaseURL,
		Debug:       debug,
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
		Soroban: SorobanConfig{
			RPCURL:              getEnvOrDefault("SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org"),
			NetworkPassphrase:   getEnvOrDefault("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),
			CarbonAssetContract: getEnvOrDefault("CARBON_ASSET_CONTRACT_ID", "CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM"),
			InventoryCacheTTL:   getEnvOrDefault("INVENTORY_CACHE_TTL", "5m"),
		},
		Notifications: NotificationsConfig{
			MongoURI:          getEnvOrDefault("NOTIFICATIONS_MONGO_URI", "mongodb://localhost:27017"),
			MongoDatabase:     getEnvOrDefault("NOTIFICATIONS_MONGO_DB", "carbon_scribe_notifications"),
			MongoEnabled:      getEnvOrDefault("NOTIFICATIONS_STORAGE", "mongo") == "mongo",
			ReconnectQueueMax: getIntOrDefault("NOTIFICATIONS_RECONNECT_QUEUE_MAX", 100),
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
