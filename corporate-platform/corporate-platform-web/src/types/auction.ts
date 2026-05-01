// Auction status lifecycle
export type AuctionStatus = 'pending' | 'active' | 'ended' | 'settled' | 'cancelled';

// Bid status after processing
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'outbid';

/** Minimal credit info returned inside an auction response */
export interface AuctionCredit {
  id: string;
  projectName?: string;
  country?: string;
  methodology?: string;
  vintage?: number;
  verificationStandard?: string;
}

/** Full auction entity as returned by the backend */
export interface Auction {
  id: string;
  creditId: string;
  quantity: number;
  remaining: number;
  startPrice: number;
  currentPrice: number;
  floorPrice: number;
  priceDecrement: number;
  decrementInterval: number; // minutes between price drops
  startTime: string;
  endTime: string;
  lastPriceUpdate: string;
  status: AuctionStatus;
  winnerId?: string;
  finalPrice?: number;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  credit?: AuctionCredit;
  bids?: Bid[];
}

/** A single bid placed on an auction */
export interface Bid {
  id: string;
  auctionId: string;
  userId: string;
  companyId: string;
  bidPrice: number;
  quantity: number;
  status: BidStatus;
  createdAt: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

/** POST /auctions/:id/bids payload */
export interface PlaceBidPayload {
  bidPrice: number;
  quantity: number;
}

/** POST /auctions payload */
export interface CreateAuctionPayload {
  creditId: string;
  quantity: number;
  startPrice: number;
  floorPrice: number;
  priceDecrement: number;
  decrementInterval: number;
  startTime: string;
  endTime: string;
}
