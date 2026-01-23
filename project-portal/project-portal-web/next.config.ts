import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* No special config needed for Tailwind CSS v4 */

  // Use the new compiler options instead
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Optimize for your CarbonScribe project
  experimental: {
    optimizeCss: true, // Enable CSS optimization for Tailwind v4
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },

  // Environment variables for CarbonScribe
  env: {
    NEXT_PUBLIC_APP_NAME: "CarbonScribe Project Portal",
    NEXT_PUBLIC_APP_VERSION: "1.0.0",
  },
};

export default nextConfig;

// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;
