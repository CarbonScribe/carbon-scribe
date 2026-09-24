import { JwtService } from '@nestjs/jwt';
import { JwtSecretConsistencyValidator } from './jwt-secret-consistency.validator';
import { ConfigService } from '../config/config.service';

describe('JwtSecretConsistencyValidator', () => {
  function mockConfigService(jwtSecret: string): ConfigService {
    return {
      getAuthConfig: jest.fn().mockReturnValue({ jwtSecret, jwtExpiry: '15m' }),
    } as unknown as ConfigService;
  }

  it('does not throw when JwtService and ConfigService use the same secret', () => {
    const jwtService = new JwtService({ secret: 'matching-secret-value' });
    const configService = mockConfigService('matching-secret-value');
    const validator = new JwtSecretConsistencyValidator(
      jwtService,
      configService,
    );

    expect(() => validator.assertSecretsMatch()).not.toThrow();
  });

  it('throws when JwtService and ConfigService have diverged onto different secrets', () => {
    const jwtService = new JwtService({
      secret: 'secret-jwt-module-signs-with',
    });
    const configService = mockConfigService('a-completely-different-secret');
    const validator = new JwtSecretConsistencyValidator(
      jwtService,
      configService,
    );

    expect(() => validator.assertSecretsMatch()).toThrow(/JWT secret mismatch/);
  });

  it('runs the assertion during onModuleInit', () => {
    const jwtService = new JwtService({ secret: 'matching-secret-value' });
    const configService = mockConfigService('matching-secret-value');
    const validator = new JwtSecretConsistencyValidator(
      jwtService,
      configService,
    );
    const spy = jest.spyOn(validator, 'assertSecretsMatch');

    validator.onModuleInit();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
