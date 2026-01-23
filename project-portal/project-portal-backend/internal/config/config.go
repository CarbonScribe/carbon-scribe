package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all application configuration
type Config struct {
	Database DatabaseConfig
	Server   ServerConfig
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	PostgresURL             string
	PingConnectionOnStartup bool
}

// ServerConfig holds server configuration
type ServerConfig struct {
	Port            string
	Mode            string
	ShutdownTimeout time.Duration
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Database: DatabaseConfig{
			PostgresURL:             getEnv("DATABASE_URL", ""),
			PingConnectionOnStartup: getBoolEnv("DATABASE_PING_CONNECTION_ON_STARTUP", false),
		},
		Server: ServerConfig{
			Port:            getEnv("SERVER_PORT", "8080"),
			Mode:            getEnv("SERVER_MODE", "release"),
			ShutdownTimeout: getDurationEnv("SERVER_SHUTDOWN_TIMEOUT", 30*time.Second),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return strings.TrimSpace(value)
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		value = strings.TrimSpace(value)
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		value = strings.TrimSpace(value)
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		value = strings.TrimSpace(value)
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}
