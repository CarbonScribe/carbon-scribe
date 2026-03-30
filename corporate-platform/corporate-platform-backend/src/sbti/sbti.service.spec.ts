import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SbtiService } from './sbti.service';
import { TargetValidationService } from './services/target-validation.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { SubmissionService } from './services/submission.service';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { CreateTargetDto } from './dto/create-target.dto';

const mockTarget = {
  id: 'target-001',
  companyId: 'company-abc',
  targetType: 'NEAR_TERM',
  scope: 'ALL',
  baseYear: 2020,
  baseYearEmissions: 10000,
  targetYear: 2030,
  reductionPercentage: 50,
  status: 'DRAFT',
  validationId: null,
  validatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  progress: [],
};

const prismaMock = {
  sbtiTarget: {
    create: jest.fn().mockResolvedValue(mockTarget),
    findMany: jest.fn().mockResolvedValue([mockTarget]),
    findFirst: jest.fn().mockResolvedValue(mockTarget),
    update: jest.fn().mockResolvedValue({ ...mockTarget, status: 'VALIDATED' }),
  },
  retirement: {
    findMany: jest.fn().mockResolvedValue([
      { amount: 500, purpose: 'scope1', retiredAt: new Date() },
    ]),
  },
};

const securityMock = {
  logEvent: jest.fn().mockResolvedValue(undefined),
};

