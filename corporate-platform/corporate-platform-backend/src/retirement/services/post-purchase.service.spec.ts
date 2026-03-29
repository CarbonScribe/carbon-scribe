import { Test, TestingModule } from '@nestjs/testing';
import { PostPurchaseService } from './post-purchase.service';
import { TransferService } from '../../stellar/transfer.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('PostPurchaseService', () => {
  let service: PostPurchaseService;
  let transferService: jest.Mocked<TransferService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostPurchaseService,
        {
          provide: TransferService,
          useValue: {
            initiateTransfer: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            order: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PostPurchaseService>(PostPurchaseService);
    transferService = module.get(TransferService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should trigger transfer for each order item', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-1',
      companyId: 'company-1',
      items: [
        { id: 'item-1', credit: { projectId: 'proj-1' }, quantity: 10 },
        { id: 'item-2', credit: { projectId: 'proj-2' }, quantity: 20 },
      ],
    } as any);

    await service.handleOrderCompleted('order-1');
    expect(transferService.initiateTransfer).toHaveBeenCalledTimes(2);
    expect(transferService.initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        projectId: 'proj-1',
        amount: 10,
      }),
    );
  });
});
