import { Injectable } from '@nestjs/common';
import { ListingService } from './services/listing.service';
import { DetailsService } from './services/details.service';
import { QualityService } from './services/quality.service';
import { AvailabilityService } from './services/availability.service';
import { ComparisonService } from './services/comparison.service';

@Injectable()
export class CreditService {
  constructor(
    private readonly listing: ListingService,
    private readonly details: DetailsService,
    private readonly quality: QualityService,
    private readonly availability: AvailabilityService,
    private readonly comparison: ComparisonService,
  ) {}

  list(query, companyId?: string) {
    return this.listing.list(query, companyId);
  }

  getById(id: string, companyId?: string) {
    return this.details.getById(id, companyId);
  }

  getQuality(id: string, companyId?: string) {
    return this.quality.getQualityBreakdown(id, companyId);
  }

  listAvailable(page: number, limit: number, companyId?: string) {
    return this.availability.listAvailable(page, limit, companyId);
  }

  updateStatus(
    id: string,
    status: string,
    availableAmount?: number,
    companyId?: string,
  ) {
    return this.availability.updateStatus(
      id,
      status,
      availableAmount,
      companyId,
    );
  }

  compare(projectIds: string[], companyId?: string) {
    return this.comparison.compare(projectIds, companyId);
  }

  async stats() {
    // minimal stats for now
    return { totalAvailable: 0, avgPrice: 0 };
  }
}
