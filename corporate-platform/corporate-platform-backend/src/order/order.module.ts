import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { TransactionService } from './services/transaction.service';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [SecurityModule],
  providers: [
    OrderService,
    HistoryService,
    TrackingService,
    InvoiceService,
    TransactionService,
  ],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
