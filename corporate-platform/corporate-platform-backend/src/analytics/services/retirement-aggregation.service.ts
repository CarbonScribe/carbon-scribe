import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RetirementAggregation,
  RetirementAggregationDocument,
} from '../schemas/retirement-aggregation.schema';

@Injectable()
export class RetirementAggregationService {
  private readonly logger = new Logger(RetirementAggregationService.name);

  constructor(
    private readonly retirementTrackerService: RetirementTrackerService,
    @InjectModel(RetirementAggregation.name)
    private readonly aggregationModel: Model<RetirementAggregationDocument>,
  ) {}

  // Scheduled aggregation (every 5 minutes) - Batch Processing
  @Cron(CronExpression.EVERY_5_MINUTES)
  async aggregateRetirementData() {
    this.logger.log('Starting scheduled retirement data batch aggregation...');

    const events =
      await this.retirementTrackerService.getRecentRetirementEvents();
    if (!events || events.length === 0) {
      this.logger.log('No new events found to aggregate.');
      return;
    }

    const aggregates = this.aggregate(events);

    for (const agg of aggregates) {
      await this.aggregationModel.updateOne(
        { key: agg.key },
        { $set: agg },
        { upsert: true },
      );
    }
    this.logger.log('Scheduled retirement data aggregation complete.');
  }

  // ─── FULL REAL-TIME IMPLEMENTATION ──────────────────────────────────────
  // Atomically increments database aggregates immediately when webhooks trigger
  async aggregateRealtime(event: any) {
    if (!event || !event.retiredAt || !event.amount) {
      this.logger.warn('Received malformed real-time event. Skipping.');
      return;
    }

    try {
      this.logger.log(
        `Processing real-time retirement event for entity: ${event.entity}`,
      );

      // 1. Generate keys matching the batch aggregator's schema formula
      const date = new Date(event.retiredAt);
      const period = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const key = `${period}:${event.entity}:${event.assetType}:${event.project}`;

      // 2. Perform an atomic update using Mongo's $inc operator.
      // This prevents race conditions if multiple webhooks arrive at once!
      await this.aggregationModel.updateOne(
        { key },
        {
          $setOnInsert: {
            key,
            period,
            entity: event.entity,
            assetType: event.assetType,
            project: event.project,
          },
          $inc: { totalRetired: event.amount },
        },
        { upsert: true },
      );

      this.logger.log(`Real-time database upsert successful for key: ${key}`);
    } catch (error) {
      this.logger.error(
        'Failed to process real-time event aggregation:',
        error,
      );
    }
  }

