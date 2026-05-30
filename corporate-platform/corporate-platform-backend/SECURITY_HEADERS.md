# Security Headers Implementation Guide

## Overview

This document details the implementation of comprehensive HTTP security hardening using the Helmet middleware in the CarbonScribe Corporate Platform backend. The configuration protects against common web vulnerabilities while maintaining compatibility with Swagger UI and CORS policies.

## Integrated Security Headers

### 1. Content-Security-Policy (CSP)

**Purpose**: Restricts resource loading and prevents inline script execution, mitigating XSS attacks.

**Configuration**:
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
    scriptSrc: ["'self'", 'cdn.jsdelivr.net', 'swagger-ui-bundle.js'],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
  }
}
```

**Why It Matters**: 
- Prevents inline script execution, the most common XSS attack vector
- Restricts resource loading to trusted origins
- Development configuration is more permissive; production is stricter

**Swagger Compatibility**: Configured to allow Swagger UI CDN resources (cdn.jsdelivr.net, unpkg.com in dev).

### 2. X-Frame-Options (Frameguard)

**Purpose**: Prevents clickjacking attacks by controlling frame embedding.

**Configuration**:
```
X-Frame-Options: SAMEORIGIN
```

**Why It Matters**:
- Prevents the page from being embedded in iframes on external sites
- SAMEORIGIN allows framing only from the same origin
- Protects users from malicious frame hijacking

**Trade-offs**: None for API backend; affects frontend if embedded in iframes.

### 3. X-Content-Type-Options (No Sniff)

**Purpose**: Prevents MIME type sniffing vulnerabilities.

**Configuration**:
```
X-Content-Type-Options: nosniff
```

**Why It Matters**:
- Forces browsers to respect the Content-Type header
- Prevents attackers from tricking browsers into executing files as scripts
- No trade-offs; universally safe

### 4. Strict-Transport-Security (HSTS)

**Purpose**: Enforces secure HTTPS connections and prevents protocol downgrade attacks.

**Configuration (Production)**:
```typescript
hsts: {
  maxAge: 31536000,           // 1 year in seconds
  includeSubDomains: true,    // Apply to all subdomains
  preload: true,              // Enable HSTS preload list
}
```

**Configuration (Development)**:
```typescript
hsts: {
  maxAge: 0,                  // Disabled
  includeSubDomains: false,
  preload: false,
}
```

**Why It Matters**:
- Prevents man-in-the-middle attacks by forcing HTTPS
- Once set in production, browsers will only connect via HTTPS for 1 year
- Preload list integration ensures first-visit protection

**Important**: HSTS is only effective on HTTPS connections. Set in production only.

### 5. Referrer-Policy

**Purpose**: Controls how much referrer information is shared with external sites.

**Configuration**:
```
Referrer-Policy: strict-no-referrer
```

**Why It Matters**:
- Prevents sensitive information leakage through referrer headers
- Strict policy disables all referrer information
- Protects user privacy by default

**Trade-offs**: Some analytics and third-party services may not work properly.

### 6. X-DNS-Prefetch-Control

**Purpose**: Prevents DNS prefetching to mitigate DNS-based side-channel attacks.

**Configuration**:
```
X-DNS-Prefetch-Control: off
```

**Why It Matters**:
- Prevents DNS prefetching of external resources
- Reduces attack surface for DNS-based attacks
- Minimal performance impact

### 7. Expect-CT (Certificate Transparency)

**Purpose**: Warns about certificates not submitted to CT logs (reporting-only mode).

**Configuration**:
```typescript
expectCT: {
  maxAge: 86400,      // 24 hours
  enforce: false,     // Report-only mode
}
```

**Why It Matters**:
- Detects misissued certificates
- Report-only mode prevents legitimate access issues
- Modern browsers have native CT support

**Note**: This header is deprecated in modern browsers but provides additional protection in older ones.

### 8. Cross-Origin-Resource-Policy (CORP)

**Purpose**: Controls cross-origin resource loading.

**Configuration (Production)**:
```
Cross-Origin-Resource-Policy: same-origin
```

**Configuration (Development)**:
```
Cross-Origin-Resource-Policy: cross-origin
```

**Why It Matters**:
- Prevents cross-origin resource attacks
- Spectre/Meltdown mitigation
- More permissive in development for testing

### 9. Cross-Origin-Opener-Policy (COOP)

**Purpose**: Isolates browsing context to prevent cross-origin attacks.

**Configuration (Production)**:
```
Cross-Origin-Opener-Policy: same-origin
```

**Configuration (Development)**:
```
Cross-Origin-Opener-Policy: unsafe-none
```

**Why It Matters**:
- Prevents attackers from accessing window objects across origins
- Protects against speculative execution attacks
- More relaxed in development for easier testing

### 10. Permissions-Policy (formerly Feature-Policy)

**Purpose**: Restricts browser features and APIs.

**Configuration**:
```
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
```

**Why It Matters**:
- Explicitly denies unnecessary browser permissions
- Reduces attack surface by disabling unused features
- Prevents accidental permission grants

### 11. X-XSS-Protection (Legacy)

**Purpose**: Legacy XSS protection filter for older browsers.

**Configuration**:
```
X-XSS-Protection: 1; mode=block
```

**Why It Matters**:
- Provides fallback protection in older browsers
- Modern browsers rely on CSP instead
- No negative side effects

---

## Compatibility Considerations

### Swagger UI Compatibility ✅

The configuration explicitly supports Swagger UI:
- **CDN Resources**: cdn.jsdelivr.net and unpkg.com are allowed in CSP
- **Styles & Scripts**: unsafe-inline is permitted for Swagger UI styles
- **Fonts**: Google Fonts and CDN fonts are whitelisted

### CORS Integration ✅

- Helmet is applied **before** CORS to ensure proper header ordering
- Security headers are exposed via `exposedHeaders` to CORS clients
- CORS policies work independently; no conflicts

### Development vs. Production ✅

- **Development**: More permissive configuration for easier testing
- **Production**: Strict, hardened configuration for maximum security
- Configuration is automatically selected via `NODE_ENV`

---

## Notable Disabled Headers

### Cross-Origin-Embedder-Policy (COEP)

**Status**: Disabled (commented out)

**Reason**: COEP breaks cross-origin resource loading and can cause issues with:
- Swagger UI resources
- Font loading from Google Fonts
- CDN-hosted assets
- Third-party API integrations

**When to Enable**: Only if all cross-origin resources support CORS properly and you need Spectre/Meltdown additional protection.

---

## Implementation Details

### Integration in main.ts

```typescript
// Apply helmet middleware for comprehensive HTTP security hardening
// Helmet must be applied before CORS to ensure security headers are set correctly
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet(getHelmetConfig(isProduction)));
```

### Configuration Location

- **Configuration File**: `src/config/helmet.config.ts`
- **Exported Functions**:
  - `HELMET_CONFIG`: Production configuration
  - `HELMET_CONFIG_DEVELOPMENT`: Development configuration
  - `getHelmetConfig(isProduction)`: Returns appropriate config based on environment

---

## Verification

### Manual Testing

1. **Check Response Headers**: Use browser DevTools or curl:
   ```bash
   curl -i https://api.example.com/health
   ```

2. **Verify Header Presence**:
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security (production only)
   - Content-Security-Policy (full directive list)

### Automated Testing

See [Security Headers Test Suite](#security-headers-test-suite) section.

---

## Security Headers Test Suite

Run tests to verify header presence and correctness:

```bash
npm run test -- security-headers
```

### Test Cases

- ✅ All security headers are present in responses
- ✅ CSP directives are correctly configured
- ✅ HSTS maxAge is correct for production
- ✅ Swagger UI endpoints return appropriate CSP
- ✅ CORS headers are compatible with security headers
- ✅ No duplicate headers from conflicting configurations

---

## Maintenance & Updates

### When to Review

- After updating NestJS or Helmet versions
- When adding new CDN resources or third-party scripts
- During security audits
- When adding new API endpoints with special requirements

### Header Assessment Checklist

- [ ] All required headers are present
- [ ] Header values match security requirements
- [ ] Development and production configurations differ appropriately
- [ ] Swagger UI and CORS remain functional
- [ ] No console warnings or errors in browser
- [ ] Security headers don't break API integrations

---

## References

- [OWASP Secure Headers Project](https://secureheaders.com/)
- [Helmet Documentation](https://helmetjs.github.io/)
- [MDN Web Docs - HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Public Key Pinning (HPKP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Public_Key_Pinning)

---

## Support & Questions

For questions or issues related to security headers:

1. Check the Helmet documentation: https://helmetjs.github.io/
2. Review the configuration in `src/config/helmet.config.ts`
3. Consult OWASP guidelines for specific security scenarios
4. Open an issue for edge cases or incompatibilities

**Note**: Some headers may require adjustment based on specific use cases. Always test thoroughly before deploying to production.
