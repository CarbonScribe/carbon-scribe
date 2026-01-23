package document

// IPFSUploader handles uploading documents to IPFS
type IPFSUploader struct {
	gatewayURL string
	apiKey     string
}

// NewIPFSUploader creates a new IPFS uploader
func NewIPFSUploader(gatewayURL, apiKey string) *IPFSUploader {
	return &IPFSUploader{
		gatewayURL: gatewayURL,
		apiKey:     apiKey,
	}
}

// Upload uploads a document to IPFS and returns the CID
func (u *IPFSUploader) Upload(data []byte, filename string) (string, error) {
	// Placeholder implementation
	return "", nil
}

// Download downloads a document from IPFS by CID
func (u *IPFSUploader) Download(cid string) ([]byte, error) {
	// Placeholder implementation
	return nil, nil
}
