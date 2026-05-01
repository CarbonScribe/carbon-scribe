'use client';

import { useParams } from 'next/navigation';
import AuctionDetail from '@/components/marketplace/AuctionDetail';

export default function AuctionDetailPage() {
  const params = useParams();
  const auctionId =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : '';

  if (!auctionId) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
        Invalid auction ID.
      </p>
    );
  }

  return <AuctionDetail auctionId={auctionId} />;
}
