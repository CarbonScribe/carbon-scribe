import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ComplianceModule } from '../src/compliance/compliance.module';
import { SorobanModule } from '../src/stellar/soroban/soroban.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/rbac/guards/permissions.guard';

// Mock guards to always allow
class MockJwtAuthGuard {
  canActivate() {
    return true;
  }
}
class MockPermissionsGuard {
  canActivate() {
    return true;
  }
}

describe('RetirementHistoryController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ComplianceModule, SorobanModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useClass(MockPermissionsGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/compliance/retirements (GET) should return array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/retirements')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/v1/compliance/retirements/:tokenId (GET) should return object or null', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/retirements/test-token')
      .expect(200);
    expect(typeof res.body === 'object' || res.body === null).toBe(true);
  });

  it('/api/v1/compliance/retirements/entity/:address (GET) should return array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/retirements/entity/test-entity')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
