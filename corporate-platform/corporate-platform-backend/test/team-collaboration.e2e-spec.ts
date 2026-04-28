import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Team Collaboration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testCompany = {
    id: 'test-company-e2e',
    name: 'Test Company E2E',
  };

  const testUser = {
    id: 'test-user-e2e',
    email: 'test-e2e@example.com',
    firstName: 'Test',
    lastName: 'User',
    companyId: testCompany.id,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);

    // Setup test data
    await (prisma as any).company.upsert({
      where: { id: testCompany.id },
      update: {},
      create: testCompany,
    });

    await (prisma as any).user.upsert({
      where: { id: testUser.id },
      update: {},
      create: testUser,
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await (prisma as any).user.delete({ where: { id: testUser.id } });
    await (prisma as any).company.delete({ where: { id: testCompany.id } });
    await app.close();
  });

  describe('/api/v1/team/activity (GET)', () => {
    it('should return activity feed', async () => {
      // First, create some test activities
      await (prisma as any).teamActivity.create({
        data: {
          companyId: testCompany.id,
          userId: testUser.id,
          activityType: 'LOGIN',
          metadata: {},
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/team/activity')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.activities).toBeDefined();
      expect(Array.isArray(response.body.activities)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/activity?page=1&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('/api/v1/team/activity/recent (GET)', () => {
    it('should return recent activities', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/activity/recent?limit=10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });
  });

  describe('/api/v1/team/performance (GET)', () => {
    it('should return team performance metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/performance')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('totalActions');
      expect(response.body.metrics).toHaveProperty('engagementScore');
    });
  });

  describe('/api/v1/team/collaboration/score (GET)', () => {
    it('should return collaboration score', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/collaboration/score')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('overallScore');
      expect(response.body).toHaveProperty('components');
      expect(response.body).toHaveProperty('rating');
      expect(response.body).toHaveProperty('insights');
    });

    it('should include recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/collaboration/score')
        .expect(200);

      expect(response.body.recommendations).toBeDefined();
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });
  });

  describe('/api/v1/team/collaboration/top-contributors (GET)', () => {
    it('should return top contributors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/collaboration/top-contributors?limit=5')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);

      if (response.body.length > 0) {
        const contributor = response.body[0];
        expect(contributor).toHaveProperty('userId');
        expect(contributor).toHaveProperty('collaborationScore');
        expect(contributor).toHaveProperty('contributions');
      }
    });
  });

  describe('/api/v1/team/members/:id/details (GET)', () => {
    it('should return member profile', async () => {
      // Create a team member first
      const role = await (prisma as any).role.upsert({
        where: {
          companyId_name: { companyId: testCompany.id, name: 'VIEWER' },
        },
        update: {},
        create: {
          companyId: testCompany.id,
          name: 'VIEWER',
          isSystem: true,
          permissions: ['TEAM_VIEW'],
        },
      });

      await (prisma as any).teamMember.upsert({
        where: { userId: testUser.id },
        update: {},
        create: {
          companyId: testCompany.id,
          userId: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          roleId: role.id,
          status: 'ACTIVE',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/team/members/${testUser.id}/details`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('activityStats');
    });
  });

  describe('/api/v1/team/notifications/unread (GET)', () => {
    it('should return unread notifications', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/team/notifications/unread')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
