import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SchedulingModule } from '../src/retirement-scheduling/scheduling.module';
import { DatabaseModule } from '../src/shared/database/database.module';
import { RetirementModule } from '../src/retirement/retirement.module';
import { AuthModule } from '../src/auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Retirement Scheduling (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let validToken: string;

  const mockCompanyId = 'company-e2e-1';
  const mockUserId = 'user-e2e-1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, RetirementModule, AuthModule, SchedulingModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        retirementSchedule: {
          create: jest.fn().mockResolvedValue({
            id: 'sched-1',
            companyId: mockCompanyId,
            name: 'Test Schedule',
            nextRunDate: new Date(),
            isActive: true,
          }),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        scheduleExecution: { findMany: jest.fn().mockResolvedValue([]) },
        batchRetirement: {
          create: jest.fn().mockResolvedValue({
            id: 'batch-1',
            companyId: mockCompanyId,
            status: 'completed',
            totalItems: 1,
            completedItems: 1,
            failedItems: 0,
          }),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue({}),
        },
        credit: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
        retirement: { create: jest.fn().mockResolvedValue({ id: 'ret-1' }) },
        user: { findUnique: jest.fn().mockResolvedValue({ id: mockUserId, companyId: mockCompanyId }) },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    validToken = jwtService.sign({
      sub: mockUserId,
      email: 'e2e@test.com',
      companyId: mockCompanyId,
      role: 'admin',
      sessionId: 'sess-1',
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/retirement-schedules returns success with valid body and auth', () => {
    return request(app.getHttpServer())
      .post('/api/v1/retirement-schedules')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'Monthly Scope 1',
        purpose: 'scope1',
        amount: 100,
        creditSelection: 'automatic',
        frequency: 'monthly',
        startDate: '2026-03-01',
      })
      .expect((res) => expect([200, 201]).toContain(res.status));
  });

  it('GET /api/v1/retirement-schedules returns 200', () => {
    return request(app.getHttpServer())
      .get('/api/v1/retirement-schedules')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
  });

  it('POST /api/v1/retirement-batches returns success with valid items', () => {
    return request(app.getHttpServer())
      .post('/api/v1/retirement-batches')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'E2E Batch',
        items: [{ creditId: 'credit-1', amount: 5, purpose: 'scope1' }],
      })
      .expect((res) => expect([200, 201]).toContain(res.status));
  });

  it('POST /api/v1/retirement-batches/csv returns 400 when file is missing', () => {
    return request(app.getHttpServer())
      .post('/api/v1/retirement-batches/csv')
      .set('Authorization', `Bearer ${validToken}`)
      .field('name', 'CSV Batch')
      .expect(400);
  });
});
