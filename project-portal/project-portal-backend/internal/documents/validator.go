package documents

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/gabriel-vasile/mimetype"
)

// ─── Constants ────────────────────────────────────────────────────────────────

// maxZIPBombRatio is the maximum allowed ratio of decompressed to compressed
// size for ZIP archives.  Anything above this threshold is treated as a
// potential ZIP bomb.
const maxZIPBombRatio = 100

// maxZIPDecompressedSize is the absolute ceiling (1 GB) on the total
// decompressed size we will tolerate when inspecting a ZIP archive.
const maxZIPDecompressedSize = 1 << 30 // 1 GiB

// ─── Magic-byte signatures ────────────────────────────────────────────────────

var (
	sigPDF  = []byte("%PDF")
	sigPNG  = []byte("\x89PNG\r\n\x1a\n")
	sigJPEG = []byte("\xFF\xD8\xFF")
	sigGIF  = []byte("GIF8")
	sigWEBP = []byte("RIFF") // bytes 0-3; bytes 8-11 must be "WEBP"
	sigPK   = []byte("PK\x03\x04")
)

// ─── Blocked extensions ───────────────────────────────────────────────────────

// blockedExtensions is the set of file extensions that are always rejected,
// regardless of content type.
var blockedExtensions = map[string]struct{}{
	".exe": {}, ".sh": {}, ".bat": {}, ".cmd": {}, ".msi": {},
	".scr": {}, ".com": {}, ".pif": {}, ".vbs": {}, ".js":  {},
	".jar": {}, ".py":  {}, ".rb":  {}, ".pl":  {}, ".ps1": {},
	".dll": {}, ".so":  {}, ".dylib": {},
}

// ─── MIME normalisation ───────────────────────────────────────────────────────

