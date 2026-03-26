import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as request from 'supertest';
import { CsrdModule } from '../src/csrd/csrd.module';
import { RbacModule } from '../src/rbac/rbac.module';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('CSRD Compliance API Integration Tests', () => {
  let app: INestApplication;

  const mockCompanyId = 'test-company-id-1';
  const mockAuthToken = 'valid-jwt-token';

  const mockPrismaService = new Proxy({} as any, {
    get: (target, prop) => {
      if (typeof prop === 'string' && !target[prop]) {
        target[prop] = {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest
            .fn()
            .mockImplementation((args) =>
              Promise.resolve({ id: 'mock-id', ...args.data }),
            ),
          update: jest
            .fn()
            .mockImplementation((args) =>
              Promise.resolve({ id: args.where.id || 'mock-id', ...args.data }),
            ),
          delete: jest.fn().mockResolvedValue({}),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          count: jest.fn().mockResolvedValue(0),
          upsert: jest
            .fn()
            .mockImplementation((args) =>
              Promise.resolve({ id: 'mock-id', ...args.update }),
            ),
        };
      }
      return target[prop];
    },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CsrdModule, RbacModule, AuthModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) {
            throw new UnauthorizedException();
          }
          req.user = {
            sub: 'user-1',
            companyId: req.headers['x-company-id'] || mockCompanyId,
            role: 'admin',
          };
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Materiality Assessment', () => {
    it('should create a materiality assessment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/csrd/materiality/assess')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          assessmentYear: 2024,
          impacts: { E1: 4, S1: 5 },
          risks: { E1: 3, S1: 2 },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should retrieve current materiality assessment', async () => {
      mockPrismaService.materialityAssessment.findFirst.mockResolvedValueOnce({
        id: 'assessment-1',
        assessmentYear: 2024,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/csrd/materiality/current')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.id).toBe('assessment-1');
    });
  });

  describe('ESRS Disclosures', () => {
    it('should record a generic disclosure', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/csrd/disclosures/record')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reportingPeriod: '2024',
          standard: 'ESRS E1',
          disclosureRequirement: 'E1-1',
          dataPoint: 'GHG Emissions',
          value: { total: 5000 },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should list disclosures with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/csrd/disclosures?standard=ESRS E1')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Reporting', () => {
    it('should generate a CSRD report', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/csrd/reports/generate')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({ year: 2024 })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.reportUrl).toBeDefined();
    });

    it('should return readiness scorecard', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/csrd/readiness')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.overallScore).toBeDefined();
      expect(response.body.milestones).toBeDefined();
    });
  });

  describe('Error Handling & Auth', () => {
    it('should return 401 for unauthorized access', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/csrd/readiness')
        .expect(401);
    });
  });
});
