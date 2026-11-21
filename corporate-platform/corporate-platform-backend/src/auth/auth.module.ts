import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../shared/database/database.module';
import { SecurityModule } from '../security/security.module';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { JwtSecretConsistencyValidator } from './jwt-secret-consistency.validator';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

/**
 * Resolves JwtModule's secret exclusively from ConfigService.getAuthConfig(),
 * which is the same validated config JwtStrategy reads from — never
 * process.env directly.
 */
export function createJwtModuleOptions(
  configService: ConfigService,
): JwtModuleOptions {
  return {
    secret: configService.getAuthConfig().jwtSecret,
  };
}

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    // AuthController applies RateLimitGuard directly (@UseGuards), which
    // needs RateLimitService. RateLimitModule is @Global(), so in the full
    // app it's registered regardless of this import (something else pulls
    // it in) — but any test/module subset that imports only AuthModule has
    // no other way to satisfy that dependency.
    RateLimitModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtModuleOptions,
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtSecretConsistencyValidator,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
