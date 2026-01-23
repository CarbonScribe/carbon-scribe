package documents

import (
	"context"
	"io"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/pkg/storage"
)

type StorageProvider struct {
	s3   storage.S3Client
	ipfs storage.IPFSClient
}

func NewStorageProvider(s3 storage.S3Client, ipfs storage.IPFSClient) *StorageProvider {
	return &StorageProvider{
		s3:   s3,
		ipfs: ipfs,
	}
}

func (p *StorageProvider) UploadToS3(ctx context.Context, bucket, key string, body io.Reader) error {
	return p.s3.Upload(ctx, bucket, key, body)
}

func (p *StorageProvider) DownloadFromS3(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	return p.s3.Download(ctx, bucket, key)
}

func (p *StorageProvider) PinToIPFS(ctx context.Context, body io.Reader) (string, error) {
	return p.ipfs.PinFile(ctx, body)
}

func (p *StorageProvider) GenerateS3Key(projectID, docType, fileName string) string {
	return fmt.Sprintf("projects/%s/documents/%s/%s", projectID, docType, fileName)
}