  // Aggregation logic (group by time/entity/asset/project)
  aggregate(events: any[]): any[] {
    const map = new Map<string, any>();
    for (const event of events) {
      const date = new Date(event.retiredAt);
      const period = date.toISOString().slice(0, 10);
      const key = `${period}:${event.entity}:${event.assetType}:${event.project}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          period,
          entity: event.entity,
          assetType: event.assetType,
          project: event.project,
          totalRetired: 0,
        });
      }
      map.get(key).totalRetired += event.amount;
    }
    return Array.from(map.values());
  }

  // API methods for controllers
  async getSummary() {
    const all = await this.aggregationModel.find();
    const totalRetired = all.reduce((sum, agg) => sum + agg.totalRetired, 0);

    const byPeriod = {} as Record<string, number>;
    for (const agg of all) {
      byPeriod[agg.period] = (byPeriod[agg.period] || 0) + agg.totalRetired;
    }
    return {
      totalRetired,
      byPeriod,
    };
  }

  async getTrends() {
    const all = await this.aggregationModel.find().sort({ period: 1 });
    const trends: { period: string; totalRetired: number }[] = [];
    const map = new Map<string, number>();

    for (const agg of all) {
      map.set(agg.period, (map.get(agg.period) || 0) + agg.totalRetired);
    }
    for (const [period, totalRetired] of map.entries()) {
      trends.push({ period, totalRetired });
    }
    trends.sort((a, b) => a.period.localeCompare(b.period));
    return trends;
  }

  async getBreakdown() {
    const all = await this.aggregationModel.find();
    const byEntity: Record<string, number> = {};
    const byAssetType: Record<string, number> = {};
    const byProject: Record<string, number> = {};

    for (const agg of all) {
      byEntity[agg.entity] = (byEntity[agg.entity] || 0) + agg.totalRetired;
      byAssetType[agg.assetType] =
        (byAssetType[agg.assetType] || 0) + agg.totalRetired;
      byProject[agg.project] = (byProject[agg.project] || 0) + agg.totalRetired;
    }
    return {
      byEntity,
      byAssetType,
      byProject,
    };
  }
}

// import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import {
//   RetirementAggregation,
//   RetirementAggregationDocument,
// } from '../schemas/retirement-aggregation.schema';

// @Injectable()
// export class RetirementAggregationService {
//   private readonly logger = new Logger(RetirementAggregationService.name);

//   constructor(
//     private readonly retirementTrackerService: RetirementTrackerService,
//     @InjectModel(RetirementAggregation.name)
//     private readonly aggregationModel: Model<RetirementAggregationDocument>,
//   ) {}

//   // Scheduled aggregation (every 5 minutes)
//   @Cron(CronExpression.EVERY_5_MINUTES)
//   async aggregateRetirementData() {
//     this.logger.log('Starting retirement data aggregation...');
//     // 1. Fetch new retirement events from the tracker contract
//     const events =
//       await this.retirementTrackerService.getRecentRetirementEvents();
//     // 2. Aggregate by time, entity, asset type, project, etc.
//     const aggregates = this.aggregate(events);
//     // 3. Store/update in DB for fast queries
//     for (const agg of aggregates) {
//       await this.aggregationModel.updateOne(
//         { key: agg.key },
//         { $set: agg },
//         { upsert: true },
//       );
//     }
//     this.logger.log('Retirement data aggregation complete.');
//   }

//   // Real-time aggregation (can be called from webhook/event handler)
//   async aggregateRealtime(event: any) {
//     // ...aggregate and update DB as above
//   }

//   // Aggregation logic (group by time/entity/asset/project)
//   aggregate(events: any[]): any[] {
//     // Group by period (day), entity, assetType, project
//     const map = new Map<string, any>();
//     for (const event of events) {
//       // Assume event has: retiredAt, entity, assetType, project, amount
//       const date = new Date(event.retiredAt);
//       const period = date.toISOString().slice(0, 10); // YYYY-MM-DD
//       const key = `${period}:${event.entity}:${event.assetType}:${event.project}`;
//       if (!map.has(key)) {
//         map.set(key, {
//           key,
//           period,
//           entity: event.entity,
//           assetType: event.assetType,
//           project: event.project,
//           totalRetired: 0,
//         });
//       }
//       map.get(key).totalRetired += event.amount;
//     }
//     return Array.from(map.values());
//   }

//   // API methods for controllers
//   async getSummary() {
//     // Return total retired, by period, etc.
//     const all = await this.aggregationModel.find();
//     const totalRetired = all.reduce((sum, agg) => sum + agg.totalRetired, 0);
//     // By period (e.g., day)
//     const byPeriod = {} as Record<string, number>;
//     for (const agg of all) {
//       byPeriod[agg.period] = (byPeriod[agg.period] || 0) + agg.totalRetired;
//     }
//     return {
//       totalRetired,
//       byPeriod,
//     };
//   }

//   async getTrends() {
//     // Return time-series data for retirements
//     const all = await this.aggregationModel.find().sort({ period: 1 });
//     // Group by period
//     const trends: { period: string; totalRetired: number }[] = [];
//     const map = new Map<string, number>();
//     for (const agg of all) {
//       map.set(agg.period, (map.get(agg.period) || 0) + agg.totalRetired);
//     }
//     for (const [period, totalRetired] of map.entries()) {
//       trends.push({ period, totalRetired });
//     }
//     trends.sort((a, b) => a.period.localeCompare(b.period));
//     return trends;
//   }

//   async getBreakdown() {
//     // Return breakdowns by entity, assetType, project
//     const all = await this.aggregationModel.find();
//     const byEntity: Record<string, number> = {};
//     const byAssetType: Record<string, number> = {};
//     const byProject: Record<string, number> = {};
//     for (const agg of all) {
//       byEntity[agg.entity] = (byEntity[agg.entity] || 0) + agg.totalRetired;
//       byAssetType[agg.assetType] =
//         (byAssetType[agg.assetType] || 0) + agg.totalRetired;
//       byProject[agg.project] = (byProject[agg.project] || 0) + agg.totalRetired;
//     }
//     return {
//       byEntity,
//       byAssetType,
//       byProject,
//     };
//   }
// }
