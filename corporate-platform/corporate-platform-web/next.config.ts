import type { NextConfig } from "next";
import { assertPublicEnv } from "./src/lib/env/validate";

// Validate public configuration as part of the build/dev pipeline so missing or
// malformed NEXT_PUBLIC_* values fail fast instead of surfacing as runtime
// errors. Production builds are strict (throw); dev startup logs warnings/errors
// without blocking local work that relies on built-in fallbacks.
assertPublicEnv({ strict: process.env.NODE_ENV === "production" });

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;