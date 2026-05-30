/**
 * Helmet Configuration for HTTP Security Headers
 *
 * This module configures comprehensive HTTP hardening using helmet middleware.
 * It enforces industry-standard security headers to protect against common web vulnerabilities:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - Information leakage
 * - Protocol downgrade attacks
 *
 * @module HelmetConfig
 */

import { HelmetOptions } from 'helmet';

/**
 * Production-safe helmet configuration
 *
 * All headers are configured with strict, production-ready values.
 * Custom configurations are used for Swagger UI compatibility.
 */
export const HELMET_CONFIG: HelmetOptions = {
  // Content Security Policy (CSP)
  // Restricts resource loading and prevents inline script execution
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      scriptSrc: ["'self'", 'cdn.jsdelivr.net', 'swagger-ui.bundle.js', 'swagger-ui-standalone-preset.js'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
    },
    // Disable CSP in development for easier testing
    // Note: CSP can be strict and may require adjustments based on specific requirements
    crossOriginEmbedderPolicy: false,
  },

  // X-Frame-Options: Prevent clickjacking by denying frame embedding
  // SAMEORIGIN allows framing only from same origin
  frameguard: {
    action: 'SAMEORIGIN',
  },

  // X-Content-Type-Options: Prevent MIME sniffing
  // Forces browser to respect Content-Type header
  noSniff: true,

  // Strict-Transport-Security (HSTS)
  // Enforce HTTPS for all connections and subdomains
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },

  // Referrer-Policy: Control referrer information
  // 'strict-no-referrer' prevents referrer disclosure entirely
  referrerPolicy: {
    policy: 'strict-no-referrer',
  },

  // X-DNS-Prefetch-Control: Prevent DNS prefetching
  // Mitigates DNS-based side-channel attacks
  dnsPrefetchControl: {
    allow: false,
  },

  // Expect-CT: Expect Certificate Transparency
  // Warns about certificates not submitted to CT logs (deprecated in modern browsers)
  expectCT: {
    maxAge: 86400, // 24 hours in seconds
    enforce: false, // Set to false for reporting-only mode
  },

  // Cross-Origin-Resource-Policy (CORP)
  // Controls cross-origin resource loading
  crossOriginResourcePolicy: {
    policy: 'same-origin',
  },

  // Cross-Origin-Opener-Policy (COOP)
  // Isolates browsing context to prevent cross-origin attacks
  crossOriginOpenerPolicy: {
    policy: 'same-origin',
  },

  // Permissions-Policy (formerly Feature-Policy)
  // Restricts browser features and APIs
  permissionsPolicy: {
    features: {
      accelerometer: ["'none'"],
      camera: ["'none'"],
      geolocation: ["'none'"],
      gyroscope: ["'none'"],
      magnetometer: ["'none'"],
      microphone: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
    },
  },

  // X-XSS-Protection: Legacy XSS filter (mostly deprecated)
  // Set to block mode for older browsers
  xssFilter: true,

  // Note: Cross-Origin-Embedder-Policy (COEP) is NOT enabled by default
  // COEP can break cross-origin resource loading (e.g., Swagger UI, fonts, CDN resources)
  // Enable only if all cross-origin resources support CORS properly
  // crossOriginEmbedderPolicy: { policy: 'require-corp' },
};

/**
 * Custom CSP headers for development (less restrictive)
 * Use this configuration in non-production environments to ease development
 */
export const HELMET_CONFIG_DEVELOPMENT: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'unpkg.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'swagger-ui-bundle.js', 'unpkg.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http://localhost:*', 'http://127.0.0.1:*'],
      frameSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
    },
    crossOriginEmbedderPolicy: false,
  },
  frameguard: {
    action: 'SAMEORIGIN',
  },
  noSniff: true,
  hsts: {
    maxAge: 0, // Disabled in development
    includeSubDomains: false,
    preload: false,
  },
  referrerPolicy: {
    policy: 'no-referrer',
  },
  dnsPrefetchControl: {
    allow: true, // Allow DNS prefetching in development
  },
  expectCT: {
    maxAge: 0, // Disabled in development
    enforce: false,
  },
  crossOriginResourcePolicy: {
    policy: 'cross-origin', // More permissive in development
  },
  crossOriginOpenerPolicy: {
    policy: 'unsafe-none', // More permissive in development
  },
  permissionsPolicy: {
    features: {
      accelerometer: [],
      camera: [],
      geolocation: [],
      gyroscope: [],
      magnetometer: [],
      microphone: [],
      payment: [],
      usb: [],
    },
  },
  xssFilter: true,
};

/**
 * Get helmet configuration based on environment
 * @param isProduction - Whether running in production environment
 * @returns Helmet configuration object
 */
export function getHelmetConfig(isProduction: boolean = process.env.NODE_ENV === 'production'): HelmetOptions {
  return isProduction ? HELMET_CONFIG : HELMET_CONFIG_DEVELOPMENT;
}
