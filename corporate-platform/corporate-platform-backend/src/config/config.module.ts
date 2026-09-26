import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigWatcherService } from './watcher/config-watcher.service';
import { StartupValidator } from './validation/startup-validator';
import { ServiceValidator } from './validation/service-validator';
import { PrismaService } from '../shared/database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { KafkaService } from '../event-bus/kafka.service';
import { SorobanService } from '../stellar/soroban/soroban.service';
import { IpfsConfig } from '../ipfs/ipfs.config';

@Global()
@Module({
  providers: [
    ConfigService,
    ConfigWatcherService,
    StartupValidator,
    ServiceValidator,
    {
      provide: PrismaService,
      useClass: PrismaService,
    },
    RedisService,
    KafkaService,
    SorobanService,
    IpfsConfig,
  ],
  exports: [
    ConfigService,
    ConfigWatcherService,
    StartupValidator,
    ServiceValidator,
  ],
})
export class ConfigModule {}
