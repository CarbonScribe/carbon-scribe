import { Module, forwardRef } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { TransferService } from './transfer.service';
import { StellarController } from './stellar.controller';
import { SorobanService } from './soroban.service';
import { OwnershipEventListener } from './soroban/events/ownership-event.listener';
import { OwnershipHistoryModule } from '../audit/ownership-history/ownership-history.module';
import { KeyManagementService } from './services/key-management.service';
import { WalletService } from './services/wallet.service';
import { BalanceService } from './services/balance.service';
import { StellarAuthGuard } from './guards/stellar-auth.guard';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../shared/database/database.module';

@Module({
  imports: [
    forwardRef(() => OwnershipHistoryModule),
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [StellarController],
  providers: [
    StellarService,
    TransferService,
    SorobanService,
    OwnershipEventListener,
    KeyManagementService,
    WalletService,
    BalanceService,
    StellarAuthGuard,
  ],
  exports: [
    StellarService,
    TransferService,
    SorobanService,
    OwnershipEventListener,
    KeyManagementService,
    WalletService,
    BalanceService,
    StellarAuthGuard,
  ],
})
export class StellarModule {}
