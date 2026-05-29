import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { CacheModule } from '../cache/cache.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [
    CacheModule,
    EventBusModule,
    IpfsModule,
    StellarModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
