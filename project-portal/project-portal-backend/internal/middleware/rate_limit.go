package middleware

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "strings"
    "time"

    "carbon-scribe/project-portal/project-portal-backend/internal/config"

    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/redis/go-redis/v9"
)

var rateLimitViolationCounter = promauto.NewCounterVec(
    prometheus.CounterOpts{
        Name: "project_portal_rate_limit_violations_total",
        Help: "Total number of rate limit violations by endpoint",
    },
    []string{"endpoint"},
)

// RateLimiter provides Redis-backed rate limiting logic.
type RateLimiter struct {
    client         *redis.Client
    whitelist      map[string]struct{}
    baseCooldown   time.Duration
    maxCooldown    time.Duration
}

// NewRateLimiter creates a new Redis-backed rate limiter.
func NewRateLimiter(redisCfg config.RedisConfig, rateCfg config.RateLimitConfig) (*RateLimiter, error) {
    client := redis.NewClient(&redis.Options{
        Addr:     fmt.Sprintf("%s:%s", redisCfg.Host, redisCfg.Port),
        Password: redisCfg.Password,
        DB:       redisCfg.DB,
    })

    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()

    if err := client.Ping(ctx).Err(); err != nil {
        return nil, fmt.Errorf("redis ping failed: %w", err)
    }

    baseCooldown := parseDurationOrDefault(rateCfg.ViolationCooldownBase, 15*time.Minute)
    maxMultiplier := rateCfg.MaxCooldownMultiplier
    if maxMultiplier <= 0 {
        maxMultiplier = 5
    }

    return &RateLimiter{
        client:       client,
        whitelist:    createIPWhitelist(rateCfg.WhitelistIPs),
        baseCooldown: baseCooldown,
        maxCooldown:  baseCooldown * time.Duration(maxMultiplier),
    }, nil
}

// LimitByIP applies a per-IP rate limit for the given endpoint.
func (rl *RateLimiter) LimitByIP(endpoint string, limit int, window time.Duration) gin.HandlerFunc {
    return rl.rateLimitHandler(endpoint, limit, window, false)
}

// LimitByUserIP applies a per-user/IP rate limit for the given endpoint.
func (rl *RateLimiter) LimitByUserIP(endpoint string, limit int, window time.Duration) gin.HandlerFunc {
    return rl.rateLimitHandler(endpoint, limit, window, true)
}

func (rl *RateLimiter) rateLimitHandler(endpoint string, limit int, window time.Duration, userBucket bool) gin.HandlerFunc {
    return func(c *gin.Context) {
        ipAddress := c.ClientIP()
        if rl.isWhitelisted(ipAddress) {
            c.Next()
            return
        }

        if rl.client == nil {
            c.Next()
            return
        }

        key := ipAddress
        if userBucket {
            if userID := rl.extractUserID(c); userID != "" {
                key = fmt.Sprintf("%s:%s", userID, ipAddress)
            }
        }

        lockKey := fmt.Sprintf("rl:lock:%s:%s", endpoint, key)
        countKey := fmt.Sprintf("rl:count:%s:%s", endpoint, key)
        violationsKey := fmt.Sprintf("rl:violations:%s:%s", endpoint, key)

        ctx := c.Request.Context()
        if lockTTL, err := rl.client.PTTL(ctx, lockKey).Result(); err == nil && lockTTL > 0 {
            rl.setRateLimitHeaders(c, limit, 0, time.Now().Add(lockTTL))
            rl.logRateLimitViolation(c, endpoint, ipAddress, lockTTL, 0, "lock_active")
            rateLimitViolationCounter.WithLabelValues(endpoint).Inc()
            c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
                "error":               "rate limit exceeded",
                "retry_after_seconds": int(lockTTL.Seconds()),
            })
            return
        }

        pipeline := rl.client.TxPipeline()
        counter := pipeline.Incr(ctx, countKey)
        pipeline.Expire(ctx, countKey, window)
        ttl := pipeline.PTTL(ctx, countKey)
        _, err := pipeline.Exec(ctx)
        if err != nil {
            log.Printf("warning: rate limiter Redis transaction failed for endpoint=%s ip=%s error=%v", endpoint, ipAddress, err)
            c.Next()
            return
        }

        currentCount := counter.Val()
        remaining := limit - int(currentCount)
        if remaining < 0 {
            remaining = 0
        }

        reset := time.Now().Add(ttl.Val())
        if ttl.Val() <= 0 {
            reset = time.Now().Add(window)
        }
        rl.setRateLimitHeaders(c, limit, remaining, reset)

        if currentCount > int64(limit) {
            violations, _ := rl.client.Incr(ctx, violationsKey).Result()
            rl.client.Expire(ctx, violationsKey, 24*time.Hour)
            backoff := rl.calculateCooldown(window, violations)
            if err := rl.client.Set(ctx, lockKey, "1", backoff).Err(); err != nil {
                log.Printf("warning: rate limiter failed to set lock for endpoint=%s key=%s error=%v", endpoint, key, err)
            }
            rl.logRateLimitViolation(c, endpoint, ipAddress, backoff, int(currentCount), "limit_exceeded")
            rateLimitViolationCounter.WithLabelValues(endpoint).Inc()
            c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
                "error":               "rate limit exceeded",
                "retry_after_seconds": int(backoff.Seconds()),
            })
            return
        }

        c.Next()
    }
}

func (rl *RateLimiter) extractUserID(c *gin.Context) string {
    if userID, ok := c.Get("user_id"); ok {
        if idStr, ok := userID.(string); ok && idStr != "" {
            return idStr
        }
    }
    if userID, ok := c.Get("financing_user_id"); ok {
        if idStr, ok := userID.(string); ok && idStr != "" {
            return idStr
        }
        if idUUID, ok := userID.(fmt.Stringer); ok {
            return idUUID.String()
        }
    }
    return ""
}

func (rl *RateLimiter) setRateLimitHeaders(c *gin.Context, limit, remaining int, reset time.Time) {
    c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
    c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
    c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", reset.Unix()))
}

func (rl *RateLimiter) calculateCooldown(window time.Duration, violations int64) time.Duration {
    multiplier := time.Duration(violations)
    if multiplier < 1 {
        multiplier = 1
    }
    cooldown := rl.baseCooldown * multiplier
    if cooldown > rl.maxCooldown {
        cooldown = rl.maxCooldown
    }
    if cooldown < window {
        return window
    }
    return cooldown
}

func (rl *RateLimiter) logRateLimitViolation(c *gin.Context, endpoint, ipAddress string, lockTTL time.Duration, currentCount int, reason string) {
    userID := rl.extractUserID(c)
    log.Printf(
        "rate limit violation endpoint=%s path=%s ip=%s user_id=%s count=%d reason=%s lock_ttl=%s",
        endpoint,
        c.FullPath(),
        ipAddress,
        userID,
        currentCount,
        reason,
        lockTTL,
    )
}

func (rl *RateLimiter) isWhitelisted(ipAddress string) bool {
    if ipAddress == "" {
        return false
    }
    _, ok := rl.whitelist[ipAddress]
    return ok
}

func createIPWhitelist(entries []string) map[string]struct{} {
    whitelist := make(map[string]struct{})
    for _, entry := range entries {
        entry = strings.TrimSpace(entry)
        if entry == "" {
            continue
        }
        whitelist[entry] = struct{}{}
    }
    return whitelist
}

func parseDurationOrDefault(value string, defaultDuration time.Duration) time.Duration {
    if value == "" {
        return defaultDuration
    }
    duration, err := time.ParseDuration(value)
    if err != nil {
        return defaultDuration
    }
    return duration
}
