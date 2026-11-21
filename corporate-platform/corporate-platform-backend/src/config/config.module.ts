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
import { SigningModule } from '../stellar/signing/signing.module';

@Global()
@Module({
  // SorobanService (below) needs SIGNING_PROVIDER_CONTRACT. SigningModule is
  // @Global(), so in the full app it ends up registered regardless (via
  // StellarModule elsewhere) — but any test/module subset that imports only
  // ConfigModule without anything pulling in StellarModule has no other way
  // to satisfy that dependency. Importing it here makes ConfigModule
  // self-sufficient instead of relying on that incidental global side effect.
  imports: [SigningModule],
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
