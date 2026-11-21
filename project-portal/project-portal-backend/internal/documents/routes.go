package documents

import (
	"carbon-scribe/project-portal/project-portal-backend/pkg/security"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes wires all document endpoints under the given router group.
// Expected base: /api/v1 (caller's group).
//
// maxUploadBytes overrides the global default body-size limit (#797) for
// every route under /documents, including the non-upload ones — a GET/List
// request never sends a body large enough to matter, so there's no benefit
// to a tighter limit just for those, and splitting the group further would
// only add complexity.
func RegisterRoutes(v1 *gin.RouterGroup, h *Handler, maxUploadBytes int64) {
	docs := v1.Group("/documents")
	docs.Use(security.BodyLimit(maxUploadBytes))
	{
		// Core CRUD
		docs.POST("/upload", h.Upload)
		docs.GET("", h.List)
		docs.GET("/:id", h.Download)
		docs.GET("/:id/metadata", h.GetMetadata)
		docs.DELETE("/:id", h.Delete)

		// Versioning
		docs.POST("/:id/versions", h.UploadVersion)
		docs.GET("/:id/versions", h.ListVersions)
		docs.GET("/:id/versions/:version", h.GetVersion)

		// PDF Generation
		docs.POST("/generate-pdf", h.GeneratePDF)

		// Digital Signature Verification
		docs.POST("/:id/verify-signature", h.VerifySignature)

		// Compliance Workflow Engine
		docs.POST("/:id/transition", h.Transition)
		docs.GET("/:id/workflow", h.GetWorkflowState)
		docs.POST("/workflows", h.CreateWorkflowTemplate)
		docs.GET("/workflows", h.ListWorkflowTemplates)
	}
}
