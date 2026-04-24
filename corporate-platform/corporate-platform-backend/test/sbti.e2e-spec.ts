import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('SBTi Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/sbti/targets (POST) - should create a target', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sbti/targets')
      .send({
        companyId: 'test-company',
        targetType: 'NEAR_TERM',
        scope: 'ALL',
        baseYear: 2020,
        baseYearEmissions: 1000,
        targetYear: 2030,
        reductionPercentage: 50,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.targetType).toBe('NEAR_TERM');
  });

  it('/api/v1/sbti/targets (GET) - should list targets', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/sbti/targets?companyId=test-company',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/v1/sbti/targets/:id/validate (POST) - should validate a target', async () => {
    // Create a target first
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/sbti/targets')
      .send({
        companyId: 'test-company',
        targetType: 'NET_ZERO',
        scope: 'ALL',
        baseYear: 2020,
        baseYearEmissions: 1000,
        targetYear: 2040,
        reductionPercentage: 95,
      });
    const targetId = createRes.body.id;
    const res = await request(app.getHttpServer()).post(
      `/api/v1/sbti/targets/${targetId}/validate`,
    );
    expect(res.status).toBe(201);
    expect(res.body.valid).toBe(true);
  });

  it('/api/v1/sbti/dashboard (GET) - should return dashboard data', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/sbti/dashboard?companyId=test-company',
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('targets');
    expect(res.body).toHaveProperty('progress');
  });

  it('/api/v1/sbti/retirement-gap (GET) - should return retirement gap data', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/sbti/retirement-gap?companyId=test-company',
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
  });
});
