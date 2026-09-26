// Package middleware provides HTTP middleware for the CarbonScribe project portal.
package middleware

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter holds the Redis client and configuration for rate limiting.
type RateLimiter struct {
	redis     *redis.Client
	whitelist []net.IPNet
}

// RouteConfig defines the rate limit parameters for a single route.
type RouteConfig struct {
	// MaxRequests is the maximum number of requests allowed in Window.
	MaxRequests int
	// Window is the sliding window duration.
	Window time.Duration
	// KeyPrefix is used to namespace Redis keys (e.g. "rl:login").
	KeyPrefix string
}

// NewRateLimiter creates a RateLimiter backed by the supplied Redis client.
// ipWhitelist is a comma-separated list of IP addresses or CIDR blocks whose
// requests bypass rate limiting entirely (e.g. internal health-check probes).
func NewRateLimiter(client *redis.Client, ipWhitelist string) *RateLimiter {
	rl := &RateLimiter{redis: client}

	for _, entry := range strings.Split(ipWhitelist, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		// Treat bare IP addresses as /32 or /128
		if !strings.Contains(entry, "/") {
			if strings.Contains(entry, ":") {
				entry += "/128"
			} else {
				entry += "/32"
			}
		}
		_, network, err := net.ParseCIDR(entry)
		if err != nil {
			log.Printf("⚠️  rate-limit: invalid whitelist entry %q: %v", entry, err)
			continue
		}
		rl.whitelist = append(rl.whitelist, *network)
	}

	return rl
}

// isWhitelisted returns true when ip is covered by the configured whitelist.
func (rl *RateLimiter) isWhitelisted(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	for _, network := range rl.whitelist {
		if network.Contains(parsed) {
			return true
		}
	}
	return false
}

// Limit returns a Gin middleware that enforces the supplied RouteConfig.
//
// The key is  <KeyPrefix>:<clientIP>  so each route / IP pair gets its own
// counter.  The middleware uses a fixed-window counter stored in Redis with
// an atomic INCR + EXPIREAT sequence to avoid race conditions on first hit.
//
// Responses include the standard X-RateLimit-* headers and, when the limit is
// exceeded, a 429 Too Many Requests response with a Retry-After header.
//
// When Redis is unavailable the middleware fails open (allows the request) and
// logs a warning — rate limiting is defence-in-depth and must not take the
// service down.
func (rl *RateLimiter) Limit(cfg RouteConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := realClientIP(c)

		// Whitelist bypass
		if rl.isWhitelisted(ip) {
			setRateLimitHeaders(c, cfg.MaxRequests, cfg.MaxRequests, 0)
			c.Next()
			return
		}

		key := fmt.Sprintf("%s:%s", cfg.KeyPrefix, ip)
		ctx := context.Background()

		windowEnd := time.Now().Truncate(cfg.Window).Add(cfg.Window)
		resetUnix := windowEnd.Unix()

		// Atomic increment; set expiry only on first hit in the window.
		pipe := rl.redis.TxPipeline()
		incrCmd := pipe.Incr(ctx, key)
		pipe.ExpireAt(ctx, key, windowEnd)
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("⚠️  rate-limit: redis pipeline error for key %q: %v", key, err)
			// Fail open — Redis unavailable; allow request.
			c.Next()
			return
		}

		count := int(incrCmd.Val())
		remaining := cfg.MaxRequests - count
		if remaining < 0 {
			remaining = 0
		}

		setRateLimitHeaders(c, cfg.MaxRequests, remaining, resetUnix)

		if count > cfg.MaxRequests {
			retryAfter := int64(time.Until(windowEnd).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}

			// Log violation with security context
			userID, _ := c.Get("user_id")
			log.Printf(
				"🚫 rate-limit violation | route=%s key=%s count=%d limit=%d ip=%s userID=%v",
				cfg.KeyPrefix, key, count, cfg.MaxRequests, ip, userID,
			)

			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": retryAfter,
			})
			return
		}

		c.Next()
	}
}

