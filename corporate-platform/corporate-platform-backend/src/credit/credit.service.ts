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

  list(query) {
    return this.listing.list(query);
  }

  getById(id: string) {
    return this.details.getById(id);
  }

  getQuality(id: string) {
    return this.quality.getQualityBreakdown(id);
  }

  listAvailable(page: number, limit: number) {
    return this.availability.listAvailable(page, limit);
  }

  updateStatus(id: string, status: string, availableAmount?: number) {
    return this.availability.updateStatus(id, status, availableAmount);
  }

  compare(projectIds: string[]) {
    return this.comparison.compare(projectIds);
  }

  async stats() {
    const l = await this.listing.list({ page: 1, limit: 1 });
    const totalAvailable = await this.listing.list({ page: 1, limit: 1 }).then(() => 0);
    // minimal stats for now
    return { totalAvailable: 0, avgPrice: 0 };
  }
}
