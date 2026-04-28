import { Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { TransferService } from './transfer.service';
import { StellarController } from './stellar.controller';
import { SorobanModule } from './soroban/soroban.module';

@Module({
  imports: [SorobanModule],
  controllers: [StellarController],
  providers: [StellarService, TransferService],
  exports: [StellarService, TransferService, SorobanModule],
})
export class StellarModule {}
