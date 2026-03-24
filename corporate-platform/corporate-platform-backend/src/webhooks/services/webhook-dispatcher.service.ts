import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  IWebhookHandler,
  WebhookPayload,
} from '../interfaces/webhook.interface';
import { ProducerService } from '../../event-bus/producer.service';

@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private handlers: IWebhookHandler[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly eventBus: ProducerService,
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

    // 1. Send to Kafka for external consumers
    try {
      await this.eventBus.publish('blockchain-events', {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: payload.eventType,
        source: 'webhooks-service',
        timestamp: payload.timestamp,
        correlationId: `corr_${Date.now()}`,
        data: payload.data,
        version: '1.0',
        companyId: payload.data.companyId,
      });
    } catch (error) {
      this.logger.error('Failed to publish event to Kafka', error);
    }

    // 2. Handle internally
    const supportedHandlers = this.handlers.filter((h) =>
      h.supports(payload.eventType),
    );

    if (supportedHandlers.length === 0) {
      this.logger.warn(
        `No internal handlers found for event: ${payload.eventType}`,
      );
      return;
    }

    await Promise.all(
      supportedHandlers.map(async (handler) => {
        try {
          await handler.handle(payload.data);
        } catch (error) {
          this.logger.error(
            `Handler ${handler.constructor.name} failed for event ${payload.eventType}`,
            error,
          );
          // Retry logic would be triggered here
        }
      }),
    );
  }
}
