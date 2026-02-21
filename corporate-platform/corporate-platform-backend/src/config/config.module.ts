import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigWatcherService } from './watcher/config-watcher.service';

@Global()
@Module({
  providers: [ConfigService, ConfigWatcherService],
  exports: [ConfigService],
})
export class ConfigModule {}
