export interface IBid {
  id: string;
  auctionId: string;
  userId: string;
  companyId: string;
  bidPrice: number;
  quantity: number;
  status: 'pending' | 'accepted' | 'rejected' | 'outbid';
  createdAt: Date;
}
