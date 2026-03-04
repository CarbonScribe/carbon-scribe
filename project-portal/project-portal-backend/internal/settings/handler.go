package settings

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup) {
	settings := v1.Group("/settings")
	settings.Use(authRequired())
	{
		settings.GET("/profile", requirePermission("settings:read"), h.getProfile)
		settings.PUT("/profile", requirePermission("settings:write"), h.updateProfile)
		settings.DELETE("/profile", requirePermission("settings:write"), h.deleteProfile)
		settings.POST("/profile/picture", requirePermission("settings:write"), h.uploadProfilePicture)
		settings.GET("/profile/export", requirePermission("settings:read"), h.exportProfile)

		settings.GET("/notifications", requirePermission("settings:read"), h.getNotifications)
		settings.PUT("/notifications", requirePermission("settings:write"), h.updateNotifications)

		settings.GET("/api-keys", requirePermission("settings:api_keys"), h.listAPIKeys)
		settings.POST("/api-keys", requirePermission("settings:api_keys"), h.createAPIKey)
		settings.POST("/api-keys/validate", requirePermission("settings:api_keys"), h.validateAPIKey)
		settings.DELETE("/api-keys/:id", requirePermission("settings:api_keys"), h.revokeAPIKey)
		settings.POST("/api-keys/:id/rotate", requirePermission("settings:api_keys"), h.rotateAPIKey)
		settings.GET("/api-keys/:id/usage", requirePermission("settings:api_keys"), h.getAPIKeyUsage)
		settings.POST("/api-keys/:id/webhooks", requirePermission("settings:api_keys"), h.configureAPIKeyWebhooks)

		settings.GET("/integrations", requirePermission("settings:read"), h.listIntegrations)
		settings.POST("/integrations", requirePermission("settings:integrations"), h.configureIntegration)
		settings.POST("/integrations/batch", requirePermission("settings:integrations"), h.batchConfigureIntegrations)
		settings.GET("/integrations/:id/health", requirePermission("settings:integrations"), h.getIntegrationHealth)
		settings.GET("/integrations/oauth/:provider/start", requirePermission("settings:integrations"), h.oauthStart)
		settings.POST("/integrations/oauth/:provider/callback", requirePermission("settings:integrations"), h.oauthCallback)

		settings.GET("/billing", requirePermission("settings:billing"), h.getBilling)
		settings.GET("/billing/invoices", requirePermission("settings:billing"), h.listInvoices)
		settings.GET("/billing/invoices/:id/pdf", requirePermission("settings:billing"), h.getInvoicePDF)
		settings.POST("/billing/payment-method", requirePermission("settings:billing"), h.addPaymentMethod)
	}
}

func authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if strings.TrimSpace(auth) == "" {
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
		c.Set("settings_user_id", uid)
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

func splitPermissions(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
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

func currentUserID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get("settings_user_id")
	if !ok {
		return uuid.Nil, false
	}
	uid, ok := v.(uuid.UUID)
	return uid, ok
}

func parseUUIDParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}

