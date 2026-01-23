package documents

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	docs := rg.Group("/documents")
	{
		docs.POST("/upload", h.Upload)
		docs.GET("", h.List)
		docs.GET("/:id", h.Download)
		docs.GET("/:id/metadata", h.GetMetadata)
		docs.DELETE("/:id", h.Delete)
		docs.POST("/:id/versions", h.UploadVersion)
		docs.GET("/:id/versions", h.ListVersions)
		docs.GET("/:id/versions/:version", h.GetVersion)
		docs.POST("/generate-pdf", h.GeneratePDF)
		docs.POST("/:id/verify-signature", h.VerifySignature)
		docs.POST("/:id/transition", h.Transition)
		docs.GET("/:id/workflow", h.GetWorkflow)
		docs.POST("/:id/ocr", h.ExtractText)
		docs.PUT("/:id/storage-tier", h.UpdateStorageTier)
	}
}

func (h *Handler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	projectID, _ := uuid.Parse(c.PostForm("project_id"))
	docType := DocumentType(c.PostForm("document_type"))
	description := c.PostForm("description")

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()

	doc, err := h.service.UploadDocument(c.Request.Context(), UploadRequest{
		ProjectID:    projectID,
		Name:         file.Filename,
		Description:  description,
		DocumentType: docType,
		FileType:     FileTypePDF, // Simplified, should detect
		FileSize:     file.Size,
		FileContent:  f,
		UploadedBy:   uuid.New(), // Should come from auth context
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, doc)
}

func (h *Handler) List(c *gin.Context) {
	projectIDStr := c.Query("project_id")
	var projectID *uuid.UUID
	if projectIDStr != "" {
		id, _ := uuid.Parse(projectIDStr)
		projectID = &id
	}

	docTypeStr := c.Query("document_type")
	var docType *DocumentType
	if docTypeStr != "" {
		dt := DocumentType(docTypeStr)
		docType = &dt
	}

	docs, err := h.service.ListDocuments(c.Request.Context(), projectID, docType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, docs)
}

func (h *Handler) Download(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	reader, err := h.service.DownloadDocument(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer reader.Close()

	c.DataFromReader(http.StatusOK, -1, "application/pdf", reader, nil)
}

func (h *Handler) GetMetadata(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	doc, err := h.service.GetDocument(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}

	c.JSON(http.StatusOK, doc)
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.service.DeleteDocument(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) UploadVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	changeSummary := c.PostForm("change_summary")

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()

	version, err := h.service.UploadNewVersion(c.Request.Context(), id, VersionRequest{
		FileContent:   f,
		ChangeSummary: changeSummary,
		UploadedBy:    uuid.New(), // Should come from auth
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, version)
}

func (h *Handler) ListVersions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	versions, err := h.service.ListVersions(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, versions)
}

func (h *Handler) GetVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	versionNum, _ := strconv.Atoi(c.Param("version"))
	version, err := h.service.GetDocumentVersion(c.Request.Context(), id, versionNum)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if version == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "version not found"})
		return
	}

	c.JSON(http.StatusOK, version)
}

func (h *Handler) GeneratePDF(c *gin.Context) {
	var req struct {
		ProjectID    uuid.UUID   `json:"project_id"`
		TemplateID   string      `json:"template_id"`
		Data         interface{} `json:"data"`
		DocumentType DocumentType `json:"document_type"`
		Name         string      `json:"name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	doc, err := h.service.GeneratePDF(c.Request.Context(), GeneratePDFRequest{
		ProjectID:    req.ProjectID,
		TemplateID:   req.TemplateID,
		Data:         req.Data,
		DocumentType: req.DocumentType,
		Name:         req.Name,
		UploadedBy:   uuid.New(), // Should come from auth
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, doc)
}

func (h *Handler) VerifySignature(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	sigs, err := h.service.VerifySignature(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sigs)
}

func (h *Handler) Transition(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		Action string `json:"action"`
	}

	if err := h.service.TransitionWorkflow(c.Request.Context(), id, req.Action, uuid.New()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}

func (h *Handler) GetWorkflow(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	doc, err := h.service.GetDocument(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"document_id":  doc.ID,
		"status":       doc.Status,
		"workflow_id":  doc.WorkflowID,
		"current_step": doc.CurrentStep,
		"due_at":       doc.DueAt,
		"is_overdue":   doc.DueAt != nil && time.Now().After(*doc.DueAt),
	})
}

func (h *Handler) ExtractText(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	text, err := h.service.ExtractText(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"text": text})
}

func (h *Handler) UpdateStorageTier(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		Tier StorageTier `json:"tier"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.TransitionStorageTier(c.Request.Context(), id, req.Tier); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}
