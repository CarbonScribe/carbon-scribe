import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/database/database.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TransactionController } from './transaction.controller';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { TransactionService } from './services/transaction.service';

@Module({
    imports: [DatabaseModule],
    controllers: [OrderController, TransactionController],
    providers: [
        OrderService,
        HistoryService,
        TrackingService,
        InvoiceService,
        TransactionService,
    ],
    exports: [OrderService],
})
export class OrderModule { }
