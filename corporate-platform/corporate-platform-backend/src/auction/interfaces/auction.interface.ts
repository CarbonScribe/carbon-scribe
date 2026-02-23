export interface IAuction {
  id: string;
  creditId: string;
  quantity: number;
  remaining: number;
  startPrice: number;
  currentPrice: number;
  floorPrice: number;
  priceDecrement: number;
  decrementInterval: number; // in minutes
  startTime: Date;
  endTime: Date;
  lastPriceUpdate: Date;
  status: 'pending' | 'active' | 'ended' | 'settled' | 'cancelled';
  winnerId?: string;
  finalPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}
