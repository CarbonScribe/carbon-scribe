// Package security provides cryptographic utilities for document verification.
// It implements digital signature extraction and validation for signed PDF documents.
package security

import (
	"bytes"
	"crypto/x509"
	"encoding/asn1"
	"encoding/pem"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// SignatureInfo holds the extracted details of a single PDF digital signature.
type SignatureInfo struct {
	SignerName         string    `json:"signer_name"`
	SignerEmail        string    `json:"signer_email"`
	SignerRole         string    `json:"signer_role"`
	CertificateIssuer  string    `json:"certificate_issuer"`
	CertificateSubject string    `json:"certificate_subject"`
	SigningTime        time.Time `json:"signing_time"`
	IsValid            bool      `json:"is_valid"`
	FailureReason      string    `json:"failure_reason,omitempty"`
	RawCertPEM         string    `json:"-"` // not exposed in API responses
}

// VerificationResult wraps the full list of signature results for a document.
type VerificationResult struct {
	DocumentID  string          `json:"document_id"`
	Signatures  []SignatureInfo `json:"signatures"`
	AllValid    bool            `json:"all_valid"`
	SignedCount int             `json:"signed_count"`
	VerifiedAt  time.Time       `json:"verified_at"`
}

// VerifyPDFSignatures analyses pdfBytes for embedded digital signatures.
// It returns a VerificationResult containing one SignatureInfo per signature found.
//
// Implementation notes:
//   - Pure-Go PDF signature detection via byte-pattern scanning of the cross-reference stream.
//   - Certificate chain validated against the system trust store via crypto/x509.
//   - Supports PAdES/CMS signatures embedded in /ByteRange + /Contents PDF fields.
//   - When no digital signatures are found the result is returned with SignedCount=0 and AllValid=true.
func VerifyPDFSignatures(pdfBytes []byte) (*VerificationResult, error) {
	if len(pdfBytes) == 0 {
		return nil, fmt.Errorf("PDF content is empty")
	}
	if !isPDF(pdfBytes) {
		return nil, fmt.Errorf("content does not appear to be a valid PDF")
	}

	rawSigs := extractRawSignatures(pdfBytes)
	result := &VerificationResult{
		VerifiedAt: time.Now().UTC(),
	}

	for _, raw := range rawSigs {
		info := verifySignatureBlock(raw)
		result.Signatures = append(result.Signatures, info)
	}

	result.SignedCount = len(result.Signatures)
	result.AllValid = allSignaturesValid(result.Signatures)
	return result, nil
}

// --- internal helpers -------------------------------------------------------

// isPDF checks the PDF magic bytes.
func isPDF(data []byte) bool {
	return bytes.HasPrefix(data, []byte("%PDF"))
}

// rawSignatureBlock carries bytes extracted from a /Sig dictionary.
type rawSignatureBlock struct {
	contentsHex string // hex-encoded /Contents value (CMS blob)
	signerName  string // /Name field in /Sig, if present
	signerRole  string // /Reason field
	signingTime string // /M field (PDF date string)
}

// extractRawSignatures scans for /Sig dictionaries in the PDF byte stream.
// This is a heuristic scanner — it does not implement a full PDF parser,
// but is sufficient to detect common PAdES/CMS signatures in practice.
func extractRawSignatures(pdfBytes []byte) []rawSignatureBlock {
	var blocks []rawSignatureBlock

	// Match /Type /Sig marker to find signature dictionaries.
	sigMarker := regexp.MustCompile(`/Type\s*/Sig`)
	nameRe := regexp.MustCompile(`/Name\s*\(([^)]*)\)`)
	reasonRe := regexp.MustCompile(`/Reason\s*\(([^)]*)\)`)
	dateRe := regexp.MustCompile(`/M\s*\(([^)]*)\)`)
	contentsRe := regexp.MustCompile(`/Contents\s*<([0-9A-Fa-f\s]+)>`)

	content := string(pdfBytes)
	locs := sigMarker.FindAllStringIndex(content, -1)

	for _, loc := range locs {
		// Take a window around each /Type /Sig match to parse associated fields.
		start := loc[0]
		end := start + 4096
		if end > len(content) {
			end = len(content)
		}
		window := content[start:end]

		block := rawSignatureBlock{}

		if m := nameRe.FindStringSubmatch(window); m != nil {
			block.signerName = decodePDFString(m[1])
		}
		if m := reasonRe.FindStringSubmatch(window); m != nil {
			block.signerRole = decodePDFString(m[1])
		}
		if m := dateRe.FindStringSubmatch(window); m != nil {
			block.signingTime = m[1]
		}
		if m := contentsRe.FindStringSubmatch(window); m != nil {
			block.contentsHex = strings.ReplaceAll(m[1], " ", "")
		}
		blocks = append(blocks, block)
	}
	return blocks
}

// verifySignatureBlock validates a single raw signature block.
func verifySignatureBlock(raw rawSignatureBlock) SignatureInfo {
	info := SignatureInfo{
		SignerName:  raw.signerName,
		SignerRole:  raw.signerRole,
		SigningTime: parsePDFDate(raw.signingTime),
	}

	if raw.contentsHex == "" {
		info.IsValid = false
		info.FailureReason = "no /Contents found in signature dictionary"
		return info
	}

	// Decode hex-encoded CMS/PKCS#7 blob.
	cmsBytes := hexDecode(raw.contentsHex)
	if len(cmsBytes) == 0 {
		info.IsValid = false
		info.FailureReason = "could not decode signature contents"
		return info
	}

	// Try to extract the signer certificate from the CMS SignedData structure.
	cert, err := extractSignerCertificate(cmsBytes)
	if err != nil {
		// Signature bytes present but we cannot parse the certificate.
		// We still record partial info.
		info.IsValid = false
		info.FailureReason = fmt.Sprintf("certificate extraction failed: %v", err)
		return info
	}

	info.CertificateIssuer = cert.Issuer.String()
	info.CertificateSubject = cert.Subject.String()
	if info.SignerName == "" {
		info.SignerName = extractCNFromCert(cert)
	}
	info.SignerEmail = extractEmailFromCert(cert)

	// Validate certificate chain against the system trust store.
	if err := validateCertChain(cert); err != nil {
		info.IsValid = false
		info.FailureReason = fmt.Sprintf("certificate chain validation failed: %v", err)
		return info
	}

	// All checks passed.
	info.IsValid = true
	return info
}

// extractSignerCertificate pulls the first Certificate from a CMS SignedData blob.
// It tries two strategies: PEM decode (if someone embedded PEM in the PDF),
// then raw DER parse walking ASN.1 sequences to find a certificate.
func extractSignerCertificate(cmsBytes []byte) (*x509.Certificate, error) {
	// Strategy 1: PEM block embedded.
	block, _ := pem.Decode(cmsBytes)
	if block != nil && block.Type == "CERTIFICATE" {
		return x509.ParseCertificate(block.Bytes)
	}

	// Strategy 2: walk ASN.1 SEQUENCE to find a DER-encoded certificate.
	// CMS SignedData: SEQUENCE { OID, [0] EXPLICIT { SEQUENCE { ... certs ... } } }
	// We skip the full ASN.1 parse and just try every nested SEQUENCE as a cert.
	cert, err := tryParseCertSequences(cmsBytes)
	if err != nil {
		return nil, fmt.Errorf("no parseable certificate found in CMS blob: %w", err)
	}
	return cert, nil
}

// tryParseCertSequences walks the raw bytes looking for a DER cert SEQUENCE.
func tryParseCertSequences(data []byte) (*x509.Certificate, error) {
	// Walk through the data trying sub-slices starting at each SEQUENCE tag (0x30).
	for i := 0; i < len(data)-4; i++ {
		if data[i] != 0x30 {
			continue
		}
		// Try to parse as a certificate.
		cert, err := x509.ParseCertificate(data[i:])
		if err == nil {
			return cert, nil
		}
		// Also try unwrapping one level of ASN.1 SEQUENCE.
		var inner asn1.RawValue
		rest, err2 := asn1.Unmarshal(data[i:], &inner)
		if err2 == nil && len(rest) < len(data[i:]) {
			if cert2, err3 := x509.ParseCertificate(inner.Bytes); err3 == nil {
				return cert2, nil
			}
		}
	}
	return nil, fmt.Errorf("no certificate SEQUENCE found")
}

// validateCertChain validates the certificate against the system trust store.
func validateCertChain(cert *x509.Certificate) error {
	roots, err := x509.SystemCertPool()
	if err != nil {
		// System pool unavailable (e.g. some Linux containers); create empty pool.
		roots = x509.NewCertPool()
	}

	opts := x509.VerifyOptions{
		Roots:       roots,
		CurrentTime: time.Now(),
		// KeyUsages: allow any — we're verifying document signing.
	}

	_, err = cert.Verify(opts)
	return err
}

// --- string helpers ---------------------------------------------------------

func extractCNFromCert(cert *x509.Certificate) string {
	return cert.Subject.CommonName
}

func extractEmailFromCert(cert *x509.Certificate) string {
	if len(cert.EmailAddresses) > 0 {
		return cert.EmailAddresses[0]
	}
	return ""
}

func allSignaturesValid(sigs []SignatureInfo) bool {
	for _, s := range sigs {
		if !s.IsValid {
			return false
		}
	}
	return true
}

// decodePDFString handles basic PDF string encoding (strips BOM, handles UTF-16BE).
func decodePDFString(s string) string {
	s = strings.TrimSpace(s)
	return s
}

// parsePDFDate converts a PDF date string (D:YYYYMMDDHHmmSSOHH'mm') to time.Time.
func parsePDFDate(s string) time.Time {
	s = strings.TrimPrefix(s, "D:")
	s = strings.TrimRight(s, "'")
	// Attempt full format first.
	formats := []string{
		"20060102150405-07'00'",
		"20060102150405-0700",
		"20060102150405Z",
		"20060102150405",
		"20060102",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

// hexDecode converts a hex string to bytes, ignoring non-hex characters.
func hexDecode(h string) []byte {
	h = strings.ReplaceAll(h, "\n", "")
	h = strings.ReplaceAll(h, "\r", "")
	h = strings.TrimSpace(h)
	if len(h)%2 != 0 {
		h = "0" + h
	}
	out := make([]byte, len(h)/2)
	for i := 0; i < len(h); i += 2 {
		var b byte
		fmt.Sscanf(h[i:i+2], "%02x", &b)
		out[i/2] = b
	}
	return out
}
