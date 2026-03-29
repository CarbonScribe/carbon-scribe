import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DetailsService } from './details.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreditRepository } from '../../shared/database/repositories/credit.repository';

describe('DetailsService', () => {
  let service: DetailsService;
  let creditRepo: { findFirst: jest.Mock };

  beforeEach(async () => {
    creditRepo = {
      findFirst: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailsService,
        { provide: PrismaService, useValue: {} },
        { provide: CreditRepository, useValue: creditRepo },
      ],
    }).compile();

    service = module.get<DetailsService>(DetailsService);
  });

  it('scopes lookup by companyId when provided', async () => {
    creditRepo.findFirst.mockResolvedValue({
      id: 'credit-1',
      companyId: 'company-a',
    });

    await service.getById('credit-1', 'company-a');

    expect(creditRepo.findFirst).toHaveBeenCalledWith({
      where: { id: 'credit-1', companyId: 'company-a' },
      include: { project: true },
    });
  });

  it('blocks cross-tenant ID probing by returning not found', async () => {
    creditRepo.findFirst.mockResolvedValue(null);

    await expect(service.getById('credit-1', 'company-b')).rejects.toThrow(
      NotFoundException,
    );
  });
});
