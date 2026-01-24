package settings

import "github.com/gin-gonic/gin"

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/profile", h.GetProfile)
	r.PUT("/profile", h.UpdateProfile)

	r.GET("/notifications", h.GetNotifications)
	r.PUT("/notifications", h.UpdateNotifications)

	r.GET("/api-keys", h.APIKeys)
	r.GET("/integrations", h.Integrations)
	r.GET("/billing", h.Billing)
}

func (h *Handler) GetProfile(c *gin.Context) {
	profile, _ := h.service.GetProfile(c, "user-id")
	c.JSON(200, profile)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	var payload UserProfile
	_ = c.ShouldBindJSON(&payload)
	_ = h.service.UpdateProfile(c, &payload)
	c.JSON(200, gin.H{"status": "updated"})
}

func (h *Handler) GetNotifications(c *gin.Context) {
	prefs, _ := h.service.GetNotifications(c, "user-id")
	c.JSON(200, prefs)
}

func (h *Handler) UpdateNotifications(c *gin.Context) {
	var payload NotificationPreferences
	_ = c.ShouldBindJSON(&payload)
	_ = h.service.UpdateNotifications(c, &payload)
	c.JSON(200, gin.H{"status": "updated"})
}

func (h *Handler) APIKeys(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "API key management initialized (generation pending secure key service)",
	})
}

func (h *Handler) Integrations(c *gin.Context) {
	c.JSON(200, []IntegrationConfig{})
}

func (h *Handler) Billing(c *gin.Context) {
	c.JSON(200, Subscription{
		Plan:   "free",
		Status: "active",
	})
}

func RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/profile", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "Settings profile endpoint alive"})
	})
}
