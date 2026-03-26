package financing

import (
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup) {
	financing := v1.Group("/financing")
	financing.Use(authRequired())
	{
		financing.POST("/projects/:id/calculate", requirePermission("financing:calculate"), h.calculateCredits)
		financing.GET("/projects/:id/credits", requirePermission("financing:read"), h.listProjectCredits)
		financing.POST("/credits/mint", requirePermission("financing:mint"), h.mintCredits)
		financing.GET("/credits/:id/status", requirePermission("financing:read"), h.creditStatus)
		financing.POST("/credits/forward-sale", requirePermission("financing:sell"), h.createForwardSale)
		financing.GET("/pricing/quote", requirePermission("financing:read"), h.getPriceQuote)
		financing.POST("/payments/initiate", requirePermission("financing:pay"), h.initiatePayment)
		financing.POST("/payouts/distribute", requirePermission("financing:distribute"), h.distributeRevenue)
		financing.GET("/payouts/:id", requirePermission("financing:read"), h.getPayoutStatus)
	}

	// Traceability and Methodology routes (registered on v1 for specific structure)
	v1.GET("/credits/:tokenId/traceability", authRequired(), requirePermission("financing:read"), h.creditTraceability)
	v1.GET("/projects/:id/credits/methodology/:methodologyId", authRequired(), requirePermission("financing:read"), h.listCreditsByMethodology)

	// Signed webhook endpoints do not require auth token, only signature verification.
	financing.POST("/webhooks/stellar", verifyWebhookSignature(), h.stellarWebhook)
	financing.POST("/webhooks/payment", verifyWebhookSignature(), h.paymentWebhook)
}

func authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := strings.TrimSpace(c.GetHeader("Authorization"))
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing auth header"})
			return
		}
		userIDHeader := strings.TrimSpace(c.GetHeader("X-User-ID"))
		if userIDHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing X-User-ID header"})
			return
		}
		uid, err := uuid.Parse(userIDHeader)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID header"})
			return
		}
		c.Set("financing_user_id", uid)
		c.Next()
	}
}

func requirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		perms := splitPermissions(c.GetHeader("X-Permissions"))
		if len(perms) == 0 {
			perms = splitPermissions(c.GetHeader("X-Scopes"))
		}
		if len(perms) == 0 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing permissions"})
			return
		}
		if hasPermission(perms, permission) || hasPermission(perms, "*") || hasPermission(perms, "admin") {
			c.Next()
			return
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func verifyWebhookSignature() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(os.Getenv("FINANCING_WEBHOOK_SECRET"))
		if expected == "" {
			c.Next()
			return
		}
		received := strings.TrimSpace(c.GetHeader("X-Webhook-Signature"))
		if received == "" || received != expected {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
			return
		}
		c.Next()
	}
}

func splitPermissions(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func hasPermission(perms []string, permission string) bool {
	for _, p := range perms {
		if p == permission {
			return true
		}
	}
	return false
}

func parseUUIDParam(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(key))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}

func (h *Handler) calculateCredits(c *gin.Context) {
	projectID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req CalculateCreditsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	credit, err := h.service.CalculateCredits(c.Request.Context(), projectID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, credit)
}

func (h *Handler) listProjectCredits(c *gin.Context) {
	projectID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	credits, err := h.service.ListProjectCredits(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, credits)
}

func (h *Handler) mintCredits(c *gin.Context) {
	var req MintCreditsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	credit, err := h.service.MintCredits(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, credit)
}

func (h *Handler) creditStatus(c *gin.Context) {
	creditID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	status, err := h.service.GetCreditStatus(c.Request.Context(), creditID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *Handler) creditTraceability(c *gin.Context) {
	tokenID := c.Param("tokenId")
	if tokenID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing token ID"})
		return
	}
	trace, err := h.service.GetCreditTraceability(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, trace)
}

func (h *Handler) listCreditsByMethodology(c *gin.Context) {
	projectID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	methIDStr := c.Param("methodologyId")
	methID, err := strconv.Atoi(methIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid methodology ID"})
		return
	}
	credits, err := h.service.ListCreditsByMethodology(c.Request.Context(), projectID, methID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, credits)
}

func (h *Handler) createForwardSale(c *gin.Context) {
	var req CreateForwardSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	agreement, err := h.service.CreateForwardSale(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, agreement)
}

func (h *Handler) getPriceQuote(c *gin.Context) {
	methodologyCode := strings.TrimSpace(c.Query("methodology_code"))
	if methodologyCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "methodology_code is required"})
		return
	}
	vintageYear, err := strconv.Atoi(c.DefaultQuery("vintage_year", "0"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vintage_year"})
		return
	}
	dataQuality, err := strconv.ParseFloat(c.DefaultQuery("data_quality", "0.8"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data_quality"})
		return
	}
	quote, err := h.service.GetPriceQuote(
		c.Request.Context(),
		methodologyCode,
		c.Query("region_code"),
		vintageYear,
		dataQuality,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, quote)
}

func (h *Handler) initiatePayment(c *gin.Context) {
	var req InitiatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	payment, err := h.service.InitiatePayment(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, payment)
}

func (h *Handler) distributeRevenue(c *gin.Context) {
	var req DistributeRevenueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	payout, err := h.service.DistributeRevenue(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, payout)
}

func (h *Handler) getPayoutStatus(c *gin.Context) {
	payoutID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	payout, err := h.service.GetPayoutStatus(c.Request.Context(), payoutID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, payout)
}

func (h *Handler) stellarWebhook(c *gin.Context) {
	var req StellarWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.HandleStellarWebhook(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}

func (h *Handler) paymentWebhook(c *gin.Context) {
	var req PaymentWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.HandlePaymentWebhook(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}
