import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as request from 'supertest';
import { AuctionModule } from '../src/auction/auction.module';
import { RbacModule } from '../src/rbac/rbac.module';
import { AuthModule } from '../src/auth/auth.module';
import { RateLimitModule } from '../src/rate-limit/rate-limit.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../src/security/guards/ip-whitelist.guard';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Auction API Integration Tests', () => {
  let app: INestApplication;
  const mockCompanyId = 'test-company-id-1';
  const mockAuthToken = 'valid-jwt-token';

  const mockPrismaService = new Proxy({} as any, {
    get: (target, prop) => {
      if (typeof prop === 'string' && !target[prop]) {
        target[prop] = jest.fn().mockResolvedValue(null);
      }
      return target[prop];
    },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuctionModule, RbacModule, AuthModule, RateLimitModule],
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
            companyId: mockCompanyId,
            role: 'admin',
            email: 'test@example.com',
            sessionId: 'session-123',
          };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({
        canActivate: () => true, // bypass RBAC for base auth testing or fail if needed
      })
      .overrideGuard(IpWhitelistGuard)
      .useValue({
        canActivate: () => true,
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

  describe('Unauthenticated Requests', () => {
    it('should return 401 for GET /api/v1/auctions', async () => {
      await request(app.getHttpServer()).get('/api/v1/auctions').expect(401);
    });

    it('should return 401 for GET /api/v1/auctions/:id', async () => {
      await request(app.getHttpServer()).get('/api/v1/auctions/1').expect(401);
    });

    it('should return 401 for POST /api/v1/auctions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auctions')
        .send({ creditId: 'c1', quantity: 100, startPrice: 10 })
        .expect(401);
    });

    it('should return 401 for PUT /api/v1/auctions/:id/start', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/auctions/123/start')
        .expect(401);
    });

    it('should return 401 for POST /api/v1/auctions/:id/bids', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auctions/123/bids')
        .send({ amount: 100 })
        .expect(401);
    });

    it('should return 401 for GET /api/v1/auctions/:id/bids', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auctions/123/bids')
        .expect(401);
    });

    it('should return 401 for POST /api/v1/auctions/:id/settle', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auctions/123/settle')
        .expect(401);
    });
  });

  describe('Authenticated Requests', () => {
    it('should allow GET /api/v1/auctions when authenticated', async () => {
      mockPrismaService.findMany = jest.fn().mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/auctions')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);
    });
  });
});
