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

type GeospatialConfig struct {
	DefaultProvider   string
	MapboxAccessToken string
	GoogleMapsAPIKey  string
	TileCacheTTL      string
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
	}, nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
