package compliance

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler exposes compliance endpoints via Gin.
type Handler struct {
	service *Service
}

// NewHandler creates a new compliance HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers all compliance routes under /api/v1/compliance.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	compliance := router.Group("/compliance")
	{
		// Privacy requests
		requests := compliance.Group("/requests")
		{
			requests.POST("/export", h.CreateExportRequest)
			requests.POST("/delete", h.CreateDeleteRequest)
			requests.GET("/:id", h.GetRequestStatus)
			requests.GET("", h.ListRequests)
		}

		// Privacy preferences
		preferences := compliance.Group("/preferences")
		{
			preferences.GET("", h.GetPreferences)
			preferences.PUT("", h.UpdatePreferences)
		}

		// Consent
		consents := compliance.Group("/consents")
		{
			consents.POST("", h.RecordConsent)
			consents.GET("", h.ListConsents)
			consents.DELETE("/:type", h.WithdrawConsent)
		}

		// Audit logs
		audit := compliance.Group("/audit")
		{
			audit.GET("/logs", h.QueryAuditLogs)
		}

		// Retention policies
		retention := compliance.Group("/retention")
		{
			retention.POST("/policies", h.CreateRetentionPolicy)
			retention.GET("/policies", h.ListRetentionPolicies)
			retention.GET("/policies/:id", h.GetRetentionPolicy)
			retention.PUT("/policies/:id", h.UpdateRetentionPolicy)
			retention.GET("/schedule", h.ListRetentionSchedules)
		}

		// Legal holds
		holds := compliance.Group("/legal-holds")
		{
			holds.POST("", h.CreateLegalHold)
			holds.GET("", h.ListLegalHolds)
			holds.POST("/:id/release", h.ReleaseLegalHold)
		}

		// Stats
		compliance.GET("/stats", h.GetStats)
	}
}

// --- Privacy Request Handlers ---

func (h *Handler) CreateExportRequest(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.CreateExportRequest(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) CreateDeleteRequest(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	var req DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.CreateDeleteRequest(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) GetRequestStatus(c *gin.Context) {
	id := c.Param("id")
	result, err := h.service.GetRequestStatus(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ListRequests(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	requests, total, err := h.service.ListRequests(c.Request.Context(), userID, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, PaginatedResponse{
		Data:   requests,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// --- Privacy Preference Handlers ---

func (h *Handler) GetPreferences(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	pref, err := h.service.GetPreferences(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pref)
}

func (h *Handler) UpdatePreferences(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	var req UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pref, err := h.service.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pref)
}

// --- Consent Handlers ---

func (h *Handler) RecordConsent(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	var req RecordConsentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.service.RecordConsent(
		c.Request.Context(), userID, req,
		c.ClientIP(), c.GetHeader("User-Agent"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, record)
}

func (h *Handler) ListConsents(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	records, err := h.service.ListUserConsents(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

func (h *Handler) WithdrawConsent(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	consentType := c.Param("type")
	if err := h.service.WithdrawConsent(c.Request.Context(), userID, consentType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "consent withdrawn successfully"})
}

// --- Audit Log Handlers ---

func (h *Handler) QueryAuditLogs(c *gin.Context) {
	var query AuditLogQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if query.Limit <= 0 {
		query.Limit = 50
	}

	logs, total, err := h.service.QueryAuditLogs(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, PaginatedResponse{
		Data:   logs,
		Total:  total,
		Limit:  query.Limit,
		Offset: query.Offset,
	})
}

// --- Retention Policy Handlers ---

func (h *Handler) CreateRetentionPolicy(c *gin.Context) {
	var req CreateRetentionPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, err := h.service.CreateRetentionPolicy(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, policy)
}

func (h *Handler) GetRetentionPolicy(c *gin.Context) {
	id := c.Param("id")
	policy, err := h.service.GetRetentionPolicy(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "policy not found"})
		return
	}
	c.JSON(http.StatusOK, policy)
}

func (h *Handler) ListRetentionPolicies(c *gin.Context) {
	dataCategory := c.Query("data_category")
	jurisdiction := c.Query("jurisdiction")
	activeOnly := c.DefaultQuery("active_only", "true") == "true"

	policies, err := h.service.ListRetentionPolicies(c.Request.Context(), dataCategory, jurisdiction, activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, policies)
}

func (h *Handler) UpdateRetentionPolicy(c *gin.Context) {
	id := c.Param("id")
	var req CreateRetentionPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, err := h.service.UpdateRetentionPolicy(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, policy)
}

func (h *Handler) ListRetentionSchedules(c *gin.Context) {
	policyID := c.Query("policy_id")
	schedules, err := h.service.ListRetentionSchedules(c.Request.Context(), policyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedules)
}

// --- Legal Hold Handlers ---

func (h *Handler) CreateLegalHold(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	var req CreateLegalHoldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hold, err := h.service.CreateLegalHold(c.Request.Context(), req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, hold)
}

func (h *Handler) ListLegalHolds(c *gin.Context) {
	holds, err := h.service.ListActiveLegalHolds(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, holds)
}

func (h *Handler) ReleaseLegalHold(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user ID required"})
		return
	}

	hold, err := h.service.ReleaseLegalHold(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, hold)
}

// --- Stats Handler ---

func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.service.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}
