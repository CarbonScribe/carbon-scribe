import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizeCss: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    const cspDirectives = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https:`,
      `connect-src 'self' ${process.env.NEXT_PUBLIC_REPORTS_API_URL || ''} ${process.env.NEXT_PUBLIC_INTEGRATIONS_API_URL || ''} https://api.mapbox.com https://*.tiles.mapbox.com https://challenges.cloudflare.com`,
      `font-src 'self' data:`,
      `object-src 'none'`,
      `media-src 'self'`,
      `frame-src 'self' https://challenges.cloudflare.com`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`,
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Content-Security-Policy', value: cspDirectives },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'CarbonScribe Project Portal',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

export default nextConfig;
