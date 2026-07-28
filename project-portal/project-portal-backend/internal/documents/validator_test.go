package documents

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Helpers to build synthetic file content ──────────────────────────────────

// buildPDF returns minimal bytes that satisfy both the mimetype library and our
// magic-byte check.
func buildPDF() []byte {
	return []byte("%PDF-1.4\n%some content\n%%EOF")
}

// buildPNG returns a valid 1×1 PNG image.
func buildPNG() []byte {
	// Minimal valid PNG: signature + IHDR + IDAT + IEND.
	return []byte{
		// PNG signature
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		// IHDR chunk (13 bytes data: width=1, height=1, bitdepth=8, colortype=2 RGB)
		0x00, 0x00, 0x00, 0x0D, // length
		0x49, 0x48, 0x44, 0x52, // "IHDR"
		0x00, 0x00, 0x00, 0x01, // width=1
		0x00, 0x00, 0x00, 0x01, // height=1
		0x08, 0x02, // bit depth 8, colour type 2 (RGB)
		0x00, 0x00, 0x00, // compression, filter, interlace
		0x90, 0x77, 0x53, 0xDE, // CRC
		// IDAT chunk (compressed pixel data)
		0x00, 0x00, 0x00, 0x0C, // length
		0x49, 0x44, 0x41, 0x54, // "IDAT"
		0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
		0xE2, 0x21, 0xBC, 0x33, // CRC
		// IEND chunk
		0x00, 0x00, 0x00, 0x00, // length
		0x49, 0x45, 0x4E, 0x44, // "IEND"
		0xAE, 0x42, 0x60, 0x82, // CRC
	}
}

// buildJPEG returns minimal JPEG bytes (SOI marker + EOI marker).
func buildJPEG() []byte {
	return []byte{
		0xFF, 0xD8, 0xFF, 0xE0, // SOI + APP0 marker
		0x00, 0x10, // APP0 length = 16
		0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
		0x01, 0x01, // version 1.1
		0x00,       // aspect ratio units
		0x00, 0x01, // X density
		0x00, 0x01, // Y density
		0x00, 0x00, // no thumbnail
		0xFF, 0xD9, // EOI
	}
}

// buildGIF returns minimal GIF87a bytes.
func buildGIF() []byte {
	return []byte{
		'G', 'I', 'F', '8', '9', 'a', // header "GIF89a"
		0x01, 0x00, // canvas width = 1
		0x01, 0x00, // canvas height = 1
		0x00,       // packed field
		0x00,       // background colour index
		0x00,       // pixel aspect ratio
		// Image descriptor
		0x2C,
		0x00, 0x00, 0x00, 0x00, // left, top
		0x01, 0x00, 0x01, 0x00, // width, height
		0x00,             // packed
		0x02,             // LZW minimum code size
		0x02, 0x4C, 0x01, // sub-block
		0x00, // block terminator
		0x3B, // trailer
	}
}

// buildWEBP returns minimal WEBP bytes.
func buildWEBP() []byte {
	// RIFF header + "WEBP" + VP8L chunk with a minimal lossless image.
	var buf bytes.Buffer
	buf.WriteString("RIFF")
	// File size (dummy — some decoders are lenient)
	buf.Write([]byte{0x24, 0x00, 0x00, 0x00})
	buf.WriteString("WEBP")
	buf.WriteString("VP8L")
	buf.Write([]byte{0x04, 0x00, 0x00, 0x00}) // chunk size
	// Minimal VP8L stream: signature 0x2F + 0 width/height bits
	buf.Write([]byte{0x2F, 0x00, 0x00, 0x00})
	return buf.Bytes()
}

// buildZIP returns a valid ZIP file containing one small entry.
func buildZIP(entries map[string][]byte) []byte {
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for name, content := range entries {
		f, _ := w.Create(name)
		f.Write(content)
	}
	w.Close()
	return buf.Bytes()
}

// buildZIPBomb returns a ZIP where the compression ratio far exceeds
// maxZIPBombRatio (but compresses to a few bytes).
func buildZIPBomb() []byte {
	// Write 10 MB of zeros into a zip entry — highly compressible.
	const decompressed = 10 * 1024 * 1024
	zeros := bytes.Repeat([]byte{0x00}, decompressed)
	return buildZIP(map[string][]byte{"bomb.txt": zeros})
}

// ─── NormaliseMIME ────────────────────────────────────────────────────────────

