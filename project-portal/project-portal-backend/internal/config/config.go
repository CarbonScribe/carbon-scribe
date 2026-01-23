package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config represents the application configuration
type Config struct {
	Server     ServerConfig     `json:"server"`
	Database   DatabaseConfig   `json:"database"`
	Stellar    StellarConfig    `json:"stellar"`
	Payments   PaymentsConfig   `json:"payments"`
	Financing  FinancingConfig  `json:"financing"`
	Security   SecurityConfig   `json:"security"`
	Logging    LoggingConfig    `json:"logging"`
	Monitoring MonitoringConfig `json:"monitoring"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	Host         string        `json:"host"`
	Port         int           `json:"port"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Host           string        `json:"host"`
	Port           int           `json:"port"`
	User           string        `json:"user"`
	Password       string        `json:"password"`
	DBName         string        `json:"db_name"`
	SSLMode        string        `json:"ssl_mode"`
	MaxConnections int           `json:"max_connections"`
	MaxIdleConns   int           `json:"max_idle_conns"`
	MaxLifetime    time.Duration `json:"max_lifetime"`
	MigrationsPath string        `json:"migrations_path"`
}

// StellarConfig - simplified for validation
type StellarConfig struct {
	IssuerAccount IssuerAccountConfig `json:"issuer_account"`
}

type IssuerAccountConfig struct {
	SecretKey string `json:"secret_key"`
}

// PaymentsConfig - placeholder
type PaymentsConfig struct {
	Stripe StripeConfig `json:"stripe"`
	PayPal PayPalConfig `json:"paypal"`
}

type StripeConfig struct {
	SecretKey string `json:"secret_key"`
}

type PayPalConfig struct {
	ClientSecret string `json:"client_secret"`
}

// SecurityConfig
type SecurityConfig struct {
	JWTSecret string `json:"jwt_secret"`
}

// LoggingConfig
type LoggingConfig struct {
	Level string `json:"level"`
}

// MonitoringConfig
type MonitoringConfig struct{}

// FinancingConfig
type FinancingConfig struct{}

// LoadConfig loads configuration from file and environment variables
func LoadConfig(configPath string) (*Config, error) {
	// Default config
	config := &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Database: DatabaseConfig{
			Host:    "localhost",
			Port:    5432,
			User:    os.Getenv("USER"),
			DBName:  "carbonscribe_portal",
			SSLMode: "disable",
		},
	}

	// Load from file if exists
	if configPath != "" {
		if data, err := os.ReadFile(configPath); err == nil {
			if err := json.Unmarshal(data, config); err != nil {
				return nil, fmt.Errorf("failed to parse config file: %w", err)
			}
		}
	}

	// Override with environment variables
	overrideWithEnv(config)

	return config, nil
}

func overrideWithEnv(config *Config) {
	if host := os.Getenv("SERVER_HOST"); host != "" {
		config.Server.Host = host
	}
	if port := os.Getenv("SERVER_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.Server.Port = p
		}
	}
	// Add other overrides as needed
	if dbHost := os.Getenv("DATABASE_HOST"); dbHost != "" {
		config.Database.Host = dbHost
	}
	if dbUser := os.Getenv("DATABASE_USER"); dbUser != "" {
		config.Database.User = dbUser
	}
	if dbPass := os.Getenv("DATABASE_PASSWORD"); dbPass != "" {
		config.Database.Password = dbPass
	}
	if dbName := os.Getenv("DATABASE_DBNAME"); dbName != "" {
		config.Database.DBName = dbName
	}
}

// GetDatabaseURL returns the database connection string
func (c *DatabaseConfig) GetDatabaseURL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode)
}

// GetServerAddr returns the server address
func (c *ServerConfig) GetServerAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
