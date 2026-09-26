import type { NextConfig } from "next";
import './src/env';

/**
 * Security Headers
 *
 * Baseline browser-side hardening applied to every route via the `/(.*)`
 * rule in `headers()`. See SECURITY_HEADERS.md for the full design and for
 * how these coordinate with any future platform-level (vercel.json) headers.
 *
 * Environment differences:
 * - Strict-Transport-Security is production-only: a dev-mode max-age could
 *   lock browsers out of plain http://localhost.
 * - The dev CSP allows 'unsafe-eval' and ws:/wss: so Next.js hot reload works;
 *   production drops both.
 * - script-src keeps 'unsafe-inline' because Next.js injects inline bootstrap
 *   scripts and no nonce/hash strategy exists yet. Tightening this requires a
 *   nonce-based script-src (see SECURITY_HEADERS.md → Future work).
 */
function buildSecurityHeaders(): { key: string; value: string }[] {
  const isProduction = process.env.NODE_ENV === 'production';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  // Must stay in sync with images.remotePatterns so third-party images are
  // never blocked by the CSP once it is enforced.
  const imageSources = [
    'https://images.unsplash.com',
    'https://*.pinata.cloud',
    'https://cdn.jsdelivr.net',
    'https://*.stellar.org',
  ].join(' ');

  const scriptSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  // API calls (direct calls to the configured API base URL must not be
  // blocked), plus WebSocket for HMR in dev.
  const connectSrc = isProduction
    ? `'self' ${apiBaseUrl}`
    : `'self' ${apiBaseUrl} ws: wss:`;

  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${imageSources}`,
    "font-src 'self' data: https://cdn.jsdelivr.net",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Content-Security-Policy', value: contentSecurityPolicy },
    ...(isProduction
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ]
      : []),
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.pinata.cloud',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.stellar.org',
        pathname: '/**',
      },
    ],
    // Enable image optimization with caching
    unoptimized: false,
    minimumCacheTTL: 31536000, // 1 year for cached images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp', 'image/avif'],
  },

  // Compression for text-based responses (gzip/brotli)
  compress: true,

  // Enable React Strict Mode for better development
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Optimize server components
    optimizeCss: true,
  },

  // Enable Turbo for faster dev builds
  turbopack: {
    resolveAlias: {
      '@': './src',
    },
  },

  /**
   * Cache Headers Configuration
   * Defines caching strategies for different asset types to optimize CDN performance
   * and reduce load times.
   */
  async headers() {
    return [
      // Baseline security headers for every route (see buildSecurityHeaders above)
      {
        source: '/(.*)',
        headers: buildSecurityHeaders(),
      },
      // Static assets (JS, CSS, chunks) - 1 year immutable
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Static assets (build ID) - 1 year immutable
      {
        source: '/_next/static/:buildId/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Images from Next.js image optimization - 1 year immutable
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Fonts - 1 year immutable
      {
        source: '/_next/static/chunks/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Favicon - 1 day
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable',
          },
        ],
      },
      // Public assets - 1 day
      {
        source: '/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Manifest files - 1 hour
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
      // Site.webmanifest - 1 day
      {
        source: '/site.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },

  /**
   * Redirects Configuration
   */
  async redirects() {
    return [
      {
        source: '/corporate',
        destination: '/',
        permanent: true,
      },
      {
        source: '/dashboard',
        destination: '/',
        permanent: true,
      },
    ];
  },

  /**
   * Rewrites Configuration
   * Optional API proxy for development and production
   */
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  // On-demand revalidation for ISR
  // This allows you to revalidate pages via API calls
  // https://nextjs.org/docs/app/building-your-application/data-fetching/revalidating#on-demand-revalidation
  // Uncomment and configure as needed:
  // experimental: {
  //   ...nextConfig.experimental,
  //   // Enable on-demand revalidation
  //   // revalidateSecret: process.env.REVALIDATE_SECRET,
  // },
};

export default nextConfig;