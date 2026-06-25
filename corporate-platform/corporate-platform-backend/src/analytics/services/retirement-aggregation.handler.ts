import { Injectable, Logger } from '@nestjs/common';
import {
  IWebhookHandler,
  WebhookPayload,
} from '../../webhooks/interfaces/webhook.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RetirementAggregation,
  RetirementAggregationDocument,
} from '../schemas/retirement-aggregation.schema';

@Injectable()
export class RetirementAggregationHandler implements IWebhookHandler {
  private readonly logger = new Logger(RetirementAggregationHandler.name);

  constructor(
    @InjectModel(RetirementAggregation.name)
    private readonly aggregationModel: Model<RetirementAggregationDocument>,
  ) {}

  supports(eventType: string): boolean {
    return eventType === 'contract.retirement';
  }

  async handle(payload: WebhookPayload): Promise<void> {
    // Extract event data
    const event = payload.data;
    // Assume event has: retiredAt, entity, assetType, project, amount
    if (
      !event.retiredAt ||
      !event.entity ||
      !event.assetType ||
      !event.project ||
      !event.amount
    ) {
      this.logger.warn('Invalid retirement event payload', event);
      return;
    }
    const date = new Date(event.retiredAt);
    const period = date.toISOString().slice(0, 10);
    const key = `${period}:${event.entity}:${event.assetType}:${event.project}`;
    await this.aggregationModel.updateOne(
      { key },
      {
        $set: {
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
    this.logger.log(`Aggregated retirement event for key: ${key}`);
  }
}
