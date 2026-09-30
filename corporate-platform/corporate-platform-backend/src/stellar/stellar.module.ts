import { Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { TransferService } from './transfer.service';
import { StellarController } from './stellar.controller';
import { SorobanModule } from './soroban/soroban.module';
import { SigningModule } from './signing/signing.module';

@Module({
  imports: [SorobanModule, SigningModule],
  controllers: [StellarController],
  providers: [StellarService, TransferService],
  exports: [StellarService, TransferService, SorobanModule],
})
export class StellarModule {}
