package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// Config represents the application configuration
type Config struct {
	Server     ServerConfig     `json:"server"`
	Database   DatabaseConfig   `json:"database"`
	Stellar    StellarConfig    `json:"stellar"`
	Payments  PaymentsConfig  `json:"payments"`
	Financing  FinancingConfig  `json:"financing"`
	Security   SecurityConfig   `json:"security"`
	Logging    LoggingConfig    `json:"logging"`
	Monitoring MonitoringConfig `json:"monitoring"`
	Documents  DocumentsConfig  `json:"documents"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	Host         string        `json:"host"`
	Port         int           `json:"port"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
	TLS          TLSConfig     `json:"tls"`
}

// TLSConfig represents TLS configuration
type TLSConfig struct {
	Enabled  bool   `json:"enabled"`
	CertFile string `json:"cert_file"`
	KeyFile  string `json:"key_file"`
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Host            string        `json:"host"`
	Port            int           `json:"port"`
	User            string        `json:"user"`
	Password        string        `json:"password"`
	DBName          string        `json:"db_name"`
	SSLMode         string        `json:"ssl_mode"`
	MaxConnections  int           `json:"max_connections"`
	MaxIdleConns   int           `json:"max_idle_conns"`
	MaxLifetime     time.Duration `json:"max_lifetime"`
	MigrationsPath  string        `json:"migrations_path"`
}

// StellarConfig represents Stellar blockchain configuration
type StellarConfig struct {
	NetworkType      string `json:"network_type"`      // testnet, public
	HorizonURL       string `json:"horizon_url"`
	SorobanURL       string `json:"soroban_url"`
	NetworkPassphrase string `json:"network_passphrase"`
	IssuerAccount    IssuerAccountConfig `json:"issuer_account"`
	Contracts        map[string]string `json:"contracts"` // contract IDs by type
}

// IssuerAccountConfig represents Stellar issuer account configuration
type IssuerAccountConfig struct {
	PublicKey string `json:"public_key"`
	SecretKey string `json:"secret_key"`
	AccountID string `json:"account_id"`
}

// PaymentsConfig represents payment processor configuration
type PaymentsConfig struct {
	Stripe      StripeConfig      `json:"stripe"`
	PayPal      PayPalConfig      `json:"paypal"`
	M_Pesa      M_PesaConfig      `json:"m_pesa"`
	BankTransfer BankTransferConfig `json:"bank_transfer"`
	Default     string            `json:"default_provider"`
	Webhooks    WebhookConfig     `json:"webhooks"`
}

// WebhookConfig represents webhook configuration
type WebhookConfig struct {
	Secret    string `json:"secret"`
	Endpoint  string `json:"endpoint"`
	RetryPolicy RetryPolicyConfig `json:"retry_policy"`
}

// RetryPolicyConfig represents retry policy for webhooks
type RetryPolicyConfig struct {
	MaxRetries    int           `json:"max_retries"`
	RetryDelay    time.Duration `json:"retry_delay"`
	BackoffFactor float64       `json:"backoff_factor"`
}

// FinancingConfig represents financing service configuration
type FinancingConfig struct {
	CreditCalculation CreditCalculationConfig `json:"credit_calculation"`
	TokenMinting     TokenMintingConfig     `json:"token_minting"`
	ForwardSales     ForwardSalesConfig     `json:"forward_sales"`
	Auctions         AuctionsConfig         `json:"auctions"`
	RevenueDistribution RevenueDistributionConfig `json:"revenue_distribution"`
	Pricing          PricingConfig          `json:"pricing"`
}

// CreditCalculationConfig represents credit calculation configuration
type CreditCalculationConfig struct {
	DefaultMethodology string        `json:"default_methodology"`
	QualityThreshold  float64       `json:"quality_threshold"`
	MinMonitoringPeriod time.Duration `json:"min_monitoring_period"`
	ValidationRules   map[string]bool `json:"validation_rules"`
}

// TokenMintingConfig represents token minting configuration
type TokenMintingConfig struct {
	MaxBatchSize        int           `json:"max_batch_size"`
	MaxRetries          int           `json:"max_retries"`
	RetryDelay          time.Duration `json:"retry_delay"`
	ConfirmationTimeout  time.Duration `json:"confirmation_timeout"`
	GasOptimization     bool          `json:"gas_optimization"`
	AutoMinting        bool          `json:"auto_minting"`
}

