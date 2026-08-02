import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitController } from './rate-limit.controller';
import { RedisService } from '../shared/cache/redis.service';
import { SecurityService } from '../security/security.service';
import { DatabaseModule } from '../shared/database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RateLimitService, RateLimitGuard, RedisService, SecurityService],
  exports: [RateLimitService, RateLimitGuard],
  controllers: [RateLimitController],
})
export class RateLimitModule {}
