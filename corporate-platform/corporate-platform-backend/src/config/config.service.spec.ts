jest.mock('dotenv', () => ({ config: jest.fn() }));

import { ConfigService } from './config.service';

describe('ConfigService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Start every test from a clean slate; only the keys each test sets
    // explicitly should influence config validation.
    process.env = {};
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when JWT_SECRET is unset, regardless of NODE_ENV', () => {
    process.env.NODE_ENV = 'development';

    expect(() => new ConfigService()).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is unset in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    expect(() => new ConfigService()).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is shorter than the minimum length in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'short-secret-16c';

    expect(() => new ConfigService()).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET matches a known placeholder pattern in production, even if long', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'dev-jwt-secret-padded-to-32-plus-characters';

    expect(() => new ConfigService()).toThrow(/JWT_SECRET/);
  });

  it('does not throw for a properly configured secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'Xk9#mQ2$vL7pR4wN8tY1cB6zF3hD5jS0';

    expect(() => new ConfigService()).not.toThrow();
  });

  it('applies the production-grade secret guard to a staging deployment even when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEPLOY_ENV = 'staging';
    process.env.JWT_SECRET = 'short-secret-16c';

    expect(() => new ConfigService()).toThrow(/JWT_SECRET/);
  });

  it('applies the production-grade secret guard when SERVICE_NAME indicates a shared environment', () => {
    process.env.NODE_ENV = 'development';
    process.env.SERVICE_NAME = 'corporate-platform-backend-shared';
    process.env.JWT_SECRET = 'short-secret-16c';

    expect(() => new ConfigService()).toThrow(/JWT_SECRET/);
  });

  it('does not apply the production-grade secret guard to plain development', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'short-dev-secret';

    expect(() => new ConfigService()).not.toThrow();
  });

  it('exposes the validated secret through getAuthConfig()', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'a-perfectly-fine-dev-time-secret-value';

    const configService = new ConfigService();

    expect(configService.getAuthConfig().jwtSecret).toBe(
      'a-perfectly-fine-dev-time-secret-value',
    );
  });
});
