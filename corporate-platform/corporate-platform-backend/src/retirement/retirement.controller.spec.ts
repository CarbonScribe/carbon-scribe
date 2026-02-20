import { Test, TestingModule } from '@nestjs/testing';
import { RetirementController } from './retirement.controller';
import { InstantRetirementService } from './services/instant-retirement.service';
import { HistoryService } from './services/history.service';
import { ValidationService } from './services/validation.service';
import { CertificateService } from './services/certificate.service';
import { PrismaService } from '../shared/database/prisma.service';

describe('RetirementController', () => {
  let controller: RetirementController;

  const mockInstantRetirementService = { retire: jest.fn() };
  const mockHistoryService = { getHistory: jest.fn(), getStats: jest.fn() };
  const mockValidationService = { validateRetirement: jest.fn() };
  const mockCertificateService = { generateCertificate: jest.fn() };
  const mockPrisma = { retirement: { findUnique: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetirementController],
      providers: [
        {
          provide: InstantRetirementService,
          useValue: mockInstantRetirementService,
        },
        { provide: HistoryService, useValue: mockHistoryService },
        { provide: ValidationService, useValue: mockValidationService },
        { provide: CertificateService, useValue: mockCertificateService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<RetirementController>(RetirementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call retire service', async () => {
    const dto = { creditId: 'cred1', amount: 10, purpose: 'scope1' };
    await controller.retireCredits(dto as any);
    expect(mockInstantRetirementService.retire).toHaveBeenCalled();
  });

  it('should return history', async () => {
    await controller.getHistory({});
    expect(mockHistoryService.getHistory).toHaveBeenCalled();
  });
});
