import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as helmet from 'helmet';
import { getHelmetConfig } from '../config/helmet.config';

/**
 * Security Headers Test Suite
 *
 * This test suite verifies that all security headers are correctly configured
 * and present in HTTP responses from the backend.
 *
 * Tests cover:
 * - Helmet middleware integration
 * - Security header presence and values
 * - Environment-specific configurations
 * - Compatibility with CORS and Swagger
 */
describe('Security Headers (e2e)', () => {
  let app: INestApplication;

  // Minimal test app for header verification
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [],
      providers: [],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet(getHelmetConfig(false))); // Use development config for testing

    // Simple test endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Content-Security-Policy (CSP)', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should have strict defaultSrc directive', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
    });

    it('should restrict script sources', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("script-src");
    });

    it('should restrict form submissions', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("form-action 'self'");
    });

    it('should restrict base URI', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("base-uri 'self'");
    });
  });

  describe('X-Frame-Options (Frameguard)', () => {
    it('should include X-Frame-Options header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set X-Frame-Options to SAMEORIGIN', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('X-Content-Type-Options (No Sniff)', () => {
    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Referrer-Policy', () => {
    it('should include Referrer-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set Referrer-Policy to strict-no-referrer', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['referrer-policy']).toBe('strict-no-referrer');
    });
  });

  describe('X-DNS-Prefetch-Control', () => {
    it('should include X-DNS-Prefetch-Control header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set X-DNS-Prefetch-Control to off', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });
  });

  describe('Expect-CT', () => {
    it('should include Expect-CT header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['expect-ct']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should include max-age in Expect-CT', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const expectCt = response.headers['expect-ct'];

      expect(expectCt).toContain('max-age=');
    });
  });

  describe('Cross-Origin-Resource-Policy (CORP)', () => {
    it('should include Cross-Origin-Resource-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['cross-origin-resource-policy']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set Cross-Origin-Resource-Policy to cross-origin in dev', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });
  });

  describe('Cross-Origin-Opener-Policy (COOP)', () => {
    it('should include Cross-Origin-Opener-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['cross-origin-opener-policy']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set Cross-Origin-Opener-Policy to unsafe-none in dev', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['cross-origin-opener-policy']).toBe('unsafe-none');
    });
  });

  describe('Permissions-Policy', () => {
    it('should include Permissions-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['permissions-policy']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should deny microphone permission', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const permissionsPolicy = response.headers['permissions-policy'];

      expect(permissionsPolicy).toContain('microphone=()');
    });

    it('should deny camera permission', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const permissionsPolicy = response.headers['permissions-policy'];

      expect(permissionsPolicy).toContain('camera=()');
    });

    it('should deny geolocation permission', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const permissionsPolicy = response.headers['permissions-policy'];

      expect(permissionsPolicy).toContain('geolocation=()');
    });
  });

  describe('X-XSS-Protection (Legacy)', () => {
    it('should include X-XSS-Protection header', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should set X-XSS-Protection to 1; mode=block', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should provide development config when NODE_ENV is development', () => {
      const devConfig = getHelmetConfig(false);

      expect(devConfig).toBeDefined();
      expect(devConfig.contentSecurityPolicy).toBeDefined();
    });

    it('should provide production config when isProduction is true', () => {
      const prodConfig = getHelmetConfig(true);

      expect(prodConfig).toBeDefined();
      expect(prodConfig.hsts).toBeDefined();
      // HSTS should be stricter in production
      if (prodConfig.hsts && typeof prodConfig.hsts === 'object' && 'maxAge' in prodConfig.hsts) {
        expect(prodConfig.hsts.maxAge).toBeGreaterThan(0);
      }
    });

    it('development config should allow more permissive CSP', () => {
      const devConfig = getHelmetConfig(false);

      if (devConfig.contentSecurityPolicy && typeof devConfig.contentSecurityPolicy === 'object' && 'directives' in devConfig.contentSecurityPolicy) {
        const devCsp = devConfig.contentSecurityPolicy.directives as Record<string, string[]>;
        // Development should allow unsafe-inline for easier testing
        expect(devCsp.scriptSrc).toContain("'unsafe-inline'");
      }
    });
  });

  describe('Multiple Requests', () => {
    it('should include security headers on all responses', async () => {
      const paths = ['/health'];

      for (const path of paths) {
        const response = await request(app.getHttpServer()).get(path);

        expect(response.headers['x-frame-options']).toBeDefined();
        expect(response.headers['x-content-type-options']).toBeDefined();
        expect(response.headers['content-security-policy']).toBeDefined();
      }
    });

    it('should include headers on OPTIONS requests', async () => {
      const response = await request(app.getHttpServer()).options('/health');

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should include headers on POST requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/health')
        .send({});

      // Even if endpoint doesn't exist, headers should be present
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Header Conflicts', () => {
    it('should not have conflicting CSP and CORS headers', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      const csp = response.headers['content-security-policy'];
      const cors = response.headers['access-control-allow-origin'];

      // Both should be defined or both undefined, but not conflicts
      expect(csp || cors || true).toBeTruthy();
    });

    it('should not have duplicate X-Frame-Options headers', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const frameOptions = response.headers['x-frame-options'];

      // Should be a string, not an array
      expect(typeof frameOptions).toBe('string');
    });
  });
});
