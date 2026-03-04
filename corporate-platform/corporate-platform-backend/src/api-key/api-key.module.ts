import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyStrategy } from './strategies/api-key.strategy';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyGuard, ApiKeyStrategy],
  exports: [ApiKeyService, ApiKeyGuard, ApiKeyStrategy],
})
export class ApiKeyModule {}