func TestNormaliseMIME(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"application/x-zip-compressed", "application/zip"},
		{"application/x-zip", "application/zip"},
		{"application/zip", "application/zip"},
		{"image/jpg", "image/jpeg"},
		{"image/jpeg", "image/jpeg"},
		{"application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
		{"application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
		// Parameters must be stripped.
		{"text/plain; charset=utf-8", "text/plain"},
		// Unknown types pass through unchanged.
		{"application/pdf", "application/pdf"},
		{"image/png", "image/png"},
		{"", ""},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			got := NormaliseMIME(tc.input)
			assert.Equal(t, tc.want, got)
		})
	}
}

// ─── FileValidator.Validate ───────────────────────────────────────────────────

func TestValidate_PDF(t *testing.T) {
	v := NewFileValidator()
	data := buildPDF()
	result, err := v.Validate(data, "document.pdf", "application/pdf")
	require.NoError(t, err)
	assert.Equal(t, FileTypePDF, result.FileType)
	assert.False(t, result.MIMEMismatch)
}

func TestValidate_PNG(t *testing.T) {
	v := NewFileValidator()
	data := buildPNG()
	result, err := v.Validate(data, "image.png", "image/png")
	require.NoError(t, err)
	assert.Equal(t, FileTypeImage, result.FileType)
	assert.False(t, result.MIMEMismatch)
}

func TestValidate_JPEG(t *testing.T) {
	v := NewFileValidator()
	data := buildJPEG()
	result, err := v.Validate(data, "photo.jpg", "image/jpeg")
	require.NoError(t, err)
	assert.Equal(t, FileTypeImage, result.FileType)
	assert.False(t, result.MIMEMismatch)
}

func TestValidate_GIF(t *testing.T) {
	v := NewFileValidator()
	data := buildGIF()
	result, err := v.Validate(data, "anim.gif", "image/gif")
	require.NoError(t, err)
	assert.Equal(t, FileTypeImage, result.FileType)
	assert.False(t, result.MIMEMismatch)
}

func TestValidate_ZIP(t *testing.T) {
	v := NewFileValidator()
	data := buildZIP(map[string][]byte{"readme.txt": []byte("hello")})
	result, err := v.Validate(data, "archive.zip", "application/zip")
	require.NoError(t, err)
	assert.Equal(t, FileTypeZIP, result.FileType)
	assert.False(t, result.MIMEMismatch)
}

func TestValidate_ZIP_NormalisedMIME(t *testing.T) {
	// Client sends non-canonical "application/x-zip-compressed" — should be
	// normalised and accepted.
	v := NewFileValidator()
	data := buildZIP(map[string][]byte{"readme.txt": []byte("hello")})
	result, err := v.Validate(data, "archive.zip", "application/x-zip-compressed")
	require.NoError(t, err)
	assert.Equal(t, FileTypeZIP, result.FileType)
	// After normalisation both sides agree, so MIMEMismatch must be false.
	assert.False(t, result.MIMEMismatch)
}

// ─── MIME mismatch detection ──────────────────────────────────────────────────

func TestValidate_MIMEMismatch_PDFClaimedAsImage(t *testing.T) {
	// File is PDF but client claims image/jpeg.
	v := NewFileValidator()
	data := buildPDF()
	_, err := v.Validate(data, "document.pdf", "image/jpeg")
	require.Error(t, err)
	var mismatch *ValidationMismatchError
	assert.ErrorAs(t, err, &mismatch, "should return ValidationMismatchError wrapped in file validation failed")
}

func TestValidate_MIMEMismatch_ExeAsJPEG(t *testing.T) {
	// DOS MZ executable with .jpg extension — blocked by magic bytes / type.
	v := NewFileValidator()
	data := []byte("MZ\x90\x00\x03\x00")
	_, err := v.Validate(data, "photo.jpg", "image/jpeg")
	require.Error(t, err)
}

func TestValidate_MIMEMismatch_PDFAsDocx(t *testing.T) {
	v := NewFileValidator()
	data := buildPDF()
	_, err := v.Validate(data, "file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	require.Error(t, err)
}

// ─── Spoofed Content-Type ─────────────────────────────────────────────────────

func TestValidate_SpoofedContentType_ZipAsPDF(t *testing.T) {
	// ZIP file with Content-Type: application/pdf — should be rejected.
	v := NewFileValidator()
	data := buildZIP(map[string][]byte{"evil.txt": []byte("payload")})
	_, err := v.Validate(data, "document.pdf", "application/pdf")
	require.Error(t, err)
}

func TestValidate_SpoofedExtension_PDFNamedExe(t *testing.T) {
	// .exe extension is always blocked regardless of content.
	v := NewFileValidator()
	data := buildPDF()
	_, err := v.Validate(data, "malware.exe", "application/pdf")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "blocked")
}