// mimeNormalisationMap maps non-canonical MIME types to their canonical form.
var mimeNormalisationMap = map[string]string{
	"application/x-zip-compressed":             "application/zip",
	"application/x-zip":                        "application/zip",
	"application/octet-stream":                 "", // must be validated by content
	"application/x-pdf":                        "application/pdf",
	"image/jpg":                                "image/jpeg",
	"image/pjpeg":                              "image/jpeg",
	"application/vnd.ms-word":                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/x-msword":                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel":                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/x-msexcel":                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/msword":                       "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

// NormaliseMIME returns the canonical MIME type for the given value. If the
// type is already canonical (or unknown), the original value is returned.
func NormaliseMIME(mime string) string {
	mime = strings.ToLower(strings.TrimSpace(mime))
	// Strip parameters (e.g. "text/plain; charset=utf-8" → "text/plain").
	if idx := strings.IndexByte(mime, ';'); idx != -1 {
		mime = strings.TrimSpace(mime[:idx])
	}
	if canonical, ok := mimeNormalisationMap[mime]; ok && canonical != "" {
		return canonical
	}
	return mime
}

// ─── ValidationResult ────────────────────────────────────────────────────────

// ValidationResult carries the outcome of a file validation.
type ValidationResult struct {
	// DetectedMIME is the MIME type detected from file content.
	DetectedMIME string
	// ClaimedMIME is the MIME type originally provided by the client.
	ClaimedMIME string
	// NormalisedMIME is the canonical form of DetectedMIME.
	NormalisedMIME string
	// FileType is the internal FileType constant derived from the detected content.
	FileType FileType
	// MIMEMismatch is true when the claimed type differs from the detected type.
	MIMEMismatch bool
}

// ─── FileValidator ────────────────────────────────────────────────────────────

// FileValidator performs content-based MIME type validation.
type FileValidator struct{}

// NewFileValidator returns a ready-to-use FileValidator.
func NewFileValidator() *FileValidator { return &FileValidator{} }

// Validate inspects the raw file bytes and the client-claimed MIME type,
// returning a ValidationResult or an error if the file should be rejected.
//
// Rejection reasons:
//   - Blocked executable extension
//   - File size exceeds maxUploadSize
//   - Detected MIME type is not in the allowed set
//   - Magic bytes do not match the detected/claimed MIME type
//   - ZIP bomb detected
func (v *FileValidator) Validate(data []byte, filename, claimedMIME string) (*ValidationResult, error) {
	// 1. Block dangerous extensions up front.
	ext := strings.ToLower(filepath.Ext(filename))
	if _, blocked := blockedExtensions[ext]; blocked {
		return nil, fmt.Errorf("file type not allowed: extension %q is blocked", ext)
	}

	// 2. Size guard.
	if int64(len(data)) > maxUploadSize {
		return nil, fmt.Errorf("file exceeds maximum allowed size of 100 MB")
	}

	// 3. Detect actual MIME from content using the mimetype library.
	detected := mimetype.Detect(data)
	detectedMIME := detected.String()
	// Strip parameters from the detected type.
	if idx := strings.IndexByte(detectedMIME, ';'); idx != -1 {
		detectedMIME = strings.TrimSpace(detectedMIME[:idx])
	}

	normDetected := NormaliseMIME(detectedMIME)
	normClaimed := NormaliseMIME(claimedMIME)

	mismatch := normDetected != normClaimed && normClaimed != ""

	// 4. Verify magic bytes independently for each expected type.
	if err := verifyMagicBytes(data, normDetected); err != nil {
		return nil, err
	}

	// 5. Check that the detected type is in the allowed set.
	ft, ok := allowedMIMETypes[normDetected]
	if !ok {
		// Try the raw detected value in case normalisation changed something
		// unexpected (defence in depth).
		ft, ok = allowedMIMETypes[detectedMIME]
		if !ok {
			return nil, fmt.Errorf("unsupported file type detected: %s", normDetected)
		}
	}

	// 6. ZIP bomb detection for ZIP-based files (ZIP, DOCX, XLSX).
	if ft == FileTypeZIP || ft == FileTypeDOCX || ft == FileTypeXLSX {
		if err := checkZIPBomb(data); err != nil {
			return nil, err
		}
	}

	// 7. Reject files where detected type doesn't match the claimed type.
	//    We do this after all content checks so mismatch errors carry the
	//    accurate detected type for audit logging.
	if mismatch {
		return nil, &ValidationMismatchError{
			Filename:     filename,
			ClaimedMIME:  claimedMIME,
			DetectedMIME: detectedMIME,
		}
	}

	return &ValidationResult{
		DetectedMIME:   detectedMIME,
		ClaimedMIME:    claimedMIME,
		NormalisedMIME: normDetected,
		FileType:       ft,
		MIMEMismatch:   false,
	}, nil
}

// ─── Magic-byte helpers ───────────────────────────────────────────────────────

// verifyMagicBytes checks that the raw bytes are consistent with detectedMIME.
func verifyMagicBytes(data []byte, detectedMIME string) error {
	switch detectedMIME {
	case "application/pdf":
		if !bytes.HasPrefix(data, sigPDF) {
			return fmt.Errorf("file content does not match PDF signature")
		}
	case "image/png":
		if !bytes.HasPrefix(data, sigPNG) {
			return fmt.Errorf("file content does not match PNG signature")
		}
	case "image/jpeg":
		if !bytes.HasPrefix(data, sigJPEG) {
			return fmt.Errorf("file content does not match JPEG signature")
		}
	case "image/gif":
		if !bytes.HasPrefix(data, sigGIF) {
			return fmt.Errorf("file content does not match GIF signature")
		}
	case "image/webp":
		// WEBP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
		if len(data) < 12 || !bytes.HasPrefix(data, sigWEBP) || string(data[8:12]) != "WEBP" {
			return fmt.Errorf("file content does not match WEBP signature")
		}
	case "application/zip",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		if !bytes.HasPrefix(data, sigPK) {
			return fmt.Errorf("file content does not match ZIP/Office Open XML signature (PK)")
		}
	}
	return nil
}

// ─── ZIP bomb detection ───────────────────────────────────────────────────────

// checkZIPBomb reads the ZIP central directory to sum up uncompressed sizes and
// rejects the archive if the ratio or absolute size is above the threshold.
func checkZIPBomb(data []byte) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		// Not a valid ZIP — the magic byte check should have caught this; fail
		// safe by rejecting.
		return fmt.Errorf("failed to parse ZIP archive: %w", err)
	}

	var totalUncompressed uint64
	for _, f := range r.File {
		totalUncompressed += f.UncompressedSize64
		if totalUncompressed > maxZIPDecompressedSize {
			return fmt.Errorf(
				"ZIP archive rejected: decompressed size exceeds %d bytes (potential ZIP bomb)",
				maxZIPDecompressedSize,
			)
		}
	}

	compressedSize := int64(len(data))
	if compressedSize > 0 && totalUncompressed > 0 {
		ratio := float64(totalUncompressed) / float64(compressedSize)
		if ratio > maxZIPBombRatio {
			return fmt.Errorf(
				"ZIP archive rejected: compression ratio %.0f:1 exceeds maximum of %d:1 (potential ZIP bomb)",
				ratio, maxZIPBombRatio,
			)
		}
	}

	return nil
}

// ─── Helper: read all bytes from an io.Reader safely ─────────────────────────

// readLimited reads at most limit+1 bytes from r.  If more than limit bytes
// are present the caller knows the file is too large without buffering the
// whole thing.
func readLimited(r io.Reader, limit int64) ([]byte, error) {
	return io.ReadAll(io.LimitReader(r, limit+1))
}
