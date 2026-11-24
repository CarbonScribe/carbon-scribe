import { Test, TestingModule } from '@nestjs/testing';
import {
  DashboardCacheInvalidationListener,
  DASHBOARD_CACHE_INVALIDATION_TOPICS,
} from './dashboard-cache-invalidation.listener';
import { ConsumerService } from '../../event-bus/consumer.service';
import { DashboardService } from './dashboard.service';
import { Event } from '../../event-bus/interfaces/event.interface';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    type: 'order.completed',
    source: 'corporate-platform',
    timestamp: new Date().toISOString(),
    correlationId: 'order-1',
    companyId: 'company-1',
    data: {},
    version: '1.0',
    ...overrides,
  };
}

describe('DashboardCacheInvalidationListener', () => {
  let listener: DashboardCacheInvalidationListener;
  let consumerService: jest.Mocked<Pick<ConsumerService, 'consume'>>;
  let dashboardService: jest.Mocked<Pick<DashboardService, 'invalidateCache'>>;

  beforeEach(async () => {
    consumerService = { consume: jest.fn().mockResolvedValue(undefined) };
    dashboardService = { invalidateCache: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardCacheInvalidationListener,
        { provide: ConsumerService, useValue: consumerService },
        { provide: DashboardService, useValue: dashboardService },
      ],
    }).compile();

    listener = module.get<DashboardCacheInvalidationListener>(
      DashboardCacheInvalidationListener,
    );
  });

  describe('onModuleInit', () => {
    it('subscribes to the dashboard-affecting topics via the shared Kafka consumer', async () => {
      await listener.onModuleInit();

      expect(consumerService.consume).toHaveBeenCalledWith(
        'dashboard-cache-invalidation',
        DASHBOARD_CACHE_INVALIDATION_TOPICS,
        expect.any(Function),
      );
    });
  });

  describe('handleEvent (#742)', () => {
    it('invalidates the correct company cache on a purchase-completed event', async () => {
      await listener.handleEvent(
        makeEvent({ type: 'order.completed', companyId: 'company-1' }),
      );

      expect(dashboardService.invalidateCache).toHaveBeenCalledWith(
        'company-1',
      );
    });

    it('invalidates the correct company cache on a retirement-confirmed event', async () => {
      await listener.handleEvent(
        makeEvent({ type: 'retirement.confirmed', companyId: 'company-2' }),
      );

      expect(dashboardService.invalidateCache).toHaveBeenCalledWith(
        'company-2',
      );
    });

    it('invalidates the correct company cache on a transfer-confirmed event', async () => {
      await listener.handleEvent(
        makeEvent({ type: 'transfer.confirmed', companyId: 'company-3' }),
      );

      expect(dashboardService.invalidateCache).toHaveBeenCalledWith(
        'company-3',
      );
    });

    it('leaves unaffected companies alone — only the event companyId is invalidated', async () => {
      await listener.handleEvent(
        makeEvent({ type: 'order.completed', companyId: 'company-1' }),
      );

      expect(dashboardService.invalidateCache).toHaveBeenCalledTimes(1);
      expect(dashboardService.invalidateCache).not.toHaveBeenCalledWith(
        'company-99',
      );
    });

    it('ignores event types unrelated to dashboard data', async () => {
      await listener.handleEvent(makeEvent({ type: 'order.cancelled' }));

      expect(dashboardService.invalidateCache).not.toHaveBeenCalled();
    });

    it('does nothing and logs a warning when the event has no companyId', async () => {
      await listener.handleEvent(
        makeEvent({ type: 'order.completed', companyId: undefined }),
      );

      expect(dashboardService.invalidateCache).not.toHaveBeenCalled();
    });
  });
});
