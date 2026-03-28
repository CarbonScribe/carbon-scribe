import { Module, forwardRef } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { TransferService } from './transfer.service';
import { StellarController } from './stellar.controller';
import { SorobanService } from './soroban.service';
import { OwnershipEventListener } from './soroban/events/ownership-event.listener';
import { OwnershipHistoryModule } from '../audit/ownership-history/ownership-history.module';

@Module({
  imports: [forwardRef(() => OwnershipHistoryModule)],
  controllers: [StellarController],
  providers: [
    StellarService,
    TransferService,
    SorobanService,
    OwnershipEventListener,
  ],
  exports: [
    StellarService,
    TransferService,
    SorobanService,
    OwnershipEventListener,
  ],
})
export class StellarModule {}
