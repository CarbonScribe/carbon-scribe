package documents

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler holds the document service for use in HTTP handlers.
type Handler struct {
	svc *Service
}

// NewHandler creates a new document Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Transition handles POST /api/v1/documents/:id/transition
func (h *Handler) Transition(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}
	var req TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.AdvanceWorkflow(c.Request.Context(), id, &req, extractUserID(c))
	if err != nil {
		status := http.StatusBadRequest
		if containsAny(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GetWorkflowState handles GET /api/v1/documents/:id/workflow
func (h *Handler) GetWorkflowState(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}
	state, err := h.svc.GetWorkflowState(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, state)
}

// CreateWorkflowTemplate handles POST /api/v1/documents/workflows
func (h *Handler) CreateWorkflowTemplate(c *gin.Context) {
	var req CreateWorkflowTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	wf, err := h.svc.CreateWorkflowTemplate(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, wf)
}

// ListWorkflowTemplates handles GET /api/v1/documents/workflows
func (h *Handler) ListWorkflowTemplates(c *gin.Context) {
	wfs, err := h.svc.ListWorkflowTemplates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workflows": wfs, "total": len(wfs)})
}

// VerifySignature handles POST /api/v1/documents/:id/verify-signature
func (h *Handler) VerifySignature(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)
	result, err := h.svc.VerifySignature(ctx, id, userID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusInternalServerError
		if containsAny(err.Error(), "not found", "only supported for PDF") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GeneratePDF handles POST /api/v1/documents/generate-pdf
func (h *Handler) GeneratePDF(c *gin.Context) {
	var req GeneratePDFRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)

	doc, err := h.svc.GeneratePDF(ctx, &req, userID)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "pdf generation failed: unknown template_id" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "PDF generated and stored successfully",
		"document": doc,
	})
}

// Upload handles POST /api/v1/documents/upload
func (h *Handler) Upload(c *gin.Context) {
	var req UploadRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required"})
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)

	doc, err := h.svc.UploadFile(ctx, &req, fh, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "document uploaded successfully",
		"document": doc,
	})
}

// List handles GET /api/v1/documents
func (h *Handler) List(c *gin.Context) {
	var filter ListFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// Download handles GET /api/v1/documents/:id
// Returns a redirect to a presigned S3 URL so the client streams directly from S3.
func (h *Handler) Download(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)
	ipAddr := c.ClientIP()
	ua := c.Request.UserAgent()

	url, _, err := h.svc.GenerateDownloadURL(ctx, id, userID, ipAddr, ua)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GetMetadata handles GET /api/v1/documents/:id/metadata
func (h *Handler) GetMetadata(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)
	doc, err := h.svc.GetMetadata(ctx, id, userID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// Delete handles DELETE /api/v1/documents/:id
func (h *Handler) Delete(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)
	if err := h.svc.Delete(ctx, id, userID, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "document deleted successfully"})
}

// UploadVersion handles POST /api/v1/documents/:id/versions
func (h *Handler) UploadVersion(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	var req VersionUploadRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required"})
		return
	}

	ctx := c.Request.Context()
	userID := extractUserID(c)

	version, err := h.svc.UploadVersion(ctx, id, &req, fh, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "new version uploaded successfully",
		"version": version,
	})
}

// ListVersions handles GET /api/v1/documents/:id/versions
func (h *Handler) ListVersions(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	versions, err := h.svc.ListVersions(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"document_id": id,
		"versions":    versions,
		"total":       len(versions),
	})
}

// GetVersion handles GET /api/v1/documents/:id/versions/:version
func (h *Handler) GetVersion(c *gin.Context) {
	id, err := parseUUID(c, "id")
	if err != nil {
		return
	}

	versionNum, err := parseIntParam(c, "version")
	if err != nil {
		return
	}

	version, err := h.svc.GetVersion(c.Request.Context(), id, versionNum)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, version)
}

// --- helpers ---


// parseUUID extracts and validates a UUID path parameter.
func parseUUID(c *gin.Context, param string) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Param(param))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid " + param + " format"})
		return uuid.Nil, err
	}
	return id, nil
}

// extractUserID reads the X-User-ID header set by auth middleware.
// Returns nil if the header is absent (unauthenticated request).
func extractUserID(c *gin.Context) *uuid.UUID {
	raw := c.GetHeader("X-User-ID")
	if raw == "" {
		return nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil
	}
	return &id
}

// parseIntParam extracts an integer path parameter, writing a 400 error on failure.
func parseIntParam(c *gin.Context, param string) (int, error) {
	raw := c.Param(param)
	v, err := strconv.Atoi(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid " + param + ": must be an integer"})
		return 0, err
	}
	return v, nil
}

// containsAny returns true if s contains any of the provided substrings.
func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

