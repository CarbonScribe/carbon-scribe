import { Injectable } from '@nestjs/common';
import { ListingService } from './services/listing.service';
import { DetailsService } from './services/details.service';
import { QualityService } from './services/quality.service';
import { AvailabilityService } from './services/availability.service';
import { ComparisonService } from './services/comparison.service';
import { CreditQueryDto } from './dto/credit-query.dto';
import { CreditUpdateDto } from './dto/credit-update.dto';

@Injectable()
export class CreditService {
  constructor(
    private listingService: ListingService,
    private detailsService: DetailsService,
    private qualityService: QualityService,
    private availabilityService: AvailabilityService,
    private comparisonService: ComparisonService,
  ) {}

  findAll(query: CreditQueryDto) {
    return this.listingService.findAll(query);
  }

  findOne(id: string) {
    return this.detailsService.findOne(id);
  }

  getQualityMetrics(id: string) {
    return this.qualityService.getQualityMetrics(id);
  }

  getAvailableOnly(page?: number, limit?: number) {
    return this.availabilityService.getAvailableOnly(page, limit);
  }

  updateStatus(id: string, updateDto: CreditUpdateDto) {
    return this.availabilityService.updateStatus(id, updateDto);
  }

  getStats() {
    return this.detailsService.getStats();
  }

  getFilters() {
    return this.listingService.getFilters();
  }

  compareProjects(projectIds: string[]) {
    return this.comparisonService.compareProjects(projectIds);
  }
}
