import { Injectable, Logger } from '@nestjs/common';
import { ComplianceFramework } from '../types/compliance-framework.enum';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';

@Injectable()
export class RetirementHistoryService {
  private readonly logger = new Logger(RetirementHistoryService.name);

  constructor(private readonly retirementTracker: RetirementTrackerService) {}

  /**
   * Query retirement records from the Retirement Tracker contract.
   * Supports filtering by entity, token, time period, and compliance framework.
   */
  async queryRetirements({
    entity,
    tokenId,
    dateFrom,
    dateTo,
    framework,
    assetType,
    project,
  }: {
    entity?: string;
    tokenId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    framework?: ComplianceFramework;
    assetType?: string;
    project?: string;
  }) {
    this.logger.log('Querying retirements', {
      entity,
      tokenId,
      dateFrom,
      dateTo,
      framework,
      assetType,
      project,
    });
    // Fetch recent retirements from contract
    const records = await this.retirementTracker.getRecentRetirementEvents();
    // Filter by parameters
    let filtered = records;
    if (entity) filtered = filtered.filter((r) => r.entity === entity);
    if (tokenId) filtered = filtered.filter((r) => r.tokenId === tokenId);
    if (assetType) filtered = filtered.filter((r) => r.assetType === assetType);
    if (project) filtered = filtered.filter((r) => r.project === project);
    if (dateFrom)
      filtered = filtered.filter((r) => new Date(r.retiredAt) >= dateFrom);
    if (dateTo)
      filtered = filtered.filter((r) => new Date(r.retiredAt) <= dateTo);
    // Framework-specific normalization (placeholder)
    return filtered.map((r) => this.normalizeForFramework(r, framework));
  }

  /**
   * Fetch a single retirement record by tokenId.
   */
  async getRetirementByToken(tokenId: string, framework?: ComplianceFramework) {
    // Try to fetch by tokenId (txHash)
    const record = await this.retirementTracker.getRetirementRecord(tokenId);
    if (!record) return null;
    return this.normalizeForFramework(record, framework);
  }

  /**
   * List all retirements for an entity.
   */
  async listRetirementsByEntity(
    entity: string,
    framework?: ComplianceFramework,
  ) {
    const records = await this.retirementTracker.getRecentRetirementEvents();
    const filtered = records.filter((r) => r.entity === entity);
    return filtered.map((r) => this.normalizeForFramework(r, framework));
  }

  /**
   * Normalize and map on-chain data to compliance reporting schemas.
   */
  normalizeForFramework(record: any, framework?: ComplianceFramework) {
    // Basic normalization; extend for framework-specific mapping
    const base = {
      retiredAt: record.retiredAt,
      entity: record.entity,
      assetType: record.assetType,
      project: record.project,
      amount: record.amount,
      // Add more fields as needed
    };
    // Framework-specific mapping (placeholder)
    switch (framework) {
      case ComplianceFramework.GHG:
        return { ...base, framework: 'GHG Protocol' };
      case ComplianceFramework.CSRD:
        return { ...base, framework: 'CSRD' };
      case ComplianceFramework.CORSIA:
        return { ...base, framework: 'CORSIA' };
      default:
        return base;
    }
  }
}
