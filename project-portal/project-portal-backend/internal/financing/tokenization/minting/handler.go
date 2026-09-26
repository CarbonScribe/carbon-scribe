package minting

import (
	"net/http"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
	rl      *middleware.RateLimiter
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// WithRateLimiter returns a new Handler with the supplied RateLimiter attached.
func (h *Handler) WithRateLimiter(rl *middleware.RateLimiter) *Handler {
	return &Handler{service: h.service, rl: rl}
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

// RegisterRoutes registers the minting routes.
// mint: 10 requests per minute per user/IP
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	projects := rg.Group("/projects/:id")

	if h.rl != nil {
		mintLimit := h.rl.LimitWithGraduatedCooldown(middleware.RouteConfig{
			MaxRequests: 10,
			Window:      1 * time.Minute,
			KeyPrefix:   "rl:minting:mint",
		}, 3, 60)
		projects.POST("/mint", mintLimit, h.ManualMint)
	} else {
		projects.POST("/mint", h.ManualMint)
	}

	projects.GET("/minting-status", h.GetMintingStatus)
}
