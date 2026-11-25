ALTER TABLE "Bid" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Bid_auctionId_userId_idempotencyKey_key"
  ON "Bid"("auctionId", "userId", "idempotencyKey");

ALTER TABLE "Auction" ADD CONSTRAINT "Auction_remaining_nonnegative_check"
  CHECK ("remaining" >= 0);
