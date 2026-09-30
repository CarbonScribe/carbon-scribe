import { createJwtModuleOptions } from './auth.module';
import { ConfigService } from '../config/config.service';

describe('createJwtModuleOptions', () => {
  function mockConfigService(jwtSecret: string): ConfigService {
    return {
      getAuthConfig: jest.fn().mockReturnValue({ jwtSecret, jwtExpiry: '15m' }),
    } as unknown as ConfigService;
  }

  it('resolves JwtModule secret exclusively from ConfigService.getAuthConfig().jwtSecret', () => {
    const configService = mockConfigService('secret-from-config-service');

    const options = createJwtModuleOptions(configService);

    expect(configService.getAuthConfig).toHaveBeenCalled();
    expect(options).toEqual({ secret: 'secret-from-config-service' });
  });

  it('uses the same secret source as JwtStrategy, not a hardcoded fallback', () => {
    const configService = mockConfigService('shared-secret-value');

    const authModuleOptions = createJwtModuleOptions(configService);
    const jwtStrategySecret = configService.getAuthConfig().jwtSecret;

    expect(authModuleOptions.secret).toBe(jwtStrategySecret);
    expect(authModuleOptions.secret).not.toBe('dev-jwt-secret');
  });
});