func (h *Handler) getProfile(c *gin.Context) {
	uid, _ := currentUserID(c)
	profile, err := h.service.GetProfile(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if c.Query("segmented") == "true" {
		c.JSON(http.StatusOK, gin.H{
			"personal": gin.H{
				"full_name":           profile.FullName,
				"display_name":        profile.DisplayName,
				"profile_picture_url": profile.ProfilePictureURL,
				"bio":                 profile.Bio,
				"phone_number":        profile.PhoneNumber,
				"secondary_email":     profile.SecondaryEmail,
				"language":            profile.Language,
				"timezone":            profile.Timezone,
				"date_format":         profile.DateFormat,
				"verification_level":  profile.VerificationLevel,
				"verification_data":   profile.VerificationData,
			},
			"organization": gin.H{
				"organization": profile.Organization,
				"job_title":    profile.JobTitle,
				"website":      profile.Website,
				"address":      profile.Address,
			},
			"billing": gin.H{
				"currency": profile.Currency,
				"address":  profile.Address,
			},
			"raw": profile,
		})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func (h *Handler) updateProfile(c *gin.Context) {
	uid, _ := currentUserID(c)
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	profile, err := h.service.UpdateProfile(c.Request.Context(), uid, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func (h *Handler) deleteProfile(c *gin.Context) {
	uid, _ := currentUserID(c)
	resp, err := h.service.DeleteProfile(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) uploadProfilePicture(c *gin.Context) {
	uid, _ := currentUserID(c)
	filename := c.PostForm("filename")
	if filename == "" {
		file, err := c.FormFile("file")
		if err == nil && file != nil {
			filename = file.Filename
		}
	}
	if filename == "" {
		var body struct {
			Filename string `json:"filename"`
		}
		_ = c.ShouldBindJSON(&body)
		filename = body.Filename
	}
	resp, err := h.service.UploadProfilePicture(c.Request.Context(), uid, filename)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) exportProfile(c *gin.Context) {
	uid, _ := currentUserID(c)
	format := c.DefaultQuery("format", "json")
	payload, contentType, err := h.service.ExportProfile(c.Request.Context(), uid, format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, contentType, payload)
}

func (h *Handler) getNotifications(c *gin.Context) {
	uid, _ := currentUserID(c)
	prefs, err := h.service.GetNotifications(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prefs)
}

func (h *Handler) updateNotifications(c *gin.Context) {
	uid, _ := currentUserID(c)
	var req UpdateNotificationPreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	prefs, err := h.service.UpdateNotifications(c.Request.Context(), uid, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prefs)
}

func (h *Handler) listAPIKeys(c *gin.Context) {
	uid, _ := currentUserID(c)
	keys, err := h.service.ListAPIKeys(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, keys)
}

func (h *Handler) createAPIKey(c *gin.Context) {
	uid, _ := currentUserID(c)
	var req CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.service.CreateAPIKey(c.Request.Context(), uid, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) validateAPIKey(c *gin.Context) {
	var req ValidateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.service.ValidateAPIKeySecret(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	status := http.StatusOK
	if !resp.Valid && resp.RateLimited {
		status = http.StatusTooManyRequests
	}
	if !resp.Valid && !resp.RateLimited {
		status = http.StatusUnauthorized
	}
	c.JSON(status, resp)
}

func (h *Handler) revokeAPIKey(c *gin.Context) {
	uid, _ := currentUserID(c)
	keyID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.RevokeAPIKey(c.Request.Context(), uid, keyID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) rotateAPIKey(c *gin.Context) {
	uid, _ := currentUserID(c)
	keyID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.service.RotateAPIKey(c.Request.Context(), uid, keyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) getAPIKeyUsage(c *gin.Context) {
	uid, _ := currentUserID(c)
	keyID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	usage, err := h.service.GetAPIKeyUsage(c.Request.Context(), uid, keyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, usage)
}

func (h *Handler) configureAPIKeyWebhooks(c *gin.Context) {
	uid, _ := currentUserID(c)
	keyID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req ConfigureAPIKeyWebhooksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	key, err := h.service.ConfigureAPIKeyWebhooks(c.Request.Context(), uid, keyID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, key)
}

func (h *Handler) listIntegrations(c *gin.Context) {
	uid, _ := currentUserID(c)
	items, err := h.service.ListIntegrations(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) configureIntegration(c *gin.Context) {
	uid, _ := currentUserID(c)
	var req ConfigureIntegrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.service.ConfigureIntegration(c.Request.Context(), uid, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) batchConfigureIntegrations(c *gin.Context) {
	uid, _ := currentUserID(c)
	var req BatchConfigureIntegrationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	items, err := h.service.BatchConfigureIntegrations(c.Request.Context(), uid, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"items": items})
}

func (h *Handler) oauthStart(c *gin.Context) {
	uid, _ := currentUserID(c)
	provider := c.Param("provider")
	resp, err := h.service.StartOAuthFlow(c.Request.Context(), uid, provider)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) oauthCallback(c *gin.Context) {
	uid, _ := currentUserID(c)
	provider := c.Param("provider")
	var req OAuthCallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.service.CompleteOAuthFlow(c.Request.Context(), uid, provider, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) getIntegrationHealth(c *gin.Context) {
	uid, _ := currentUserID(c)
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.service.GetIntegrationHealth(c.Request.Context(), uid, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) getBilling(c *gin.Context) {
	uid, _ := currentUserID(c)
	summary, err := h.service.GetBilling(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *Handler) listInvoices(c *gin.Context) {
	uid, _ := currentUserID(c)
	invoices, err := h.service.ListInvoices(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, invoices)
}

func (h *Handler) getInvoicePDF(c *gin.Context) {
	uid, _ := currentUserID(c)
	invoiceID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.service.GetInvoicePDF(c.Request.Context(), uid, invoiceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) addPaymentMethod(c *gin.Context) {
	uid, _ := currentUserID(c)
	var req AddPaymentMethodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sub, err := h.service.AddPaymentMethod(c.Request.Context(), uid, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sub)
}
