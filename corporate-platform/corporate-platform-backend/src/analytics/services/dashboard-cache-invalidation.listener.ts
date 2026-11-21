import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumerService } from '../../event-bus/consumer.service';
import { Event } from '../../event-bus/interfaces/event.interface';
import { DashboardService } from './dashboard.service';

/**
 * Topics carrying the domain events that change a company's dashboard
 * numbers (#742): a confirmed retirement, a completed purchase, or a
 * confirmed credit transfer. 'order-events'/'order.completed' is published
 * today by CheckoutService; the retirement/transfer topics and event types
 * follow the same naming convention for whichever service later publishes
 * those confirmations.
 */
export const DASHBOARD_CACHE_INVALIDATION_TOPICS = [
  'order-events',
  'retirement-events',
  'transfer-events',
];

export const DASHBOARD_CACHE_INVALIDATING_EVENT_TYPES = new Set([
  'retirement.confirmed',
  'order.completed',
  'transfer.confirmed',
]);

const CONSUMER_GROUP_ID = 'dashboard-cache-invalidation';

/**
 * Subscribes to retirement/purchase/transfer confirmation events via the
 * existing Kafka event-bus consumer (#742) and evicts the affected
 * company's dashboard cache keys, so a read right after one of these events
 * recomputes fresh data instead of serving a stale TTL'd value for up to the
 * full 30-60 minute cache window.
 */
@Injectable()
export class DashboardCacheInvalidationListener implements OnModuleInit {
  private readonly logger = new Logger(
    DashboardCacheInvalidationListener.name,
  );

  constructor(
    private readonly consumerService: ConsumerService,
    private readonly dashboardService: DashboardService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumerService.consume(
      CONSUMER_GROUP_ID,
      DASHBOARD_CACHE_INVALIDATION_TOPICS,
      (event) => this.handleEvent(event),
    );
  }

  async handleEvent(event: Event): Promise<void> {
    if (!DASHBOARD_CACHE_INVALIDATING_EVENT_TYPES.has(event.type)) {
      return;
    }
    if (!event.companyId) {
      this.logger.warn(
        `Received ${event.type} event ${event.id} with no companyId; cannot invalidate a company's dashboard cache`,
      );
      return;
    }

    await this.dashboardService.invalidateCache(event.companyId);
    this.logger.debug(
      `Invalidated dashboard cache for company ${event.companyId} after ${event.type}`,
    );
  }
}
