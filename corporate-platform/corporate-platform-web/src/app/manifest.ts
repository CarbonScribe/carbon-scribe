import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CarbonScribe Corporate Platform',
    short_name: 'CarbonScribe',
    description:
      'Purchase, manage, and retire carbon credits with transparent, on-chain verification',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#1a5db5',
    background_color: '#ffffff',
    categories: ['finance', 'business', 'sustainability'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
