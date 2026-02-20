import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';

@Module({
  providers: [ComplianceService],
  controllers: [ComplianceController],
})
export class ComplianceModule {}