// ForwardSalesConfig represents forward sales configuration
type ForwardSalesConfig struct {
	MinDepositPercent      float64 `json:"min_deposit_percent"`
	MaxDepositPercent      float64 `json:"max_deposit_percent"`
	DefaultDepositPercent  float64 `json:"default_deposit_percent"`
	MinDeliveryDays       int     `json:"min_delivery_days"`
	MaxDeliveryDays       int     `json:"max_delivery_days"`
	ContractValidityDays  int     `json:"contract_validity_days"`
	AutoCancelDays        int     `json:"auto_cancel_days"`
	PriceAdjustmentRate   float64 `json:"price_adjustment_rate"`
}

// AuctionsConfig represents auctions configuration
type AuctionsConfig struct {
	MinBidIncrement      float64 `json:"min_bid_increment"`
	MaxBidIncrement      float64 `json:"max_bid_increment"`
	DefaultBidIncrement  float64 `json:"default_bid_increment"`
	MinReservePrice      float64 `json:"min_reserve_price"`
	MaxReservePrice      float64 `json:"max_reserve_price"`
	DefaultReservePrice  float64 `json:"default_reserve_price"`
	AutoExtendMinutes     int     `json:"auto_extend_minutes"`
	BidDepositPercent    float64 `json:"bid_deposit_percent"`
	MaxActiveAuctions    int     `json:"max_active_auctions"`
	AuctionDurationHours  int     `json:"auction_duration_hours"`
}

// RevenueDistributionConfig represents revenue distribution configuration
type RevenueDistributionConfig struct {
	DefaultPlatformFee    float64 `json:"default_platform_fee"`
	MinPlatformFee        float64 `json:"min_platform_fee"`
	MaxPlatformFee        float64 `json:"max_platform_fee"`
	MinDistributionAmount  float64 `json:"min_distribution_amount"`
	MaxBatchSize           int     `json:"max_batch_size"`
	PaymentTimeoutMinutes  int     `json:"payment_timeout_minutes"`
	RetryAttempts          int     `json:"retry_attempts"`
	RetryDelayMinutes      int     `json:"retry_delay_minutes"`
	AutoApproveThreshold   float64 `json:"auto_approve_threshold"`
	TaxRates              map[string]TaxRateConfig `json:"tax_rates"`
}

// TaxRateConfig represents tax rate configuration
type TaxRateConfig struct {
	Country        string  `json:"country"`
	IncomeTax      float64 `json:"income_tax"`
	WithholdingTax float64 `json:"withholding_tax"`
	VAT            float64 `json:"vat"`
	OtherTaxes     float64 `json:"other_taxes"`
}

// PricingConfig represents pricing configuration
type PricingConfig struct {
	DefaultBasePrice      float64 `json:"default_base_price"`
	PriceVarianceLimit    float64 `json:"price_variance_limit"`
	MinPrice              float64 `json:"min_price"`
	MaxPrice              float64 `json:"max_price"`
	QualityWeight         float64 `json:"quality_weight"`
	VintageWeight         float64 `json:"vintage_weight"`
	RegionWeight          float64 `json:"region_weight"`
	MarketWeight          float64 `json:"market_weight"`
	OracleWeight          float64 `json:"oracle_weight"`
	PriceUpdateInterval   time.Duration `json:"price_update_interval"`
	Oracles              []OracleConfig `json:"oracles"`
}

// OracleConfig represents price oracle configuration
type OracleConfig struct {
	Name         string  `json:"name"`
	Endpoint     string  `json:"endpoint"`
	APIKey       string  `json:"api_key"`
	Reliability   float64 `json:"reliability"`
	Timeout       time.Duration `json:"timeout"`
	RetryPolicy  RetryPolicyConfig `json:"retry_policy"`
}

