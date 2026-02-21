import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { OrderService } from './order.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { OrderQueryDto } from './dto/order-query.dto';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly trackingService: TrackingService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Get()
  async findAll(
    @Query() query: OrderQueryDto,
    @Headers('x-company-id') companyId: string,
  ) {
    const resolvedCompanyId = companyId || 'default-company';
    return this.orderService.findAll(resolvedCompanyId, query);
  }

  @Get('stats')
  async getStats(@Headers('x-company-id') companyId: string) {
    const resolvedCompanyId = companyId || 'default-company';
    return this.orderService.getStats(resolvedCompanyId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-company-id') companyId: string,
  ) {
    const resolvedCompanyId = companyId || 'default-company';
    const order = await this.orderService.findById(id, resolvedCompanyId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  @Get(':id/status')
  async getStatus(
    @Param('id') id: string,
    @Headers('x-company-id') companyId: string,
  ) {
    const resolvedCompanyId = companyId || 'default-company';
    const status = await this.trackingService.getOrderStatus(
      id,
      resolvedCompanyId,
    );
    if (!status) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return status;
  }

  @Get(':id/invoice')
  async downloadInvoice(
    @Param('id') id: string,
    @Headers('x-company-id') companyId: string,
    @Res() res: Response,
  ) {
    const resolvedCompanyId = companyId || 'default-company';
    const pdfBuffer = await this.invoiceService.generateInvoice(
      id,
      resolvedCompanyId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
