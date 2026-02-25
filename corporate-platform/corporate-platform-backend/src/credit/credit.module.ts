import { Module } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { ListingService } from './services/listing.service';
import { DetailsService } from './services/details.service';
import { QualityService } from './services/quality.service';
import { AvailabilityService } from './services/availability.service';
import { ComparisonService } from './services/comparison.service';
import { DatabaseModule } from '../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CreditController],
  providers: [
    CreditService,
    ListingService,
    DetailsService,
    QualityService,
    AvailabilityService,
    ComparisonService,
  ],
  exports: [CreditService],
})
export class CreditModule {}
