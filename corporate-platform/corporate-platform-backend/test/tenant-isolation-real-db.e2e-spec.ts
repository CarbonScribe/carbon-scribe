// Loaded before anything reads process.env.DATABASE_URL below: ConfigService
// only loads .env once Nest instantiates it, which is too late for this
// module-scope check (and for deriving the throwaway test database's URL).
import * as dotenv from 'dotenv';
dotenv.config();

import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { sign, verify } from 'jsonwebtoken';
import { PortfolioModule } from '../src/portfolio/portfolio.module';
import { RbacModule } from '../src/rbac/rbac.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ConfigService } from '../src/config/config.service';
import { TenantModule } from '../src/multi-tenant/tenant.module';
import { TenantMiddleware } from '../src/multi-tenant/middleware/tenant.middleware';
import { PrismaService } from '../src/shared/database/prisma.service';

/**
 * #740: a genuine cross-tenant isolation test, run against a real
 * Postgres-backed PrismaClient (via the app's real PrismaService, with its
 * tenant-scoping query extension active) rather than a fully mocked one.
 * The existing mock-based "Multi-tenant Isolation" test in
 * portfolio.e2e-spec.ts only ever proves the controller *constructs* the
 * right `where` clause against a mock that trusts whatever `where` it's
 * given — it would stay green even if TenantGuard/TenantMiddleware were
 * removed entirely. This suite boots the real TenantModule (global
 * TenantGuard + TenantMiddleware) and the real PrismaService — with its
 * tenant-scoping $extends middleware active — against a throwaway database
 * seeded with two distinct companies, so a regression in the actual
 * enforcement chain (not just the controller's own code) would fail it.
 *
 * JwtAuthGuard is swapped for RealJwtVerifyingGuard below instead of the
 * real `@nestjs/passport` AuthGuard('jwt'): the real one requires AuthModule,
 * which (transitively, via JwtModule.registerAsync's hardcoded
 * `imports: [ConfigModule]`) pulls in unrelated infra providers
 * (Kafka/Redis/Soroban) that this suite has no business depending on to
 * prove tenant isolation. RealJwtVerifyingGuard still does the one thing
 * that actually matters here: it verifies a real HMAC-signed JWT against the
 * app's real JWT_SECRET and rejects anything that doesn't verify — the
 * NestJS/Passport plumbing around that is not what this test is about.
 *
 * Requires a reachable Postgres instance (the same one `DATABASE_URL`
 * already points local dev at). A dedicated `cs_corporate_db_e2e_test`
 * database — derived from DATABASE_URL's host/credentials, migrated via
 * `prisma migrate deploy` — is used so this suite never touches real dev
 * data. Set TEST_DATABASE_URL explicitly to point elsewhere (e.g. in CI).
 * The suite skips itself when no database is configured at all.
 */
function resolveTestDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  if (!process.env.DATABASE_URL) {
    return undefined;
  }
  try {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/cs_corporate_db_e2e_test';
    return url.toString();
  } catch {
    return undefined;
  }
}

const testDatabaseUrl = resolveTestDatabaseUrl();
const describeIfDb = testDatabaseUrl ? describe : describe.skip;

if (!testDatabaseUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    'Skipping tenant-isolation-real-db.e2e-spec.ts: no DATABASE_URL/TEST_DATABASE_URL configured.',
  );
}

const TEST_JWT_SECRET = 'e2e-tenant-isolation-real-db-test-secret-value';

class StubConfigService {
  getAuthConfig() {
    return { jwtSecret: TEST_JWT_SECRET };
  }
}

@Injectable()
class RealJwtVerifyingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      request.user = verify(token, TEST_JWT_SECRET);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

@Global()
@Module({
  providers: [{ provide: ConfigService, useClass: StubConfigService }],
  exports: [ConfigService],
})
class StubConfigModule {}

@Module({
  imports: [StubConfigModule, RbacModule, TenantModule, PortfolioModule],
})
class TenantIsolationTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

