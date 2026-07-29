package minting

import (
	"net/http"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/config"
	"carbon-scribe/project-portal/project-portal-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// ManualMint handles POST /api/v1/projects/:id/mint
func (h *Handler) ManualMint(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	var req ManualMintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Verification ID is optional, so we'll ignore it if not provided
	}

	job, err := h.service.MintProjectCredits(c.Request.Context(), projectID, req.VerificationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, job)
}

// GetMintingStatus handles GET /api/v1/projects/:id/minting-status
func (h *Handler) GetMintingStatus(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	jobs, tokens, err := h.service.GetMintingStatus(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, MintingStatusResponse{
		Jobs:   jobs,
		Tokens: tokens,
	})
}

func parseWindow(window string, defaultWindow time.Duration) time.Duration {
	if window == "" {
		return defaultWindow
	}
	d, err := time.ParseDuration(window)
	if err != nil {
		return defaultWindow
	}
	return d
}

// RegisterRoutes registers the minting routes
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, rateLimiter *middleware.RateLimiter, rateLimitCfg config.RateLimitConfig) {
	projects := rg.Group("/projects/:id")
	{
		projects.POST("/mint", rateLimiter.LimitByUserIP("project_mint", rateLimitCfg.MintLimit, parseWindow(rateLimitCfg.MintWindow, 1*time.Minute)), h.ManualMint)
		projects.GET("/minting-status", h.GetMintingStatus)
	}
}
