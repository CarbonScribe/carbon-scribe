import { Module, OnModuleInit } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StellarWebhookService } from './services/stellar-webhook.service';
import { HorizonListenerService } from './services/horizon-listener.service';
import { SorobanEventService } from './services/soroban-event.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { RetryHandlerService } from './services/retry-handler.service';
import { TransferConfirmationHandler } from './handlers/transfer-confirmation.handler';
import { RetirementConfirmationHandler } from './handlers/retirement-confirmation.handler';
import { MintEventHandler } from './handlers/mint-event.handler';
import { BalanceChangeHandler } from './handlers/balance-change.handler';
import { DatabaseModule } from '../shared/database/database.module';
import { ConfigModule } from '../config/config.module';
import { EventBusModule } from '../event-bus/event-bus.module';

@Module({
  imports: [DatabaseModule, ConfigModule, EventBusModule],
  controllers: [WebhooksController],
  providers: [
    StellarWebhookService,
    HorizonListenerService,
    SorobanEventService,
    WebhookDispatcherService,
    RetryHandlerService,
    TransferConfirmationHandler,
    RetirementConfirmationHandler,
    MintEventHandler,
    BalanceChangeHandler,
  ],
  exports: [StellarWebhookService, WebhookDispatcherService],
})
export class WebhooksModule implements OnModuleInit {
  constructor(
    private readonly dispatcher: WebhookDispatcherService,
    private readonly transferHandler: TransferConfirmationHandler,
    private readonly retirementHandler: RetirementConfirmationHandler,
    private readonly mintHandler: MintEventHandler,
    private readonly balanceHandler: BalanceChangeHandler,
  ) {}

  onModuleInit() {
    // Manually register handlers with the dispatcher
    this.dispatcher.registerHandler(this.transferHandler);
    this.dispatcher.registerHandler(this.retirementHandler);
    this.dispatcher.registerHandler(this.mintHandler);
    this.dispatcher.registerHandler(this.balanceHandler);
  }
}
