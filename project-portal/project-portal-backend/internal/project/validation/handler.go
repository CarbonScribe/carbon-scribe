package validation

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func RegisterValidationRoutes(r *gin.RouterGroup, validator *MethodologyValidator) {
	r.GET("/validate-methodology/:tokenId", func(c *gin.Context) {
		tokenID, err := strconv.Atoi(c.Param("tokenId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tokenId"})
			return
		}
		var providedMeta methodology.MethodologyMeta
		if err := c.ShouldBindJSON(&providedMeta); err != nil {
			providedMeta = methodology.MethodologyMeta{} // allow empty
		}
		result := validator.Validate(c.Request.Context(), tokenID, &providedMeta)
		c.JSON(http.StatusOK, result)
	})

	r.POST("/validate-methodology/batch", func(c *gin.Context) {
		var req BatchMethodologyValidationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		results := make([]MethodologyValidationResult, 0, len(req.TokenIDs))
		for _, tokenID := range req.TokenIDs {
			results = append(results, validator.Validate(c.Request.Context(), tokenID, nil))
		}
		c.JSON(http.StatusOK, BatchMethodologyValidationResponse{Results: results})
	})

	r.GET("/methodologies/:tokenId", func(c *gin.Context) {
		tokenID, err := strconv.Atoi(c.Param("tokenId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tokenId"})
			return
		}
		meta, err := validator.Client.GetMethodologyMeta(c.Request.Context(), tokenID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Methodology not found"})
			return
		}
		c.JSON(http.StatusOK, meta)
	})
}
