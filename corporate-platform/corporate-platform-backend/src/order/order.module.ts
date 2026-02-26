import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { TransactionController } from './transaction.controller';
import { OrderService } from './order.service';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { TransactionService } from './services/transaction.service';

@Module({
  controllers: [OrderController, TransactionController],
  providers: [
    OrderService,
    HistoryService,
    TrackingService,
    InvoiceService,
    TransactionService,
  ],
  exports: [OrderService, TransactionService],
})
export class OrderModule {}
