import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      credit: { findFirst: jest.fn(), update: jest.fn() },
      creditAvailabilityLog: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AvailabilityService);
  });

  it('decrements availability successfully', async () => {
    prisma.credit.findFirst.mockResolvedValueOnce({
      id: 'c1',
      availableAmount: 100,
      status: 'available',
    });
    prisma.credit.update.mockResolvedValueOnce({
      id: 'c1',
      availableAmount: 90,
      status: 'available',
    });

    const res = await service.decrementAvailability('c1', 10, 'u1', 'purchase');
    expect(prisma.credit.update).toHaveBeenCalled();
    expect(prisma.creditAvailabilityLog.create).toHaveBeenCalled();
    expect(res.availableAmount).toBe(90);
  });

  it('throws on insufficient availability', async () => {
    prisma.credit.findFirst.mockResolvedValueOnce({
      id: 'c1',
      availableAmount: 5,
      status: 'available',
    });
    await expect(service.decrementAvailability('c1', 10)).rejects.toThrow();
  });

  it('honors company scoping and throws when credit not found for tenant', async () => {
    // simulate no credit found for the provided companyId
    prisma.credit.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.decrementAvailability('c1', 10, 'u1', 'purchase', 'otherCompany'),
    ).rejects.toThrow();
    expect(prisma.credit.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', companyId: 'otherCompany' },
    });
  });
});
