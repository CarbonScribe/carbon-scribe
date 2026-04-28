package inventory

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for inventory operations
type Handler struct {
	service Service
}

// NewHandler creates a new inventory handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers inventory routes with the router
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	inventory := router.Group("/projects/:id/inventory")
	{
		inventory.GET("/summary", h.getInventorySummary)
		inventory.GET("/credits", h.listCredits)
		inventory.GET("/credits/active", h.listActiveCredits)
		inventory.GET("/credits/retired", h.listRetiredCredits)
		inventory.GET("/credits/:tokenId", h.getCreditDetails)
		inventory.GET("/credits/:tokenId/metadata", h.getCreditMetadata)
		inventory.POST("/sync", h.syncInventory)
	}
}

func parseProjectID(c *gin.Context) (uuid.UUID, bool) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return uuid.Nil, false
	}
	return id, true
}

func parseTokenID(c *gin.Context) (uint32, bool) {
	tokenIDStr := c.Param("tokenId")
	tokenID, err := strconv.ParseUint(tokenIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token ID"})
		return 0, false
	}
	return uint32(tokenID), true
}

func parsePagination(c *gin.Context) (int, int) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	return limit, offset
}

func getOwnerAddress(c *gin.Context) string {
	owner := c.Query("owner")
	if owner == "" {
		owner = c.GetHeader("X-Stellar-Address")
	}
	if owner == "" {
		owner = "GDEMO00000000000000000000000000000000000000000000000000"
	}
	return owner
}

func (h *Handler) getInventorySummary(c *gin.Context) {
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}

	ownerAddress := getOwnerAddress(c)

	summary, err := h.service.GetInventorySummary(c.Request.Context(), projectID, ownerAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

func (h *Handler) listCredits(c *gin.Context) {
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}

	ownerAddress := getOwnerAddress(c)
	limit, offset := parsePagination(c)

	response, err := h.service.ListCredits(c.Request.Context(), projectID, ownerAddress, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) listActiveCredits(c *gin.Context) {
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}

	ownerAddress := getOwnerAddress(c)
	limit, offset := parsePagination(c)

	response, err := h.service.ListActiveCredits(c.Request.Context(), projectID, ownerAddress, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) listRetiredCredits(c *gin.Context) {
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}

	ownerAddress := getOwnerAddress(c)
	limit, offset := parsePagination(c)

	response, err := h.service.ListRetiredCredits(c.Request.Context(), projectID, ownerAddress, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) getCreditDetails(c *gin.Context) {
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}

	tokenID, ok := parseTokenID(c)
	if !ok {
		return
	}

	response, err := h.service.GetCreditDetails(c.Request.Context(), projectID, tokenID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) getCreditMetadata(c *gin.Context) {
	tokenID, ok := parseTokenID(c)
	if !ok {
		return
	}

	metadata, err := h.service.GetCreditMetadata(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metadata)
}

func (h *Handler) syncInventory(c *gin.Context) {
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}

	ownerAddress := getOwnerAddress(c)

	if err := h.service.SyncProjectInventory(c.Request.Context(), projectID, ownerAddress); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "synced", "project_id": projectID})
}
