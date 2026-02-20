import { Module } from '@nestjs/common';
import { StellarService } from './stellar.service';

@Module({
  providers: [StellarService],
})
export class StellarModule {}
