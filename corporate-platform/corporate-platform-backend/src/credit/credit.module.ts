import { Module } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { ListingService } from './services/listing.service';
import { DetailsService } from './services/details.service';
import { QualityService } from './services/quality.service';
import { AvailabilityService } from './services/availability.service';
import { ComparisonService } from './services/comparison.service';
import { PrismaService } from '../shared/database/prisma.service';

@Module({
  controllers: [CreditController],
  providers: [
    CreditService,
    ListingService,
    DetailsService,
    QualityService,
    AvailabilityService,
    ComparisonService,
    PrismaService,
  ],
  exports: [CreditService],
})
export class CreditModule {}
