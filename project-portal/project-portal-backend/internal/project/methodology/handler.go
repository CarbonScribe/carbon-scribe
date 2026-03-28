package methodology

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup) {
	v1.POST("/projects/:id/register-methodology", h.registerMethodology)
	v1.GET("/projects/:id/methodology", h.getProjectMethodology)
	v1.GET("/methodologies/:tokenId/validate", h.validateMethodology)
}

func (h *Handler) registerMethodology(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	var req RegisterMethodologyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	registration, err := h.service.RegisterMethodology(c.Request.Context(), projectID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, registration)
}

func (h *Handler) getProjectMethodology(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	registration, err := h.service.GetProjectMethodology(c.Request.Context(), projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "methodology registration not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, registration)
}

func (h *Handler) validateMethodology(c *gin.Context) {
	tokenID, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil || tokenID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token ID"})
		return
	}

	valid, err := h.service.ValidateMethodology(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ValidateMethodologyResponse{
		TokenID:    tokenID,
		ContractID: h.service.ContractID(),
		Valid:      valid,
	})
}
