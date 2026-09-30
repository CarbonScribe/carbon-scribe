import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '../../config/config.service';

describe('JwtStrategy', () => {
  function mockConfigService(jwtSecret: string): ConfigService {
    return {
      getAuthConfig: jest.fn().mockReturnValue({ jwtSecret, jwtExpiry: '15m' }),
    } as unknown as ConfigService;
  }

  it('resolves its secret exclusively from ConfigService.getAuthConfig().jwtSecret', (done) => {
    const configService = mockConfigService('secret-from-config-service');
    const strategy = JwtStrategy as unknown as new (
      configService: ConfigService,
    ) => JwtStrategy & {
      _secretOrKeyProvider: (
        req: unknown,
        rawJwt: string,
        cb: (err: unknown, secret?: string) => void,
      ) => void;
    };
    const instance = new strategy(configService);

    expect(configService.getAuthConfig).toHaveBeenCalled();

    instance._secretOrKeyProvider(null, 'raw-jwt', (err, resolvedSecret) => {
      expect(err).toBeNull();
      expect(resolvedSecret).toBe('secret-from-config-service');
      done();
    });
  });

  it('never falls back to a hardcoded dev secret when ConfigService returns a different value', (done) => {
    const configService = mockConfigService('another-real-secret');
    const strategy = JwtStrategy as unknown as new (
      configService: ConfigService,
    ) => JwtStrategy & {
      _secretOrKeyProvider: (
        req: unknown,
        rawJwt: string,
        cb: (err: unknown, secret?: string) => void,
      ) => void;
    };
    const instance = new strategy(configService);

    instance._secretOrKeyProvider(null, 'raw-jwt', (_err, resolvedSecret) => {
      expect(resolvedSecret).not.toBe('dev-jwt-secret');
      expect(resolvedSecret).toBe('another-real-secret');
      done();
    });
  });
});
