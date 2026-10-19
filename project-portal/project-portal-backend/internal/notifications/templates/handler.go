package templates

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler exposes managed-template CRUD over HTTP (issue #689). Every route
// it registers is admin-gated — see RegisterRoutes — since template
// content is sent to end users verbatim and must not be editable by an
// arbitrary authenticated caller.
type Handler struct {
	manager *TemplateManager
}

// NewHandler constructs a Handler backed by manager.
func NewHandler(manager *TemplateManager) *Handler {
	return &Handler{manager: manager}
}

// RegisterRoutes mounts managed-template CRUD directly on rg (the caller
// decides the resource path — see cmd/api/main.go, which mounts this at
// /api/v1/notification-templates, distinct from the root notifications
// package's own /api/v1/notifications/templates), gated to the admin role.
// rg is expected to already carry authentication middleware — RequireRole
// only checks the role an authenticated request already carries, it
// doesn't authenticate on its own.
//
//	POST   ""      – create a template
//	GET    ""      – list every template
//	GET    "/:id"  – fetch one template
//	PUT    "/:id"  – update a template (increments its Version)
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, requireAdmin gin.HandlerFunc) {
	rg.Use(requireAdmin)
	rg.POST("", h.Create)
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
	rg.PUT("/:id", h.Update)
}

// Create handles POST .../templates.
func (h *Handler) Create(c *gin.Context) {
	var req NotificationTemplate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tpl, err := h.manager.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tpl)
}

// Update handles PUT .../templates/:id.
func (h *Handler) Update(c *gin.Context) {
	var req NotificationTemplate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tpl, err := h.manager.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if errors.Is(err, ErrTemplateNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tpl)
}

// Get handles GET .../templates/:id.
func (h *Handler) Get(c *gin.Context) {
	tpl, err := h.manager.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, ErrTemplateNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tpl)
}

// List handles GET .../templates.
func (h *Handler) List(c *gin.Context) {
	items, err := h.manager.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"templates": items})
}