// SecurityConfig represents security configuration
type SecurityConfig struct {
	JWTSecret         string        `json:"jwt_secret"`
	TokenExpiration   time.Duration `json:"token_expiration"`
	RefreshExpiration time.Duration `json:"refresh_expiration"`
	RateLimiting      RateLimitConfig `json:"rate_limiting"`
	CORS              CORSConfig     `json:"cors"`
	Encryption        EncryptionConfig `json:"encryption"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	Enabled bool    `json:"enabled"`
	RPS     int     `json:"requests_per_second"`
	Burst   int     `json:"burst"`
	Window  time.Duration `json:"window"`
}

// CORSConfig represents CORS configuration
type CORSConfig struct {
	AllowedOrigins []string `json:"allowed_origins"`
	AllowedMethods []string `json:"allowed_methods"`
	AllowedHeaders []string `json:"allowed_headers"`
	ExposedHeaders []string `json:"exposed_headers"`
	MaxAge         int      `json:"max_age"`
	Credentials     bool     `json:"credentials"`
}

// EncryptionConfig represents encryption configuration
type EncryptionConfig struct {
	KeyID        string `json:"key_id"`
	KeyVersion    string `json:"key_version"`
	Algorithm     string `json:"algorithm"`
	KeyRotation   time.Duration `json:"key_rotation"`
}

// LoggingConfig represents logging configuration
type LoggingConfig struct {
	Level      string `json:"level"`
	Format     string `json:"format"`
	Output     string `json:"output"`
	File       FileLogConfig `json:"file"`
	Sentry     SentryConfig `json:"sentry"`
	Metrics    MetricsConfig `json:"metrics"`
}

// FileLogConfig represents file logging configuration
type FileLogConfig struct {
	Path       string `json:"path"`
	MaxSize    int  `json:"max_size"`
	MaxBackups int  `json:"max_backups"`
	Compress   bool `json:"compress"`
}

// SentryConfig represents Sentry logging configuration
type SentryConfig struct {
	DSN        string `json:"dsn"`
	Environment string `json:"environment"`
	SampleRate float64 `json:"sample_rate"`
}

// MetricsConfig represents metrics configuration
type MetricsConfig struct {
	Enabled   bool   `json:"enabled"`
	Type      string `json:"type"`      // prometheus, influxdb
	Endpoint  string `json:"endpoint"`
	Namespace string `json:"namespace"`
	Interval  time.Duration `json:"interval"`
}

// MonitoringConfig represents monitoring configuration
type MonitoringConfig struct {
	HealthCheck HealthCheckConfig `json:"health_check"`
	Metrics    MetricsConfig     `json:"metrics"`
	Alerting   AlertingConfig   `json:"alerting"`
}

// HealthCheckConfig represents health check configuration
type HealthCheckConfig struct {
	Enabled  bool          `json:"enabled"`
	Endpoint string        `json:"endpoint"`
	Checks   []CheckConfig `json:"checks"`
}

// CheckConfig represents individual health check configuration
type CheckConfig struct {
	Name     string        `json:"name"`
	Type     string        `json:"type"`
	Target   string        `json:"target"`
	Timeout  time.Duration `json:"timeout"`
	Interval time.Duration `json:"interval"`
}

// AlertingConfig represents alerting configuration
type AlertingConfig struct {
	Enabled   bool              `json:"enabled"`
	Providers []AlertProviderConfig `json:"providers"`
	Rules     []AlertRuleConfig    `json:"rules"`
}

// AlertProviderConfig represents alert provider configuration
type AlertProviderConfig struct {
	Type     string            `json:"type"`
	Config   map[string]interface{} `json:"config"`
	Enabled  bool              `json:"enabled"`
}

// AlertRuleConfig represents alert rule configuration
type AlertRuleConfig struct {
	Name      string                 `json:"name"`
	Metric    string                 `json:"metric"`
	Threshold float64                `json:"threshold"`
	Operator  string                 `json:"operator"`
	Duration  time.Duration           `json:"duration"`
	Severity  string                 `json:"severity"`
	Labels    map[string]string      `json:"labels"`
	Enabled   bool                   `json:"enabled"`
}

// DocumentsConfig represents document management configuration
type DocumentsConfig struct {
	S3   S3Config   `json:"s3"`
	IPFS IPFSConfig `json:"ipfs"`
	PDF  PDFConfig  `json:"pdf"`
}

// S3Config represents AWS S3 configuration
type S3Config struct {
	Bucket    string `json:"bucket"`
	Region    string `json:"region"`
	AccessKey string `json:"access_key"`
	SecretKey string `json:"secret_key"`
}

// IPFSConfig represents IPFS configuration
type IPFSConfig struct {
	Endpoint string `json:"endpoint"`
	APIKey   string `json:"api_key"`
	Secret   string `json:"secret"`
}

// PDFConfig represents PDF generation configuration
type PDFConfig struct {
	TemplatePath string `json:"template_path"`
}


// LoadConfig loads configuration from file and environment variables
func LoadConfig(configPath string) (*Config, error) {
	// Load configuration file
	var config Config
	if configPath != "" {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		if err := json.Unmarshal(data, &config); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}
	}

	// Override with environment variables
	overrideWithEnv(&config)

	// Set defaults
	setDefaults(&config)

	// Validate configuration
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	"fmt"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Maps     MapsConfig
	Logging  LoggingConfig
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Host            string
	Port            int
	Mode            string // "development", "production"
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// MapsConfig holds mapping API configuration
type MapsConfig struct {
	MapboxAccessToken     string
	MapboxStyleURL        string
	GoogleMapsAPIKey      string
	DefaultMapProvider    string // "mapbox" or "google"
	TileCacheTTL          time.Duration
	MaxTileCacheSize      int64 // in bytes
	StaticMapWidth        int
	StaticMapHeight       int
	DefaultZoomLevel      int
	MaxConcurrentRequests int
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string // "debug", "info", "warn", "error"
	Format     string // "json", "console"
	OutputPath string
}

// Load loads configuration from environment variables and config file
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AutomaticEnv()

	// Set defaults
	setDefaults()

	// Read config file (optional)
	if err := viper.ReadInConfig(); err != nil {
		// Config file not found is ok, we'll use env vars and defaults
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	var config Config

	// Server configuration
	config.Server = ServerConfig{
		Host:            viper.GetString("server.host"),
		Port:            viper.GetInt("server.port"),
		Mode:            viper.GetString("server.mode"),
		ReadTimeout:     viper.GetDuration("server.read_timeout"),
		WriteTimeout:    viper.GetDuration("server.write_timeout"),
		ShutdownTimeout: viper.GetDuration("server.shutdown_timeout"),
	}

	// Database configuration
	config.Database = DatabaseConfig{
		Host:            viper.GetString("database.host"),
		Port:            viper.GetInt("database.port"),
		User:            viper.GetString("database.user"),
		Password:        viper.GetString("database.password"),
		DBName:          viper.GetString("database.dbname"),
		SSLMode:         viper.GetString("database.sslmode"),
		MaxOpenConns:    viper.GetInt("database.max_open_conns"),
		MaxIdleConns:    viper.GetInt("database.max_idle_conns"),
		ConnMaxLifetime: viper.GetDuration("database.conn_max_lifetime"),
	}

	// Maps configuration
	config.Maps = MapsConfig{
		MapboxAccessToken:     viper.GetString("maps.mapbox_access_token"),
		MapboxStyleURL:        viper.GetString("maps.mapbox_style_url"),
		GoogleMapsAPIKey:      viper.GetString("maps.google_maps_api_key"),
		DefaultMapProvider:    viper.GetString("maps.default_provider"),
		TileCacheTTL:          viper.GetDuration("maps.tile_cache_ttl"),
		MaxTileCacheSize:      viper.GetInt64("maps.max_tile_cache_size"),
		StaticMapWidth:        viper.GetInt("maps.static_map_width"),
		StaticMapHeight:       viper.GetInt("maps.static_map_height"),
		DefaultZoomLevel:      viper.GetInt("maps.default_zoom_level"),
		MaxConcurrentRequests: viper.GetInt("maps.max_concurrent_requests"),
	}

	// Logging configuration
	config.Logging = LoggingConfig{
		Level:      viper.GetString("logging.level"),
		Format:     viper.GetString("logging.format"),
		OutputPath: viper.GetString("logging.output_path"),
	}

	return &config, nil
}

// overrideWithEnv overrides configuration with environment variables
func overrideWithEnv(config *Config) {
	if host := os.Getenv("SERVER_HOST"); host != "" {
		config.Server.Host = host
	}
	if port := os.Getenv("SERVER_PORT"); port != "" {
		config.Server.Port = atoi(port)
	}
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		// Parse database URL and set individual fields
		parseDatabaseURL(dbURL, config)
	}
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		config.Security.JWTSecret = jwtSecret
	}
	if stellarSecret := os.Getenv("STELLAR_ISSUER_SECRET"); stellarSecret != "" {
		config.Stellar.IssuerAccount.SecretKey = stellarSecret
	}
	if stripeSecret := os.Getenv("STRIPE_SECRET_KEY"); stripeSecret != "" {
		config.Payments.Stripe.SecretKey = stripeSecret
	}
	if paypalSecret := os.Getenv("PAYPAL_CLIENT_SECRET"); paypalSecret != "" {
		config.Payments.PayPal.ClientSecret = paypalSecret
	}
}

// setDefaults sets default values for configuration
func setDefaults(config *Config) {
	// Server defaults
	if config.Server.Host == "" {
		config.Server.Host = "0.0.0.0"
	}
	if config.Server.Port == 0 {
		config.Server.Port = 8080
	}
	if config.Server.ReadTimeout == 0 {
		config.Server.ReadTimeout = 30 * time.Second
	}
	if config.Server.WriteTimeout == 0 {
		config.Server.WriteTimeout = 30 * time.Second
	}
	if config.Server.IdleTimeout == 0 {
		config.Server.IdleTimeout = 60 * time.Second
	}

	// Database defaults
	if config.Database.Host == "" {
		config.Database.Host = "localhost"
	}
	if config.Database.Port == 0 {
		config.Database.Port = 5432
	}
	if config.Database.SSLMode == "" {
		config.Database.SSLMode = "disable"
	}
	if config.Database.MaxConnections == 0 {
		config.Database.MaxConnections = 20
	}
	if config.Database.MaxIdleConns == 0 {
		config.Database.MaxIdleConns = 10
	}
	if config.Database.MaxLifetime == 0 {
		config.Database.MaxLifetime = time.Hour
	}

	// Stellar defaults
	if config.Stellar.NetworkType == "" {
		config.Stellar.NetworkType = "testnet"
	}
	if config.Stellar.HorizonURL == "" {
		config.Stellar.HorizonURL = "https://horizon-testnet.stellar.org"
	}
	if config.Stellar.SorobanURL == "" {
		config.Stellar.SorobanURL = "https://soroban-testnet.stellar.org"
	}
	if config.Stellar.NetworkPassphrase == "" {
		config.Stellar.NetworkPassphrase = "Test SDF Network ; September 2015"
	}

	// Security defaults
	if config.Security.JWTSecret == "" {
		config.Security.JWTSecret = "default-secret-change-in-production"
	}
	if config.Security.TokenExpiration == 0 {
		config.Security.TokenExpiration = 24 * time.Hour
	}
	if config.Security.RefreshExpiration == 0 {
		config.Security.RefreshExpiration = 7 * 24 * time.Hour
	}

	// Logging defaults
	if config.Logging.Level == "" {
		config.Logging.Level = "info"
	}
	if config.Logging.Format == "" {
		config.Logging.Format = "json"
	}
	if config.Logging.Output == "" {
		config.Logging.Output = "stdout"
	}
}

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	// Validate server configuration
	if config.Server.Port < 1 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}

	// Validate database configuration
	if config.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if config.Database.DBName == "" {
		return fmt.Errorf("database name is required")
	}

	// Validate security configuration
	if config.Security.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if len(config.Security.JWTSecret) < 32 {
		return fmt.Errorf("JWT secret must be at least 32 characters")
	}

	// Validate Stellar configuration
	if config.Stellar.IssuerAccount.SecretKey == "" {
		return fmt.Errorf("Stellar issuer secret key is required")
	}

	return nil
}

// parseDatabaseURL parses a database URL and sets database configuration
func parseDatabaseURL(dbURL string, config *Config) {
	// Simple parsing for postgres://user:password@host:port/dbname
	// In a real implementation, use a proper URL parser
	// For now, just set basic defaults
	config.Database.Host = "localhost"
	config.Database.Port = 5432
	config.Database.User = "postgres"
	config.Database.DBName = "carbon_scribe"
}

// atoi converts string to int with default
func atoi(s string) int {
	if i, err := strconv.Atoi(s); err == nil {
		return i
	}
	return 0
}

// GetDatabaseURL returns the database connection string
func (c *DatabaseConfig) GetDatabaseURL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode)
}

// GetServerAddr returns the server address
func (c *ServerConfig) GetServerAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
// setDefaults sets default configuration values
func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.mode", "development")
	viper.SetDefault("server.read_timeout", 30*time.Second)
	viper.SetDefault("server.write_timeout", 30*time.Second)
	viper.SetDefault("server.shutdown_timeout", 10*time.Second)

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.password", "postgres")
	viper.SetDefault("database.dbname", "carbonscribe_portal")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_max_lifetime", 5*time.Minute)

	// Maps defaults
	viper.SetDefault("maps.default_provider", "mapbox")
	viper.SetDefault("maps.tile_cache_ttl", 24*time.Hour)
	viper.SetDefault("maps.max_tile_cache_size", 1073741824) // 1GB
	viper.SetDefault("maps.static_map_width", 800)
	viper.SetDefault("maps.static_map_height", 600)
	viper.SetDefault("maps.default_zoom_level", 10)
	viper.SetDefault("maps.max_concurrent_requests", 10)
	viper.SetDefault("maps.mapbox_style_url", "mapbox://styles/mapbox/satellite-v9")

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output_path", "stdout")
}

// GetDSN returns the database connection string
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}
