import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OrderService } from './order.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CREDIT_VIEW,
  PORTFOLIO_VIEW,
  PORTFOLIO_EXPORT,
} from '../rbac/constants/permissions.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
@Controller('api/v1')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ── Orders ───────────────────────────────────────────────────────────────

  @Get('orders')
  @Permissions(CREDIT_VIEW)
  getOrders(@CurrentUser() user: JwtPayload, @Query() query: OrderQueryDto) {
    return this.orderService.getOrders(user.companyId, query);
  }

  /**
   * Static route `/orders/stats` MUST be declared before the
   * parameterised route `/orders/:id` so Express matches it first.
   */
  @Get('orders/stats')
  @Permissions(PORTFOLIO_VIEW)
  getOrderStats(@CurrentUser() user: JwtPayload) {
    return this.orderService.getOrderStats(user.companyId);
  }

  @Get('orders/:id')
  @Permissions(CREDIT_VIEW)
  getOrderById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.getOrderById(user.companyId, id);
  }

  @Get('orders/:id/status')
  @Permissions(CREDIT_VIEW)
  getOrderStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.getOrderStatus(user.companyId, id);
  }

  @Get('orders/:id/invoice')
  @Permissions(PORTFOLIO_VIEW)
  getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.orderService.generateInvoice(user.companyId, id, res);
  }

  // ── Transactions ─────────────────────────────────────────────────────────

  @Get('transactions')
  @Permissions(PORTFOLIO_VIEW)
  getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() query: TransactionQueryDto,
  ) {
    return this.orderService.getTransactions(user.companyId, query);
  }

  /**
   * Static route `/transactions/export/csv` MUST be declared before
   * `/transactions/:id` to avoid `export` being treated as an id param.
   */
  @Get('transactions/export/csv')
  @Permissions(PORTFOLIO_EXPORT)
  async exportTransactionsCsv(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const csv = await this.orderService.exportTransactionsCsv(user.companyId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=transactions.csv',
    );
    res.send(csv);
  }

  @Get('transactions/:id')
  @Permissions(PORTFOLIO_VIEW)
  getTransactionById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.getTransactionById(user.companyId, id);
  }
}
