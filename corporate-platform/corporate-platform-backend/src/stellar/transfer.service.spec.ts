import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { PrismaService } from '../shared/database/prisma.service';
import { InitiateTransferDto } from './dto/transfer.dto';

describe('TransferService', () => {
  let service: TransferService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: PrismaService,
          useValue: {
            creditTransfer: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initiate transfer', async () => {
    const dto: InitiateTransferDto = {
      purchaseId: 'order-1',
      companyId: 'company-1',
      projectId: 'proj-1',
      amount: 10,
      contractId: 'contract123',
      fromAddress: 'GB_FROM',
      toAddress: 'GB_TO',
    };

    (prisma.creditTransfer.create as jest.Mock).mockResolvedValue({
      id: 'transfer-1',
      ...dto,
      status: 'PENDING',
    } as any);

    // Provide mock secret to prevent simulating transfer actually running
    process.env.STELLAR_SECRET_KEY = '';

    const result = await service.initiateTransfer(dto);
    expect(result.id).toEqual('transfer-1');
    expect(prisma.creditTransfer.create).toHaveBeenCalled();
  });

  it('should get transfer status', async () => {
    (prisma.creditTransfer.findUnique as jest.Mock).mockResolvedValue({
      id: 'transfer-1',
      status: 'CONFIRMED',
    } as any);

    const result = await service.getTransferStatus('order-1');
    expect(result.status).toEqual('CONFIRMED');
    expect(prisma.creditTransfer.findUnique).toHaveBeenCalledWith({
      where: { purchaseId: 'order-1' },
    });
  });
});
