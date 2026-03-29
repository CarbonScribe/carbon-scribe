package methodology

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service    Service
	capService CapEnforcementService
}

func NewHandler(service Service, capService CapEnforcementService) *Handler {
	return &Handler{service: service, capService: capService}
}

func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup) {
	v1.POST("/projects/:id/register-methodology", h.registerMethodology)
	v1.GET("/projects/:id/methodology", h.getProjectMethodology)
	v1.GET("/methodologies/:tokenId/validate", h.validateMethodology)
	v1.GET("/methodologies/:tokenId/cap", h.getMethodologyCap)
	v1.POST("/methodologies/:tokenId/cap", h.setMethodologyCap)
	v1.GET("/methodologies/:tokenId/supply", h.getMethodologySupply)
	v1.GET("/methodologies/:tokenId/minting-history", h.getMethodologyMintingHistory)
	v1.GET("/projects/:id/minting-validations", h.getProjectMintingValidations)
	v1.GET("/methodologies/caps/near-limit", h.listCapsNearLimit)
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

func (h *Handler) getMethodologyCap(c *gin.Context) {
	if h.capService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "cap service is not configured"})
		return
	}
	tokenID, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil || tokenID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token ID"})
		return
	}
	cap, err := h.capService.GetMethodologyCap(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cap)
}

func (h *Handler) setMethodologyCap(c *gin.Context) {
	if h.capService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "cap service is not configured"})
		return
	}
	if !isAdminRequest(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin permissions required"})
		return
	}
	tokenID, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil || tokenID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token ID"})
		return
	}
	var req MethodologyCapRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.CreatedBy) == "" {
		req.CreatedBy = strings.TrimSpace(c.GetHeader("X-User-ID"))
	}
	cap, err := h.capService.SetMethodologyCap(c.Request.Context(), tokenID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cap)
}

func (h *Handler) getMethodologySupply(c *gin.Context) {
	if h.capService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "cap service is not configured"})
		return
	}
	tokenID, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil || tokenID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token ID"})
		return
	}
	supply, err := h.capService.GetMethodologySupply(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, supply)
}

func (h *Handler) getMethodologyMintingHistory(c *gin.Context) {
	if h.capService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "cap service is not configured"})
		return
	}
	tokenID, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil || tokenID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token ID"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	history, err := h.capService.GetMintingHistory(c.Request.Context(), tokenID, limit)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"methodology_token_id": tokenID, "attempts": history})
}

func (h *Handler) getProjectMintingValidations(c *gin.Context) {
	if h.capService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "cap service is not configured"})
		return
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	history, err := h.capService.GetProjectValidationHistory(c.Request.Context(), projectID, limit)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, MintingValidationHistoryResponse{ProjectID: projectID, Attempts: history})
}

func (h *Handler) listCapsNearLimit(c *gin.Context) {
	if h.capService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "cap service is not configured"})
		return
	}
	threshold := ParseThresholdRatio(c.Query("threshold_ratio"), 0.9)
	list, err := h.capService.ListNearLimitCaps(c.Request.Context(), threshold)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"threshold_ratio": threshold, "methodologies": list})
}

func isAdminRequest(c *gin.Context) bool {
	perms := strings.Split(c.GetHeader("X-Permissions"), ",")
	for _, p := range perms {
		v := strings.ToLower(strings.TrimSpace(p))
		if v == "admin" || v == "*" || v == "methodology:admin" || v == "financing:admin" {
			return true
		}
	}
	return strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Admin")), "true")
}