// LimitWithGraduatedCooldown is like Limit but applies an increasing lock
// duration when the same IP exceeds the limit repeatedly.
//
// Each excess hit increments a separate violation counter (key: <KeyPrefix>:violations:<ip>).
// Once that counter reaches threshold the window is extended by
//
//	baseSeconds * (violations / threshold)
//
// so the effective timeout grows linearly with repeated abuse.
func (rl *RateLimiter) LimitWithGraduatedCooldown(cfg RouteConfig, threshold, baseSeconds int) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := realClientIP(c)

		if rl.isWhitelisted(ip) {
			setRateLimitHeaders(c, cfg.MaxRequests, cfg.MaxRequests, 0)
			c.Next()
			return
		}

		ctx := context.Background()
		key := fmt.Sprintf("%s:%s", cfg.KeyPrefix, ip)
		violKey := fmt.Sprintf("%s:violations:%s", cfg.KeyPrefix, ip)

		// Check if this IP is currently in an extended cooldown lock.
		lockKey := fmt.Sprintf("%s:lock:%s", cfg.KeyPrefix, ip)
		if ttl, err := rl.redis.TTL(ctx, lockKey).Result(); err == nil && ttl > 0 {
			retryAfter := int64(ttl.Seconds())
			setRateLimitHeaders(c, cfg.MaxRequests, 0, time.Now().Add(ttl).Unix())
			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))

			userID, _ := c.Get("user_id")
			log.Printf(
				"🚫 rate-limit cooldown active | route=%s ip=%s retry_after=%ds userID=%v",
				cfg.KeyPrefix, ip, retryAfter, userID,
			)

			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded — cooldown active",
				"retry_after": retryAfter,
			})
			return
		}

		windowEnd := time.Now().Truncate(cfg.Window).Add(cfg.Window)
		resetUnix := windowEnd.Unix()

		pipe := rl.redis.TxPipeline()
		incrCmd := pipe.Incr(ctx, key)
		pipe.ExpireAt(ctx, key, windowEnd)
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("⚠️  rate-limit: redis pipeline error for key %q: %v", key, err)
			c.Next()
			return
		}

		count := int(incrCmd.Val())
		remaining := cfg.MaxRequests - count
		if remaining < 0 {
			remaining = 0
		}

		setRateLimitHeaders(c, cfg.MaxRequests, remaining, resetUnix)

		if count > cfg.MaxRequests {
			// Increment violation counter (24h TTL so it decays naturally).
			violations, _ := rl.redis.Incr(ctx, violKey).Result()
			rl.redis.Expire(ctx, violKey, 24*time.Hour)

			// Compute extended cooldown duration.
			multiplier := int(violations) / threshold
			if multiplier < 1 {
				multiplier = 1
			}
			lockDuration := time.Duration(baseSeconds*multiplier) * time.Second
			rl.redis.Set(ctx, lockKey, 1, lockDuration)

			retryAfter := int64(lockDuration.Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))

			userID, _ := c.Get("user_id")
			log.Printf(
				"🚫 rate-limit violation (graduated) | route=%s ip=%s count=%d limit=%d violations=%d cooldown=%s userID=%v",
				cfg.KeyPrefix, ip, count, cfg.MaxRequests, violations, lockDuration, userID,
			)

			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": retryAfter,
			})
			return
		}

		c.Next()
	}
}

// setRateLimitHeaders sets the standard X-RateLimit-* response headers.
func setRateLimitHeaders(c *gin.Context, limit, remaining int, resetUnix int64) {
	c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
	if resetUnix > 0 {
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetUnix, 10))
	}
}

// realClientIP extracts the true client IP, honouring X-Forwarded-For and
// X-Real-IP when set by a trusted proxy.
func realClientIP(c *gin.Context) string {
	// X-Real-IP is set by nginx and is more reliable than X-Forwarded-For.
	if ip := strings.TrimSpace(c.GetHeader("X-Real-IP")); ip != "" {
		return ip
	}
	// Take the first (leftmost, i.e. original client) address from XFF.
	if xff := strings.TrimSpace(c.GetHeader("X-Forwarded-For")); xff != "" {
		parts := strings.SplitN(xff, ",", 2)
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	// Fall back to the direct remote address, stripping the port.
	ip, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return ip
}

// NewRedisClient creates a go-redis client from the supplied parameters.
// Callers should defer client.Close().
func NewRedisClient(host, port, password string, db int) *redis.Client {
	addr := net.JoinHostPort(host, port)
	return redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
}
