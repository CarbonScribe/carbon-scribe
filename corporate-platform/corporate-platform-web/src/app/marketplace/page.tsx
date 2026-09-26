import { Suspense } from 'react';
import MarketplaceClient from './MarketplaceClient';

/**
 * ISR Configuration
 * Revalidate the marketplace page every 60 seconds to keep credit listings fresh
 * while maintaining static generation benefits
 */
export const revalidate = 60;

/**
 * Static Generation Configuration
 * Force static generation with dynamic parameters allowed
 * This enables ISR with fallback behavior for marketplace pages
 */
export const dynamic = 'force-static';
export const dynamicParams = true;

/**
 * Generate static params for ISR
 * This ensures the marketplace page is pre-rendered at build time
 * with support for dynamic routes (auctions, credit details)
 */
export function generateStaticParams() {
  // For the main marketplace page, we just need a single entry
  // Dynamic routes like /marketplace/:id will be handled by dynamicParams
  return [{ page: '1' }];
}

export default function MarketplacePage() {
  return (
    <Suspense 
      fallback={
        <div className="p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-corporate-blue border-t-transparent" />
            <span className="text-gray-500 dark:text-gray-400">Loading marketplace...</span>
          </div>
        </div>
      }
    >
      <MarketplaceClient />
    </Suspense>
  );
}