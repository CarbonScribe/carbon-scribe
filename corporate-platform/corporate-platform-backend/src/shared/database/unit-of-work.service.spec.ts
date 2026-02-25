import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { UnitOfWorkService } from './unit-of-work.service';

describe('UnitOfWorkService', () => {
  let service: UnitOfWorkService;
  let prisma: PrismaService;

  const mockTx = {
    company: { create: jest.fn(), findMany: jest.fn() },
    user: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitOfWorkService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(mockTx)),
          },
        },
      ],
    }).compile();

    service = module.get<UnitOfWorkService>(UnitOfWorkService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('run() executes fn with transaction client and returns result', async () => {
    mockTx.company.create.mockResolvedValue({ id: 'c1', name: 'Acme' });
    const result = await service.run(async (tx) => {
      return tx.company.create({ data: { name: 'Acme' } });
    });
    expect(result).toEqual({ id: 'c1', name: 'Acme' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('run() propagates errors and triggers rollback', async () => {
    await expect(
      service.run(async () => {
        throw new Error('Intentional failure');
      }),
    ).rejects.toThrow('Intentional failure');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
