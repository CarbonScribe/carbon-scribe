package documents

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/pkg/storage"
)

// IPFSUploader wraps the IPFS client with document-layer helpers.
// It is optional — if nil, pinning is silently skipped.
type IPFSUploader struct {
	client    *storage.IPFSClient
	validator *FileValidator
}

// NewIPFSUploader creates an IPFSUploader.
func NewIPFSUploader(client *storage.IPFSClient) *IPFSUploader {
	return &IPFSUploader{
		client:    client,
		validator: NewFileValidator(),
	}
}

// PinDocument validates the document bytes and then pins them to IPFS,
// returning the CID.  It uses the document ID as the IPFS filename so the
// pin is identifiable.
//
// Validation rules applied before pinning:
//   - Size must not exceed maxUploadSize (100 MB).
//   - Content must pass magic-byte / MIME type validation.
//   - Executable file types are blocked.
//   - ZIP bombs are rejected.
//
// The filename parameter is used only for extension-level checks; passing an
// empty string skips extension validation.  Pass the original filename when
// available.
func (u *IPFSUploader) PinDocument(ctx context.Context, docID string, data []byte) (string, error) {
	return u.PinDocumentWithFilename(ctx, docID, data, "")
}

// PinDocumentWithFilename is like PinDocument but accepts the original filename
// so that the validator can check blocked extensions.
func (u *IPFSUploader) PinDocumentWithFilename(ctx context.Context, docID string, data []byte, filename string) (string, error) {
	if u == nil || u.client == nil {
		return "", nil // IPFS disabled — no-op
	}

	// 1. Enforce size limit.
	if int64(len(data)) > maxUploadSize {
		return "", fmt.Errorf("ipfs pin rejected: file exceeds maximum allowed size of 100 MB")
	}

	// 2. Content-based validation (magic bytes, blocked extensions, ZIP bombs).
	//    We pass an empty claimed MIME so the validator only checks content; it
	//    will not report a mismatch but will still reject truly invalid files.
	if filename == "" {
		// Use a safe placeholder extension; magic-byte check still runs.
		filename = docID + ".bin"
	}
	_, err := u.validator.Validate(data, filename, "")
	if err != nil {
		return "", fmt.Errorf("ipfs pin rejected: %w", err)
	}

	// 3. Pin to IPFS.
	result, err := u.client.AddBytes(ctx, docID+".pdf", data)
	if err != nil {
		return "", fmt.Errorf("ipfs pin failed: %w", err)
	}
	return result.Hash, nil
}
