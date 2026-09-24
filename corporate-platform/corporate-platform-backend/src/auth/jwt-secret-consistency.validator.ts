import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';

/**
 * Fails startup fast if JwtModule's resolved secret ever diverges from
 * ConfigService.getAuthConfig().jwtSecret — the single source of truth
 * both AuthModule and JwtStrategy are supposed to read from. Verified
 * functionally (sign with JwtService, verify against ConfigService's
 * secret) rather than by introspecting JwtModule's private options token,
 * so it still catches drift introduced by a future refactor.
 */
@Injectable()
export class JwtSecretConsistencyValidator implements OnModuleInit {
  private readonly logger = new Logger(JwtSecretConsistencyValidator.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.assertSecretsMatch();
  }

  assertSecretsMatch(): void {
    const expectedSecret = this.configService.getAuthConfig().jwtSecret;
    const probeToken = this.jwtService.sign(
      { __jwtSecretConsistencyProbe: true },
      { expiresIn: '5s' },
    );

    try {
      this.jwtService.verify(probeToken, { secret: expectedSecret });
    } catch {
      throw new Error(
        "JWT secret mismatch: JwtModule's signing secret does not match " +
          'ConfigService.getAuthConfig().jwtSecret. Refusing to start.',
      );
    }

    this.logger.log('JWT secret consistency check passed.');
  }
}
