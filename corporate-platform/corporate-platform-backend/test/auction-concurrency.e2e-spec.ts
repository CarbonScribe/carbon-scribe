import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { BidProcessorService } from '../src/auction/services/bid-processor.service';
import { DutchAuctionService } from '../src/auction/services/dutch-auction.service';
import { PrismaService } from '../src/shared/database/prisma.service';

// Point TEST_DATABASE_URL at a dedicated database with migrations applied.
const describeWithDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase('auction bid concurrency (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let processor: BidProcessorService;
  let companyId: string;
  let userId: string;
  let projectId: string;
  let creditId: string;
  let auctionId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 20 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    processor = new BidProcessorService(prisma as PrismaService, new DutchAuctionService());
    const company = await prisma.company.create({ data: { name: 'Auction concurrency test' } });
    companyId = company.id;
    const user = await prisma.user.create({ data: {
      email: `${companyId}@auction-test.invalid`, password: 'test', firstName: 'Test',
      lastName: 'User', role: 'admin', companyId,
    } });
    userId = user.id;
    const project = await prisma.project.create({ data: { name: 'Auction test', startDate: new Date() } });
    projectId = project.id;
    const credit = await prisma.credit.create({ data: {
      projectId, projectName: project.name, availableAmount: 100, totalAmount: 100,
    } });
    creditId = credit.id;
    const now = Date.now();
    const auction = await prisma.auction.create({ data: {
      creditId, quantity: 5, remaining: 5, startPrice: 10, currentPrice: 10,
      floorPrice: 10, priceDecrement: 0, decrementInterval: 1,
      startTime: new Date(now - 1000), endTime: new Date(now + 60000),
      lastPriceUpdate: new Date(now), status: 'active',
    } });
    auctionId = auction.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (auctionId) {
      await prisma.bid.deleteMany({ where: { auctionId } });
      await prisma.auction.deleteMany({ where: { id: auctionId } });
    }
    if (creditId) await prisma.credit.deleteMany({ where: { id: creditId } });
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('serializes retries and competing bids without overselling', async () => {
    const place = (key: string) => processor.processBid(auctionId, userId, companyId,
      { bidPrice: 10, quantity: 1, idempotencyKey: key });
    const retries = await Promise.all(Array.from({ length: 5 }, () => place('same-key')));
    expect(new Set(retries.map((bid) => bid.id)).size).toBe(1);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) => place(`bid-${index}`)),
    );
    const accepted = results.filter((result) => result.status === 'fulfilled');
    expect(accepted).toHaveLength(4);
    const bids = await prisma.bid.findMany({ where: { auctionId } });
    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(bids).toHaveLength(5);
    expect(bids.filter((bid) => bid.idempotencyKey === 'same-key')).toHaveLength(1);
    expect(auction.remaining).toBe(0);
    expect(auction.status).toBe('ended');
    await expect(prisma.auction.update({ where: { id: auctionId }, data: { remaining: -1 } })).rejects.toThrow();
  }, 30000);
});
