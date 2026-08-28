import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  IWebhookHandler,
  WebhookPayload,
} from '../interfaces/webhook.interface';
import { ProducerService } from '../../event-bus/producer.service';
import { UnitOfWorkService } from '../../shared/database/unit-of-work.service';

@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private handlers: IWebhookHandler[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly eventBus: ProducerService,
    private readonly unitOfWork: UnitOfWorkService,
  ) {}

  onModuleInit() {
    // Handlers will be registered dynamically or manually
    // For this implementation, we'll assume they are registered via the module
  }

  registerHandler(handler: IWebhookHandler) {
    this.handlers.push(handler);
    this.logger.log(`Registered handler: ${handler.constructor.name}`);
  }

  async dispatch(payload: WebhookPayload) {
    this.logger.log(`Dispatching event: ${payload.eventType}`);

    const event = {
      id: `webhook:${payload.eventType}:${payload.data.hash || payload.data.transactionHash || payload.data.accountId || payload.timestamp}`,
      type: payload.eventType,
      source: 'webhooks-service',
      timestamp: payload.timestamp,
      correlationId: `corr:${payload.eventType}:${payload.timestamp}`,
      data: payload.data,
      version: '1.0',
      companyId: payload.data.companyId,
    };

    const supportedHandlers = this.handlers.filter((handler) =>
      handler.supports(payload.eventType),
    );

    await this.unitOfWork.run(async (tx: any) => {
      await this.eventBus.publish('blockchain-events', event, undefined, { tx });

      await Promise.all(
        supportedHandlers.map(async (handler) => {
          await handler.handle(payload.data, tx);
        }),
      );
    });

    await this.eventBus.publishPending(
      'blockchain-events',
      `blockchain-events:${event.id}:${event.type}`,
    );

    if (supportedHandlers.length === 0) {
      this.logger.warn(
        `No internal handlers found for event: ${payload.eventType}`,
      );

      return;
    }
  }
}
