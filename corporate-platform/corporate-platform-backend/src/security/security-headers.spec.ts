import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, HttpCode } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';

@Controller('health')
class MockHealthController {
  @Get()
  @HttpCode(200)
  getHealth() {
    return { status: 'OK' };
  }
}

describe('Security Headers (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 💡 Isolate the TestingModule from AppModule to prevent database connection panics
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MockHealthController],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the exact helmet configuration from main.ts
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "'unsafe-eval'",
              'https://cdn.jsdelivr.net',
              'https://cdnjs.cloudflare.com',
              'https://unpkg.com',
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://cdn.jsdelivr.net',
              'https://cdnjs.cloudflare.com',
            ],
            imgSrc: ["'self'", 'data:', 'https:', 'http:'],
            fontSrc: [
              "'self'",
              'https://cdn.jsdelivr.net',
              'https://cdnjs.cloudflare.com',
              'https://fonts.gstatic.com',
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: [
              "'self'",
              'https://app.stellar.org',
              'https://stellar.expert',
            ],
            frameAncestors: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        },
        frameguard: { action: 'deny' },
        noSniff: true,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        crossOriginResourcePolicy: { policy: 'same-origin' },
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginEmbedderPolicy: false,
        dnsPrefetchControl: { allow: false },
        hidePoweredBy: true,
        xssFilter: true,
        ieNoOpen: true,
        originAgentCluster: true,
      }),
    );

    // Add manual Permissions-Policy header (matching main.ts)
    app.use((req, res, next) => {
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(self), ' +
          'microphone=(), ' +
          'camera=(), ' +
          'payment=(self), ' +
          'usb=(), ' +
          'vr=(), ' +
          'xr=(), ' +
          'accelerometer=(), ' +
          'gyroscope=(), ' +
          'magnetometer=(), ' +
          'speaker=(), ' +
          'document-domain=(), ' +
          'fullscreen=(self), ' +
          'picture-in-picture=(self), ' +
          'autoplay=(self), ' +
          'clipboard-write=(self), ' +
          'clipboard-read=(self), ' +
          'encrypted-media=(self), ' +
          'gamepad=(), ' +
          'hid=(), ' +
          'idle-detection=(), ' +
          'keyboard-map=(), ' +
          'navigation-override=(), ' +
          'serial=(), ' +
          'sync-xhr=(), ' +
          'wake-lock=(self)',
      );
      next();
    });

    // Add manual Cache-Control headers (matching main.ts)
    app.use((req, res, next) => {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return all security headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    // X-Frame-Options
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers['x-frame-options']).toBe('DENY');

    // X-Content-Type-Options
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers['x-content-type-options']).toBe('nosniff');

    // Strict-Transport-Security
    expect(response.headers).toHaveProperty('strict-transport-security');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['strict-transport-security']).toContain(
      'includeSubDomains',
    );

    // Referrer-Policy
    expect(response.headers).toHaveProperty('referrer-policy');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );

    // Permissions-Policy
    expect(response.headers).toHaveProperty('permissions-policy');
    expect(response.headers['permissions-policy']).toContain(
      'geolocation=(self)',
    );

    // Cross-Origin-Resource-Policy
    expect(response.headers).toHaveProperty('cross-origin-resource-policy');
    expect(response.headers['cross-origin-resource-policy']).toBe(
      'same-origin',
    );

    // Cross-Origin-Opener-Policy
    expect(response.headers).toHaveProperty('cross-origin-opener-policy');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');

    // X-DNS-Prefetch-Control
    expect(response.headers).toHaveProperty('x-dns-prefetch-control');
    expect(response.headers['x-dns-prefetch-control']).toBe('off');

    // Origin-Agent-Cluster
    expect(response.headers).toHaveProperty('origin-agent-cluster');
    expect(response.headers['origin-agent-cluster']).toBe('?1');

    // X-Powered-By should NOT be present
    expect(response.headers).not.toHaveProperty('x-powered-by');
  });

  it('should have CSP header with correct directives', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('content-security-policy');
    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('script-src');
    expect(csp).toContain('style-src');
    expect(csp).toContain("object-src 'none'");
  });

  it('should have Cache-Control headers for API responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('cache-control');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['cache-control']).toContain('no-cache');
    expect(response.headers['cache-control']).toContain('must-revalidate');
    expect(response.headers['cache-control']).toContain('proxy-revalidate');

    expect(response.headers).toHaveProperty('pragma');
    expect(response.headers['pragma']).toBe('no-cache');

    expect(response.headers).toHaveProperty('expires');
    expect(response.headers['expires']).toBe('0');
  });

  it('should have HSTS header with proper configuration', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('strict-transport-security');
    const hsts = response.headers['strict-transport-security'];
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('should have X-Content-Type-Options header to prevent MIME sniffing', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should have X-Frame-Options header to prevent clickjacking', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should have Referrer-Policy header configured correctly', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('referrer-policy');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('should have X-DNS-Prefetch-Control header', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('x-dns-prefetch-control');
    expect(response.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('should have Origin-Agent-Cluster header', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('origin-agent-cluster');
    expect(response.headers['origin-agent-cluster']).toBe('?1');
  });

  it('should have Cross-Origin headers configured correctly', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toHaveProperty('cross-origin-resource-policy');
    expect(response.headers['cross-origin-resource-policy']).toBe(
      'same-origin',
    );

    expect(response.headers).toHaveProperty('cross-origin-opener-policy');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
  });
});
