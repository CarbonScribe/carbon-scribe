import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { PrismaService } from '../shared/database/prisma.service';
import { InitiateTransferDto } from './dto/transfer.dto';
import {
  SIGNING_PROVIDER_TRANSFER,
  SigningProvider,
} from './signing/signing-provider.interface';

describe('TransferService', () => {
  let service: TransferService;
  let prisma: jest.Mocked<PrismaService>;
  let signingProvider: jest.Mocked<SigningProvider>;

  beforeEach(async () => {
    // The service signs through SigningProvider (#542); it must never reach
    // for process.env.STELLAR_SECRET_KEY itself. isLive() false keeps the
    // async execution path in simulate mode.
    signingProvider = {
      keyId: 'test-transfer-key',
      category: 'transfer',
      getPublicKey: jest.fn().mockResolvedValue('GTEST'),
      signTransaction: jest.fn(),
      isLive: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<SigningProvider>;

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
        {
          provide: SIGNING_PROVIDER_TRANSFER,
          useValue: signingProvider,
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

    const result = await service.initiateTransfer(dto);
    expect(result.id).toEqual('transfer-1');
    expect(prisma.creditTransfer.create).toHaveBeenCalled();
  });

  /**
   * FE-069: a transfer that was just accepted is materially different from one
   * the network has acknowledged, and the UI renders the two distinctly.
   */
  it('creates transfers in the SUBMITTED state with a submittedAt stamp', async () => {
    const dto: InitiateTransferDto = {
      purchaseId: 'order-2',
      companyId: 'company-1',
      projectId: 'proj-1',
      amount: 10,
      contractId: 'contract123',
      fromAddress: 'GB_FROM',
      toAddress: 'GB_TO',
    };

    (prisma.creditTransfer.create as jest.Mock).mockResolvedValue({
      id: 'transfer-2',
      status: 'SUBMITTED',
    } as any);

    await service.initiateTransfer(dto);

    expect(prisma.creditTransfer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaseId: 'order-2',
        status: 'SUBMITTED',
        submittedAt: expect.any(Date),
      }),
    });
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