describeIfDb('Tenant isolation against a real database (#740)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let companyA: { id: string };
  let companyB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let projectId: string;
  let creditA: { id: string };
  let creditB: { id: string };

  const tokenFor = (companyId: string, userId: string) =>
    sign({ sub: userId, companyId, role: 'admin' }, TEST_JWT_SECRET, {
      expiresIn: '1h',
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TenantIsolationTestModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(RealJwtVerifyingGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    const company1 = await prisma.company.create({
      data: { name: 'E2E Tenant Isolation Co A' },
    });
    const company2 = await prisma.company.create({
      data: { name: 'E2E Tenant Isolation Co B' },
    });
    companyA = { id: company1.id };
    companyB = { id: company2.id };

    const u1 = await prisma.user.create({
      data: {
        email: `a-${companyA.id}@e2e.test`,
        password: 'not-a-real-hash',
        firstName: 'A',
        lastName: 'User',
        role: 'admin',
        companyId: companyA.id,
      },
    });
    const u2 = await prisma.user.create({
      data: {
        email: `b-${companyB.id}@e2e.test`,
        password: 'not-a-real-hash',
        firstName: 'B',
        lastName: 'User',
        role: 'admin',
        companyId: companyB.id,
      },
    });
    userA = { id: u1.id };
    userB = { id: u2.id };

    const project = await prisma.project.create({
      data: { name: 'E2E Tenant Isolation Project', startDate: new Date() },
    });
    projectId = project.id;

    const c1 = await prisma.credit.create({
      data: {
        projectId,
        projectName: project.name,
        availableAmount: 1000,
        totalAmount: 1000,
      },
    });
    const c2 = await prisma.credit.create({
      data: {
        projectId,
        projectName: project.name,
        availableAmount: 1000,
        totalAmount: 1000,
      },
    });
    creditA = { id: c1.id };
    creditB = { id: c2.id };

    // getSummaryMetrics short-circuits to all-zero totals when a company has
    // no Portfolio row at all, regardless of its retirements — so one must
    // exist per company for totalRetired to reflect the seeded retirements.
    await prisma.portfolio.create({ data: { companyId: companyA.id } });
    await prisma.portfolio.create({ data: { companyId: companyB.id } });

    // Distinct, easily-distinguishable retirement totals per company.
    await prisma.retirement.create({
      data: {
        companyId: companyA.id,
        userId: userA.id,
        creditId: creditA.id,
        amount: 111,
        purpose: 'corporate',
        priceAtRetirement: 10,
      },
    });
    await prisma.retirement.create({
      data: {
        companyId: companyB.id,
        userId: userB.id,
        creditId: creditB.id,
        amount: 444,
        purpose: 'corporate',
        priceAtRetirement: 10,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    await prisma.retirement.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.portfolio.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.credit.deleteMany({
      where: { id: { in: [creditA.id, creditB.id] } },
    });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } },
    });
    await app.close();
  });

  it("returns only company A's own data when authenticated as company A", async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/portfolio/summary')
      .set('Authorization', `Bearer ${tokenFor(companyA.id, userA.id)}`)
      .expect(200);

    expect(response.body.data.totalRetired).toBe(111);
  });

  it("returns only company B's own data when authenticated as company B", async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/portfolio/summary')
      .set('Authorization', `Bearer ${tokenFor(companyB.id, userB.id)}`)
      .expect(200);

    expect(response.body.data.totalRetired).toBe(444);
  });

  it("rejects a company-A-authenticated request that also spoofs an X-Tenant-Id header for company B, rather than leaking B's data", async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/portfolio/summary')
      .set('Authorization', `Bearer ${tokenFor(companyA.id, userA.id)}`)
      .set('X-Tenant-Id', companyB.id);

    expect(response.status).toBe(403);
    expect(response.body.data?.totalRetired).not.toBe(444);
  });

  it('rejects an unsigned/forged token outright rather than falling back to an unscoped query', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/portfolio/summary')
      .set('Authorization', 'Bearer not.a.valid.jwt')
      .expect(401);
  });
});
