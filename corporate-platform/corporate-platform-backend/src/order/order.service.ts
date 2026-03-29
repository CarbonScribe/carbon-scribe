import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { TransactionService } from './services/transaction.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly historyService: HistoryService,
    private readonly trackingService: TrackingService,
    private readonly invoiceService: InvoiceService,
    private readonly transactionService: TransactionService,
  ) {}

  getOrders(companyId: string, query: OrderQueryDto) {
    return this.historyService.getOrders(companyId, query);
  }

  getOrderById(companyId: string, orderId: string) {
    return this.historyService.getOrderById(companyId, orderId);
  }

  getOrderStats(companyId: string) {
    return this.historyService.getStats(companyId);
  }

  getOrderStatus(companyId: string, orderId: string) {
    return this.trackingService.getOrderStatus(companyId, orderId);
  }

  generateInvoice(companyId: string, orderId: string, res: Response) {
    return this.invoiceService.generateInvoice(companyId, orderId, res);
  }

  getTransactions(companyId: string, query: TransactionQueryDto) {
    return this.transactionService.getTransactions(companyId, query);
  }

  getTransactionById(companyId: string, transactionId: string) {
    return this.transactionService.getTransactionById(companyId, transactionId);
  }

  exportTransactionsCsv(companyId: string) {
    return this.transactionService.exportCsv(companyId);
  }
}
