import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as request from 'supertest';
import { RetirementModule } from '../src/retirement/retirement.module';
import { RbacModule } from '../src/rbac/rbac.module';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/shared/database/prisma.service';

/**
 * #740: "equivalent test for at least one other tenant-scoped endpoint
 * beyond portfolio" — the isolation gap is architectural (how
 * TenantGuard/companyId scoping interacts with a controller), not
 * portfolio-specific.
 *
 * Unlike the portfolio endpoints (which only ever read `user.companyId`,
 * with nothing attacker-controlled to smuggle another company's ID
 * through), RetirementController's `GET /:id` and `GET /:id/certificate`
 * take an attacker-controllable `id` route param and fetch the record by
 * ID *before* checking `retirement.companyId !== user.companyId` — so the
 * attack here is: authenticate as company A, then simply request a
 * retirement ID that belongs to company B (e.g. guessed/enumerated), and
 * confirm it comes back 404, not company B's record.
 *
 * TenantGuard is registered globally via APP_GUARD (through DatabaseModule,
 * imported transitively) and requires request.tenant to be populated by
 * TenantMiddleware (normally wired only in AppModule.configure()) — see the
 * same note in portfolio.e2e-spec.ts. A stand-in middleware below populates
 * it consistently with the mocked JwtAuthGuard's identity so the two never
 * disagree.
 */
const MOCK_COMPANY_A = 'company-a-retirement-isolation';
const MOCK_COMPANY_B = 'company-b-retirement-isolation';

function testTenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const companyId =
    (req.headers['x-authenticated-company'] as string | undefined) ||
    (req.headers.authorization ? MOCK_COMPANY_A : undefined);
  if (companyId) {
    (req as Request & { tenant?: unknown }).tenant = {
      companyId,
      userId: 'user-1',
      role: 'admin',
      source: 'test',
    };
  }
  next();
}

@Module({
  imports: [RetirementModule, RbacModule, AuthModule],
})
class RetirementTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(testTenantMiddleware).forRoutes('*');
  }
}

describe('Retirement API Tenant Isolation (#740)', () => {
  let app: INestApplication;

  const mockPrismaService = new Proxy({} as any, {
    get: (target, prop) => {
      if (typeof prop === 'string' && !target[prop]) {
        target[prop] = {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          count: jest.fn().mockResolvedValue(0),
          upsert: jest.fn().mockResolvedValue({}),
        };
      }
      return target[prop];
    },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RetirementTestModule],
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
            companyId: req.headers['x-authenticated-company'] || MOCK_COMPANY_A,
            role: 'admin',
          };
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/retirements/:id', () => {
    it('returns a company A-owned retirement when authenticated as company A', async () => {
      mockPrismaService.retirement.findUnique.mockResolvedValue({
        id: 'retirement-A',
        companyId: MOCK_COMPANY_A,
        company: { name: 'Company A' },
        credit: { projectName: 'Project A' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/retirements/retirement-A')
        .set('Authorization', 'Bearer token')
        .set('X-Authenticated-Company', MOCK_COMPANY_A)
        .expect(200);

      expect(response.body.id).toBe('retirement-A');
    });

    it('does not leak a company B-owned retirement to a company-A-authenticated request guessing its ID (#740)', async () => {
      mockPrismaService.retirement.findUnique.mockResolvedValue({
        id: 'retirement-B-secret',
        companyId: MOCK_COMPANY_B,
        company: { name: 'Company B' },
        credit: { projectName: 'Project B secret' },
      });

      await request(app.getHttpServer())
        .get('/api/v1/retirements/retirement-B-secret')
        .set('Authorization', 'Bearer token')
        .set('X-Authenticated-Company', MOCK_COMPANY_A)
        .expect(404);
    });
  });

  describe('GET /api/v1/retirements/:id/certificate', () => {
    it('does not leak a company B-owned certificate to a company-A-authenticated request guessing its ID (#740)', async () => {
      mockPrismaService.retirement.findUnique.mockResolvedValue({
        id: 'retirement-B-secret',
        companyId: MOCK_COMPANY_B,
        company: { name: 'Company B' },
        credit: { projectName: 'Project B secret' },
      });

      await request(app.getHttpServer())
        .get('/api/v1/retirements/retirement-B-secret/certificate')
        .set('Authorization', 'Bearer token')
        .set('X-Authenticated-Company', MOCK_COMPANY_A)
        .expect(404);
    });
  });
});
