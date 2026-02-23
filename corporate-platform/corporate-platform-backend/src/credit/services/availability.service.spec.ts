import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { CreditStatus } from '../dto/credit-update.dto';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    credit: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('decrementInventory', () => {
    it('should decrement inventory and update status if 0', async () => {
      const id = 'credit-1';
      const amount = 10;
      const mockCredit = { id, availableAmount: 10, status: CreditStatus.AVAILABLE };
      
      const mockTx = {
        credit: {
          findUnique: jest.fn().mockResolvedValue(mockCredit),
          update: jest.fn().mockResolvedValue({ ...mockCredit, availableAmount: 0, status: CreditStatus.RETIRED }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

      const result = await service.decrementInventory(id, amount);

      expect(result.availableAmount).toBe(0);
      expect(result.status).toBe(CreditStatus.RETIRED);
      expect(mockTx.credit.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          availableAmount: { decrement: amount },
          status: CreditStatus.RETIRED,
        },
      });
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      const id = 'credit-1';
      const amount = 20;
      const mockCredit = { id, availableAmount: 10, status: CreditStatus.AVAILABLE };
      
      const mockTx = {
        credit: {
          findUnique: jest.fn().mockResolvedValue(mockCredit),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

      await expect(service.decrementInventory(id, amount)).rejects.toThrow(BadRequestException);
    });
  });
});
