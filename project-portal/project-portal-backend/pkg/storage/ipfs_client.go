// Package storage includes the IPFS HTTP client for pinning documents to IPFS.
// It communicates with a Kubo (go-ipfs) node via its HTTP RPC API (/api/v0/*).
// No third-party libraries are required — only stdlib net/http is used.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

// IPFSClient wraps the Kubo HTTP API for file pinning and retrieval.
type IPFSClient struct {
	nodeURL    string // e.g. "http://localhost:5001"
	httpClient *http.Client
}

// IPFSAddResult is the JSON response from POST /api/v0/add.
type IPFSAddResult struct {
	Name string `json:"Name"`
	Hash string `json:"Hash"` // The CID (e.g. "Qm…" or "bafy…")
	Size string `json:"Size"`
}

// NewIPFSClient creates an IPFS client pointed at the given Kubo node URL.
// nodeURL example: "http://localhost:5001"
func NewIPFSClient(nodeURL string) *IPFSClient {
	return &IPFSClient{
		nodeURL: strings.TrimRight(nodeURL, "/"),
		httpClient: &http.Client{
			Timeout: 5 * time.Minute, // large files may take time
		},
	}
}

// Add streams reader content to the IPFS node and returns the resulting CID.
// The file is pinned by default (pin=true in the query string).
func (c *IPFSClient) Add(ctx context.Context, filename string, r io.Reader) (*IPFSAddResult, error) {
	// Build a multipart/form-data body with the file under field "file".
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)

	part, err := mw.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return nil, fmt.Errorf("ipfs: failed to create form file: %w", err)
	}
	if _, err := io.Copy(part, r); err != nil {
		return nil, fmt.Errorf("ipfs: failed to copy content to form: %w", err)
	}
	if err := mw.Close(); err != nil {
		return nil, fmt.Errorf("ipfs: failed to close multipart writer: %w", err)
	}

	url := fmt.Sprintf("%s/api/v0/add?pin=true&quieter=false", c.nodeURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &body)
	if err != nil {
		return nil, fmt.Errorf("ipfs: failed to build request: %w", err)
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ipfs: add request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ipfs: add returned status %d: %s", resp.StatusCode, string(msg))
	}

	var result IPFSAddResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ipfs: failed to decode add response: %w", err)
	}
	if result.Hash == "" {
		return nil, fmt.Errorf("ipfs: add returned empty CID")
	}
	return &result, nil
}

// AddBytes is a convenience wrapper around Add for in-memory content.
func (c *IPFSClient) AddBytes(ctx context.Context, filename string, data []byte) (*IPFSAddResult, error) {
	return c.Add(ctx, filename, bytes.NewReader(data))
}

// Pin explicitly pins an already-added CID so it is not garbage-collected.
func (c *IPFSClient) Pin(ctx context.Context, cid string) error {
	url := fmt.Sprintf("%s/api/v0/pin/add?arg=%s", c.nodeURL, cid)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return fmt.Errorf("ipfs: failed to build pin request: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("ipfs: pin request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ipfs: pin returned status %d: %s", resp.StatusCode, string(msg))
	}
	return nil
}

// GatewayURL returns the public IPFS gateway URL for a CID.
// Uses the Cloudflare public gateway by default; suitable for browser links.
func GatewayURL(cid string) string {
	return fmt.Sprintf("https://cloudflare-ipfs.com/ipfs/%s", cid)
}

// IsAvailable does a lightweight /api/v0/version health-check against the node.
func (c *IPFSClient) IsAvailable(ctx context.Context) bool {
	url := fmt.Sprintf("%s/api/v0/version", c.nodeURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return false
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
