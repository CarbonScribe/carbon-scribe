import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheController } from './cache.controller';
import { AdminGuard } from './admin.guard';

@Module({
  providers: [
    RedisService,
    CacheService,
    AdminGuard,
    Reflector,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  controllers: [CacheController],
  exports: [RedisService, CacheService],
})
export class CacheModule {}