describe('SbtiService', () => {
  let service: SbtiService;
  let validationService: TargetValidationService;
  let progressService: ProgressTrackingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbtiService,
        TargetValidationService,
        ProgressTrackingService,
        SubmissionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SecurityService, useValue: securityMock },
      ],
    }).compile();

    service = module.get<SbtiService>(SbtiService);
    validationService = module.get<TargetValidationService>(TargetValidationService);
    progressService = module.get<ProgressTrackingService>(ProgressTrackingService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createTarget ───────────────────────────────────────────────────────────

  describe('createTarget', () => {
    const dto: CreateTargetDto = {
      targetType: 'NEAR_TERM',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2030,
      reductionPercentage: 50,
    };

    it('creates a target and returns it with validation result', async () => {
      prismaMock.sbtiTarget.create.mockResolvedValue(mockTarget);
      const result = await service.createTarget('company-abc', dto);
      expect(result.target.id).toBe('target-001');
      expect(result.validation).toBeDefined();
      expect(prismaMock.sbtiTarget.create).toHaveBeenCalledTimes(1);
      expect(securityMock.logEvent).toHaveBeenCalledTimes(1);
    });

    it('throws when companyId is missing', async () => {
      await expect(service.createTarget(undefined as any, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── listTargets ────────────────────────────────────────────────────────────

  describe('listTargets', () => {
    it('returns all targets for a company', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([mockTarget]);
      const result = await service.listTargets('company-abc');
      expect(result).toHaveLength(1);
      expect(prismaMock.sbtiTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-abc' } }),
      );
    });

    it('throws when companyId is missing', async () => {
      await expect(service.listTargets(undefined as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getTargetProgress ──────────────────────────────────────────────────────

  describe('getTargetProgress', () => {
    it('returns progress metrics for a target', async () => {
      prismaMock.sbtiTarget.findFirst.mockResolvedValue({
        ...mockTarget,
        progress: [
          {
            reportingYear: 2022,
            emissions: 8000,
            targetEmissions: 9000,
            variance: -11.11,
            onTrack: true,
          },
        ],
      });

      const result = await service.getTargetProgress(
        'company-abc',
        'target-001',
        {},
      );

      expect(result.target.id).toBe('target-001');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.targetId).toBe('target-001');
    });

    it('throws NotFoundException for unknown target', async () => {
      prismaMock.sbtiTarget.findFirst.mockResolvedValue(null);
      await expect(
        service.getTargetProgress('company-abc', 'bad-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── validateTarget ─────────────────────────────────────────────────────────

  describe('validateTarget', () => {
    it('validates a target and updates its status', async () => {
      prismaMock.sbtiTarget.findFirst.mockResolvedValue(mockTarget);
      prismaMock.sbtiTarget.update.mockResolvedValue({
        ...mockTarget,
        status: 'VALIDATED',
      });

      const result = await service.validateTarget('company-abc', 'target-001');
      expect(result.target.status).toBe('VALIDATED');
      expect(result.validation).toBeDefined();
      expect(securityMock.logEvent).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for unknown target', async () => {
      prismaMock.sbtiTarget.findFirst.mockResolvedValue(null);
      await expect(
        service.validateTarget('company-abc', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getDashboard ───────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns dashboard metrics', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([mockTarget]);
      const result = await service.getDashboard('company-abc');
      expect(result.totalTargets).toBe(1);
      expect(result.nearTermCoverage).toBe(true);
      expect(result.targets).toHaveLength(1);
    });

    it('returns zero metrics when no targets exist', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([]);
      const result = await service.getDashboard('company-abc');
      expect(result.totalTargets).toBe(0);
      expect(result.overallComplianceScore).toBe(0);
    });
  });

  // ─── getRetirementGap ───────────────────────────────────────────────────────

  describe('getRetirementGap', () => {
    it('calculates retirement gap from targets and retirements', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([mockTarget]);
      prismaMock.retirement.findMany.mockResolvedValue([
        { amount: 500, purpose: 'scope1', retiredAt: new Date() },
      ]);

      const result = await service.getRetirementGap('company-abc');
      expect(result.totalRetiredToDateTonnes).toBe(500);
      expect(result.gapAnalysis).toHaveLength(1);
      expect(result.gapAnalysis[0].requiredReductionTonnes).toBe(5000);
    });

    it('throws BadRequestException when no targets exist', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([]);
      await expect(
        service.getRetirementGap('company-abc'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getSubmissionPackage ───────────────────────────────────────────────────

  describe('getSubmissionPackage', () => {
    it('builds a submission package for existing targets', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([mockTarget]);

      const result = await service.getSubmissionPackage('company-abc');
      expect(result.submissionId).toMatch(/^SBTI-/);
      expect(result.companyId).toBe('company-abc');
      expect(result.targets).toHaveLength(1);
      expect(securityMock.logEvent).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when no targets exist', async () => {
      prismaMock.sbtiTarget.findMany.mockResolvedValue([]);
      await expect(
        service.getSubmissionPackage('company-abc'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

// ─── TargetValidationService ──────────────────────────────────────────────────

describe('TargetValidationService', () => {
  let service: TargetValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TargetValidationService],
    }).compile();
    service = module.get<TargetValidationService>(TargetValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('passes a valid near-term 1.5°C aligned target', () => {
    const result = service.validate({
      targetType: 'NEAR_TERM',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2030,
      reductionPercentage: 50,
    });
    expect(result.isValid).toBe(true);
    expect(result.overallScore).toBe(100);
  });

  it('fails a near-term target with insufficient annual reduction rate', () => {
    const result = service.validate({
      targetType: 'NEAR_TERM',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2030,
      reductionPercentage: 20, // ~2%/yr < 4.2% required
    });
    expect(result.isValid).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('passes a valid long-term target', () => {
    const result = service.validate({
      targetType: 'LONG_TERM',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2050,
      reductionPercentage: 90,
    });
    expect(result.isValid).toBe(true);
  });

  it('fails a long-term target with target year after 2050', () => {
    const result = service.validate({
      targetType: 'LONG_TERM',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2055,
      reductionPercentage: 90,
    });
    expect(result.isValid).toBe(false);
  });

  it('passes a valid net-zero target', () => {
    const result = service.validate({
      targetType: 'NET_ZERO',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2050,
      reductionPercentage: 90,
    });
    expect(result.isValid).toBe(true);
  });

  it('fails a net-zero target with wrong scope', () => {
    const result = service.validate({
      targetType: 'NET_ZERO',
      scope: 'SCOPE1',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2050,
      reductionPercentage: 90,
    });
    expect(result.isValid).toBe(false);
  });
});

// ─── ProgressTrackingService ──────────────────────────────────────────────────

describe('ProgressTrackingService', () => {
  let service: ProgressTrackingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgressTrackingService],
    }).compile();
    service = module.get<ProgressTrackingService>(ProgressTrackingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates target emissions at base year as base emissions', () => {
    const result = service.calculateTargetEmissions(10000, 50, 2020, 2030, 2020);
    expect(result).toBe(10000);
  });

  it('calculates target emissions at target year as reduced amount', () => {
    const result = service.calculateTargetEmissions(10000, 50, 2020, 2030, 2030);
    expect(result).toBe(5000);
  });

  it('calculates target emissions midway through pathway', () => {
    const result = service.calculateTargetEmissions(10000, 50, 2020, 2030, 2025);
    expect(result).toBe(7500);
  });

  it('marks on-track when actual emissions are at or below target', () => {
    expect(service.isOnTrack(8000, 9000)).toBe(true);
    expect(service.isOnTrack(9000, 9000)).toBe(true);
  });

  it('marks off-track when actual emissions exceed target by more than 5%', () => {
    expect(service.isOnTrack(10000, 9000)).toBe(false);
  });

  it('calculates positive variance when actual > target', () => {
    const variance = service.calculateVariance(10000, 9000);
    expect(variance).toBeCloseTo(11.11, 1);
  });

  it('calculates negative variance when actual < target', () => {
    const variance = service.calculateVariance(8000, 9000);
    expect(variance).toBeCloseTo(-11.11, 1);
  });

  it('builds full progress metrics with yearly breakdown', () => {
    const metrics = service.buildProgressMetrics({
      targetId: 'target-001',
      targetType: 'NEAR_TERM',
      scope: 'ALL',
      baseYear: 2020,
      baseYearEmissions: 10000,
      targetYear: 2030,
      reductionPercentage: 50,
      progressRecords: [{ reportingYear: 2022, emissions: 8500 }],
    });

    expect(metrics.targetId).toBe('target-001');
    expect(metrics.yearlyBreakdown).toHaveLength(11); // 2020–2030 inclusive
    expect(metrics.requiredAnnualReductionRate).toBe(5);
  });
});
