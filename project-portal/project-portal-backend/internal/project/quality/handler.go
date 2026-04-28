package quality

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler for project quality scoring endpoints

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetProjectScore(c *gin.Context) {
	projectID := c.Param("id")
	score, err := h.service.GetProjectScore(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, score)
}


func (h *Handler) GetScoreHistory(c *gin.Context) {
	projectID := c.Param("id")
	history, err := h.service.GetScoreHistory(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, history)
}

func (h *Handler) RecalculateScore(c *gin.Context) {
	projectID := c.Param("id")
	adminID := c.GetHeader("X-Admin-User") // or from auth context
	score, err := h.service.RecalculateScore(c.Request.Context(), projectID, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, score)
}

func (h *Handler) ListTopScores(c *gin.Context) {
	limit := 20 // default
	scores, err := h.service.ListTopScores(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, scores)
}

func (h *Handler) SyncScoresToContract(c *gin.Context) {
	err := h.service.SyncScoresToContract(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "synced"})
}
