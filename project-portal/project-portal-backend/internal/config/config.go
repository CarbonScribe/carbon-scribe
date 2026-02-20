package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds application configuration
type Config struct {
	Port          string
	DatabaseURL   string
	Debug         bool
	Elasticsearch ElasticsearchConfig
}

// ElasticsearchConfig holds configuration for Elasticsearch
type ElasticsearchConfig struct {
	Addresses []string
	Username  string
	Password  string
	CloudID   string
	APIKey    string
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
	}, nil
}
