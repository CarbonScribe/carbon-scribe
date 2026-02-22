package documents

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/pkg/storage"
)

// IPFSUploader wraps the IPFS client with document-layer helpers.
// It is optional — if nil, pinning is silently skipped.
type IPFSUploader struct {
	client *storage.IPFSClient
}

// NewIPFSUploader creates an IPFSUploader.
func NewIPFSUploader(client *storage.IPFSClient) *IPFSUploader {
	return &IPFSUploader{client: client}
}

// PinDocument pins the bytes of a document to IPFS and returns the CID.
// Uses the document ID as the IPFS filename so the pin is identifiable.
func (u *IPFSUploader) PinDocument(ctx context.Context, docID string, data []byte) (string, error) {
	if u == nil || u.client == nil {
		return "", nil // IPFS disabled — no-op
	}
	result, err := u.client.AddBytes(ctx, docID+".pdf", data)
	if err != nil {
		return "", fmt.Errorf("ipfs pin failed: %w", err)
	}
	return result.Hash, nil
}
