package documents

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/storage"
)

// allowedMIMETypes maps MIME content types to our FileType enum.
var allowedMIMETypes = map[string]FileType{
	"application/pdf": FileTypePDF,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileTypeDOCX,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       FileTypeXLSX,
	"application/msword":           FileTypeDOCX,
	"application/vnd.ms-excel":     FileTypeXLSX,
	"image/jpeg":                   FileTypeImage,
	"image/png":                    FileTypeImage,
	"image/gif":                    FileTypeImage,
	"image/webp":                   FileTypeImage,
	"application/zip":              FileTypeZIP,
	"application/x-zip-compressed": FileTypeZIP,
}

// maxUploadSize is 100 MB.
const maxUploadSize = 100 * 1024 * 1024

// StorageService handles all file-level S3 operations.
type StorageService struct {
	s3 *storage.S3Client
}

// NewStorageService creates a StorageService backed by the given S3 client.
func NewStorageService(s3Client *storage.S3Client) *StorageService {
	return &StorageService{s3: s3Client}
}

// UploadFile validates, streams, and stores a multipart file to S3.
// Returns the S3 key, bucket, detected FileType, and actual file size.
func (s *StorageService) UploadFile(
	ctx context.Context,
	projectID string,
	docType DocumentType,
	fileHeader *multipart.FileHeader,
) (key string, bucket string, fileType FileType, size int64, err error) {
	// 1. Size guard
	if fileHeader.Size > maxUploadSize {
		return "", "", "", 0, fmt.Errorf("file exceeds maximum allowed size of 100 MB")
	}

	// 2. Detect content type from header
	contentType := fileHeader.Header.Get("Content-Type")
	ft, ok := allowedMIMETypes[contentType]
	if !ok {
		// Fallback: infer from extension
		ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
		ft, ok = extensionToFileType(ext)
		if !ok {
			return "", "", "", 0, fmt.Errorf("unsupported file type: %s", contentType)
		}
	}

	// 3. Build S3 key: projects/{project_id}/documents/{doc_type}/{timestamp}_{filename}
	safeFilename := sanitizeFilename(fileHeader.Filename)
	timestamp := time.Now().UTC().Format("20060102T150405")
	key = fmt.Sprintf(
		"projects/%s/documents/%s/%s_%s",
		projectID, strings.ToLower(string(docType)), timestamp, safeFilename,
	)

	// 4. Open and stream to S3
	file, err := fileHeader.Open()
	if err != nil {
		return "", "", "", 0, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer file.Close()

	result, err := s.s3.Upload(ctx, key, file, contentType)
	if err != nil {
		return "", "", "", 0, err
	}

	return result.Key, result.Bucket, ft, fileHeader.Size, nil
}

// UploadReader uploads from a plain io.Reader (used for generated PDFs etc).
func (s *StorageService) UploadReader(ctx context.Context, key string, r io.Reader, contentType string) (*storage.UploadResult, error) {
	return s.s3.Upload(ctx, key, r, contentType)
}

// GeneratePresignedURL returns a short-lived download URL.
func (s *StorageService) GeneratePresignedURL(ctx context.Context, key string) (string, error) {
	return s.s3.GeneratePresignedURL(ctx, key, 15*time.Minute)
}

// DownloadStream opens an S3 object for streaming.
func (s *StorageService) DownloadStream(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	return s.s3.DownloadStream(ctx, key)
}

// DownloadBytes downloads an S3 object fully into memory and returns the bytes.
// Use only for small/moderate files (e.g. PDFs to be analysed in-process).
func (s *StorageService) DownloadBytes(ctx context.Context, key string) ([]byte, error) {
	rc, _, err := s.s3.DownloadStream(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("s3 download failed: %w", err)
	}
	defer rc.Close()
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, rc); err != nil {
		return nil, fmt.Errorf("failed to read s3 stream: %w", err)
	}
	return buf.Bytes(), nil
}

// Delete removes a file from S3.
func (s *StorageService) Delete(ctx context.Context, key string) error {
	return s.s3.Delete(ctx, key)
}

// BucketName returns the configured bucket.
func (s *StorageService) BucketName() string {
	return s.s3.BucketName()
}

// --- helpers ---

func extensionToFileType(ext string) (FileType, bool) {
	m := map[string]FileType{
		".pdf":  FileTypePDF,
		".docx": FileTypeDOCX,
		".doc":  FileTypeDOCX,
		".xlsx": FileTypeXLSX,
		".xls":  FileTypeXLSX,
		".jpg":  FileTypeImage,
		".jpeg": FileTypeImage,
		".png":  FileTypeImage,
		".gif":  FileTypeImage,
		".webp": FileTypeImage,
		".zip":  FileTypeZIP,
	}
	ft, ok := m[ext]
	return ft, ok
}

func sanitizeFilename(name string) string {
	// Strip any path components and replace spaces with underscores.
	base := filepath.Base(name)
	return strings.ReplaceAll(base, " ", "_")
}