// ─── Blocked extensions ───────────────────────────────────────────────────────

func TestValidate_BlockedExtensions(t *testing.T) {
	v := NewFileValidator()
	blocked := []string{".exe", ".sh", ".bat", ".cmd", ".msi", ".scr", ".com", ".pif", ".vbs", ".jar", ".py", ".ps1", ".dll"}

	// Use PDF bytes so the content itself would be valid — only the extension
	// should trigger the rejection.
	data := buildPDF()
	for _, ext := range blocked {
		t.Run(ext, func(t *testing.T) {
			_, err := v.Validate(data, "payload"+ext, "application/pdf")
			require.Error(t, err, "extension %s should be blocked", ext)
			assert.Contains(t, err.Error(), "blocked")
		})
	}
}

// ─── ZIP bomb detection ───────────────────────────────────────────────────────

func TestValidate_ZIPBomb_Rejected(t *testing.T) {
	v := NewFileValidator()
	data := buildZIPBomb()
	// The compressed size will be tiny; ratio will exceed maxZIPBombRatio.
	_, err := v.Validate(data, "bomb.zip", "application/zip")
	require.Error(t, err)
	assert.Contains(t, strings.ToLower(err.Error()), "zip")
}

func TestValidate_NormalZIP_Accepted(t *testing.T) {
	v := NewFileValidator()
	// Build a ZIP with reasonably compressible content but well within ratio.
	data := buildZIP(map[string][]byte{
		"file1.txt": []byte("The quick brown fox jumps over the lazy dog."),
		"file2.txt": []byte("Some more regular text content here."),
	})
	_, err := v.Validate(data, "archive.zip", "application/zip")
	require.NoError(t, err)
}

// ─── Size limit ───────────────────────────────────────────────────────────────

func TestValidate_FileTooLarge(t *testing.T) {
	v := NewFileValidator()
	// Allocate slightly more than 100 MB.
	oversized := make([]byte, maxUploadSize+1)
	copy(oversized, buildPDF())
	_, err := v.Validate(oversized, "big.pdf", "application/pdf")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "100 MB")
}

// ─── Magic byte mismatches ────────────────────────────────────────────────────

func TestValidate_TruncatedPDF_Rejected(t *testing.T) {
	v := NewFileValidator()
	// File starts with "%PD" (missing final 'F') — not valid PDF magic bytes.
	data := []byte("%PD this is not a real pdf")
	_, err := v.Validate(data, "trunc.pdf", "application/pdf")
	require.Error(t, err)
}

func TestValidate_RandomBytes_Rejected(t *testing.T) {
	v := NewFileValidator()
	data := []byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08}
	_, err := v.Validate(data, "unknown.bin", "application/octet-stream")
	require.Error(t, err)
}

// ─── Unsupported file types ───────────────────────────────────────────────────

func TestValidate_UnsupportedType_Rejected(t *testing.T) {
	v := NewFileValidator()
	// A tiny MP3-like file (ID3 header).
	data := []byte("ID3\x03\x00\x00\x00\x00\x00\x00")
	_, err := v.Validate(data, "audio.mp3", "audio/mpeg")
	require.Error(t, err)
}

// ─── Empty claimed MIME (IPFS path) ──────────────────────────────────────────

func TestValidate_EmptyClaimedMIME_PDFAccepted(t *testing.T) {
	// When no claimed MIME is supplied (e.g. IPFS path), no mismatch is
	// reported — the file is judged solely on content.
	v := NewFileValidator()
	data := buildPDF()
	result, err := v.Validate(data, "document.bin", "")
	require.NoError(t, err)
	assert.Equal(t, FileTypePDF, result.FileType)
	assert.False(t, result.MIMEMismatch)
}

// ─── ValidationMismatchError ─────────────────────────────────────────────────

func TestValidationMismatchError_Message(t *testing.T) {
	err := &ValidationMismatchError{
		Filename:     "test.pdf",
		ClaimedMIME:  "image/jpeg",
		DetectedMIME: "application/pdf",
	}
	msg := err.Error()
	assert.Contains(t, msg, "test.pdf")
	assert.Contains(t, msg, "image/jpeg")
	assert.Contains(t, msg, "application/pdf")
}

// ─── verifyMagicBytes (internal) ─────────────────────────────────────────────

