import { Test, TestingModule } from '@nestjs/testing';
import { CorsiaService } from './corsia.service';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { FlightEmissionsService } from './services/flight-emissions.service';
import { OffsetRequirementService } from './services/offset-requirement.service';
import { EmissionsReportService } from './services/emissions-report.service';
import { EligibleFuelsService } from './services/eligible-fuels.service';
import { VerifierService } from './services/verifier.service';

describe('CorsiaService', () => {
  let service: CorsiaService;

  const prismaMock = {
    flightRecord: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { co2Emissions: 0 } }),
    },
    corsiaComplianceYear: {
      upsert: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    retirement: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    corsiaEligibleCredit: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const securityMock = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorsiaService,
        FlightEmissionsService,
        OffsetRequirementService,
        EmissionsReportService,
        EligibleFuelsService,
        VerifierService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SecurityService, useValue: securityMock },
      ],
    }).compile();

    service = module.get<CorsiaService>(CorsiaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists eligible fuels', () => {
    const fuels = service.listEligibleFuels();
    expect(fuels.length).toBeGreaterThan(0);
  });

  it('throws when batch payload is empty', async () => {
    await expect(service.recordFlightsBatch('company-1', [])).rejects.toThrow(
      'flights must contain at least one record',
    );
  });
});
