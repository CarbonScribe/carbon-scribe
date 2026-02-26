import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OrderService } from './order.service';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { OrderQueryDto } from './dto/order-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly historyService: HistoryService,
    private readonly trackingService: TrackingService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: OrderQueryDto,
  ) {
    return this.historyService.getOrders(user.companyId, query);
  }

  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.orderService.getStats(user.companyId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.findById(id, user.companyId);
  }

  @Get(':id/status')
  async getStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.trackingService.getOrderStatus(id, user.companyId);
  }

  @Get(':id/invoice')
  async downloadInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.invoiceService.generateInvoice(
      id,
      user.companyId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${id}.pdf`,
    );
    res.send(buffer);
  }
}