func TestVerifyMagicBytes_PDF_Pass(t *testing.T) {
	assert.NoError(t, verifyMagicBytes(buildPDF(), "application/pdf"))
}

func TestVerifyMagicBytes_PDF_Fail(t *testing.T) {
	data := []byte("NOT_A_PDF content here")
	assert.Error(t, verifyMagicBytes(data, "application/pdf"))
}

func TestVerifyMagicBytes_PNG_Pass(t *testing.T) {
	assert.NoError(t, verifyMagicBytes(buildPNG(), "image/png"))
}

func TestVerifyMagicBytes_PNG_Fail(t *testing.T) {
	assert.Error(t, verifyMagicBytes([]byte("not a png"), "image/png"))
}

func TestVerifyMagicBytes_JPEG_Pass(t *testing.T) {
	assert.NoError(t, verifyMagicBytes(buildJPEG(), "image/jpeg"))
}

func TestVerifyMagicBytes_JPEG_Fail(t *testing.T) {
	assert.Error(t, verifyMagicBytes([]byte("not a jpeg"), "image/jpeg"))
}

func TestVerifyMagicBytes_GIF_Pass(t *testing.T) {
	assert.NoError(t, verifyMagicBytes(buildGIF(), "image/gif"))
}

func TestVerifyMagicBytes_GIF_Fail(t *testing.T) {
	assert.Error(t, verifyMagicBytes([]byte("not a gif"), "image/gif"))
}

func TestVerifyMagicBytes_WEBP_Pass(t *testing.T) {
	assert.NoError(t, verifyMagicBytes(buildWEBP(), "image/webp"))
}

func TestVerifyMagicBytes_WEBP_Fail_ShortData(t *testing.T) {
	assert.Error(t, verifyMagicBytes([]byte("RIFF"), "image/webp"))
}

func TestVerifyMagicBytes_WEBP_Fail_WrongFourCC(t *testing.T) {
	data := make([]byte, 12)
	copy(data, "RIFF")
	copy(data[8:], "AVI ")
	assert.Error(t, verifyMagicBytes(data, "image/webp"))
}

func TestVerifyMagicBytes_ZIP_Pass(t *testing.T) {
	data := buildZIP(map[string][]byte{"a.txt": []byte("hi")})
	assert.NoError(t, verifyMagicBytes(data, "application/zip"))
}

func TestVerifyMagicBytes_ZIP_Fail(t *testing.T) {
	assert.Error(t, verifyMagicBytes([]byte("not a zip"), "application/zip"))
}

func TestVerifyMagicBytes_DOCX_Pass(t *testing.T) {
	data := buildZIP(map[string][]byte{"word/document.xml": []byte("<w:document/>")})
	assert.NoError(t, verifyMagicBytes(data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
}

func TestVerifyMagicBytes_XLSX_Pass(t *testing.T) {
	data := buildZIP(map[string][]byte{"xl/workbook.xml": []byte("<workbook/>")})
	assert.NoError(t, verifyMagicBytes(data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
}

// ─── checkZIPBomb (internal) ──────────────────────────────────────────────────

func TestCheckZIPBomb_Normal(t *testing.T) {
	data := buildZIP(map[string][]byte{
		"file.txt": []byte("just some normal text content"),
	})
	assert.NoError(t, checkZIPBomb(data))
}

func TestCheckZIPBomb_Detected(t *testing.T) {
	err := checkZIPBomb(buildZIPBomb())
	require.Error(t, err)
	assert.Contains(t, strings.ToLower(err.Error()), "zip")
}

func TestCheckZIPBomb_InvalidZIP(t *testing.T) {
	err := checkZIPBomb([]byte("PK this is not really a zip"))
	require.Error(t, err)
}

// ─── isValidationError ────────────────────────────────────────────────────────

func TestIsValidationError(t *testing.T) {
	cases := []struct {
		err    error
		expect bool
	}{
		{fmt.Errorf("file validation failed: bad content"), true},
		{fmt.Errorf("file type not allowed: extension \".exe\" is blocked"), true},
		{fmt.Errorf("unsupported file type detected: audio/mpeg"), true},
		{fmt.Errorf("file content does not match PDF signature"), true},
		{fmt.Errorf("ZIP archive rejected: compression ratio 200:1"), true},
		{fmt.Errorf("file exceeds maximum allowed size of 100 MB"), true},
		{fmt.Errorf("database connection refused"), false},
		{nil, false},
	}

	for _, tc := range cases {
		got := isValidationError(tc.err)
		assert.Equal(t, tc.expect, got, "error: %v", tc.err)
	}
}
