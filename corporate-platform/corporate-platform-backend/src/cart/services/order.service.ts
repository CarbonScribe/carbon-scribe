import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { OrderQueryDto } from '../dto/checkout.dto';
import { OrderDetails, OrderListResult } from '../interfaces/order.interface';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  async getOrders(
    companyId: string,
    query: OrderQueryDto,
  ): Promise<OrderListResult> {
    const { status, startDate, endDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { credit: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: data.map((order) => this.toOrderDetails(order)),
      total,
      page,
      limit,
    };
  }

  async getOrderById(
    companyId: string,
    orderId: string,
  ): Promise<OrderDetails> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { credit: true },
        },
        company: true,
      },
    });

    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderDetails(order);
  }

  async generateInvoice(
    companyId: string,
    orderId: string,
    res: Response,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { credit: true },
        },
        company: true,
      },
    });

    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('Order not found');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Header
    doc
      .fillColor('#444444')
      .fontSize(20)
      .text('INVOICE', { align: 'center' })
      .moveDown();

    doc
      .fontSize(10)
      .text(`Invoice Number: ${order.orderNumber}`, { align: 'right' })
      .text(`Date: ${order.createdAt.toDateString()}`, { align: 'right' })
      .text(`Status: ${order.status.toUpperCase()}`, { align: 'right' })
      .moveDown();

    // Company info
    doc
      .fontSize(12)
      .fillColor('#2c3e50')
      .font('Helvetica-Bold')
      .text((order as any).company?.name || 'Company', { align: 'left' })
      .moveDown();

    // Items table header
    doc
      .fillColor('#444444')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Project', 50, doc.y, { width: 200 })
      .text('Qty (tCO₂)', 250, doc.y - 12, { width: 80, align: 'right' })
      .text('Price/ton', 330, doc.y - 12, { width: 80, align: 'right' })
      .text('Subtotal', 410, doc.y - 12, { width: 100, align: 'right' })
      .moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(510, doc.y).stroke().moveDown(0.5);

    // Items
    doc.font('Helvetica').fontSize(10);
    for (const item of order.items) {
      const y = doc.y;
      doc
        .fillColor('#444444')
        .text((item as any).credit?.projectName || 'Credit', 50, y, {
          width: 200,
        })
        .text(item.quantity.toLocaleString(), 250, y, {
          width: 80,
          align: 'right',
        })
        .text(`$${item.price.toFixed(2)}`, 330, y, {
          width: 80,
          align: 'right',
        })
        .text(`$${item.subtotal.toLocaleString()}`, 410, y, {
          width: 100,
          align: 'right',
        })
        .moveDown();
    }

    // Totals
    doc.moveDown().moveTo(300, doc.y).lineTo(510, doc.y).stroke().moveDown(0.5);

    doc
      .text(`Subtotal:`, 300, doc.y, { width: 110, align: 'right' })
      .text(`$${order.subtotal.toLocaleString()}`, 410, doc.y - 12, {
        width: 100,
        align: 'right',
      })
      .moveDown(0.5);

    doc
      .text(`Service Fee (5%):`, 300, doc.y, { width: 110, align: 'right' })
      .text(`$${order.serviceFee.toLocaleString()}`, 410, doc.y - 12, {
        width: 100,
        align: 'right',
      })
      .moveDown(0.5);

    doc
      .font('Helvetica-Bold')
      .text(`Total:`, 300, doc.y, { width: 110, align: 'right' })
      .text(`$${order.total.toLocaleString()}`, 410, doc.y - 12, {
        width: 100,
        align: 'right',
      })
      .moveDown(2);

    // Payment info
    if (order.transactionHash) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#666666')
        .text(`Transaction Hash: ${order.transactionHash}`, { align: 'left' });
    }

    // Footer
    doc
      .moveDown(4)
      .fontSize(9)
      .fillColor('#999999')
      .text('Generated by Carbon Scribe Platform', { align: 'center' })
      .text(
        'This document is electronically generated and valid without signature.',
        { align: 'center' },
      );

    // Stream to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderNumber}.pdf`,
    );

    doc.pipe(res);
    doc.end();
  }

  private toOrderDetails(order: any): OrderDetails {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      companyId: order.companyId,
      userId: order.userId,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        creditId: item.creditId,
        projectName: item.credit?.projectName || '',
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal,
      serviceFee: order.serviceFee,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      paidAt: order.paidAt,
      transactionHash: order.transactionHash,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt,
    };
  }
}
