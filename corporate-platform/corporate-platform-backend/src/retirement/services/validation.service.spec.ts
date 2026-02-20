import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ValidationService', () => {
  let service: ValidationService;

  const mockPrisma = {
    credit: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if credit not found', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue(null);
    await expect(
      service.validateRetirement('comp1', 'cred1', 10),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if insufficient balance', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({
      id: 'cred1',
      available: 5,
    });
    await expect(
      service.validateRetirement('comp1', 'cred1', 10),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return valid if balance is sufficient', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({
      id: 'cred1',
      available: 20,
    });
    const result = await service.validateRetirement('comp1', 'cred1', 10);
    expect(result.valid).toBe(true);
  });
});
