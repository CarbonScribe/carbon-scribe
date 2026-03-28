import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoice(
    companyId: string,
    orderId: string,
    res: Response,
  ): Promise<void> {
    const prisma = this.prisma as any;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { credit: { select: { projectName: true } } },
        },
        company: { select: { name: true } },
      },
    });

    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'completed') {
      throw new BadRequestException(
        'Invoice is only available for completed orders',
      );
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderNumber}.pdf`,
    );
    doc.pipe(res);

    // ── Header ─────────────────────────────────────────────────────────────
    doc
      .fillColor('#1a3c5e')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('INVOICE', { align: 'center' })
      .moveDown(0.5);

    const invoiceDateStr = order.paidAt
      ? new Date(order.paidAt).toDateString()
      : new Date(order.createdAt).toDateString();

    doc
      .fillColor('#444444')
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice Number: ${order.orderNumber}`, { align: 'right' })
      .text(`Date: ${invoiceDateStr}`, { align: 'right' })
      .text(`Status: ${order.status.toUpperCase()}`, { align: 'right' })
      .moveDown();

    // ── Company Info ───────────────────────────────────────────────────────
    doc
      .fontSize(12)
      .fillColor('#2c3e50')
      .font('Helvetica-Bold')
      .text('Bill To:')
      .font('Helvetica')
      .fontSize(11)
      .text(order.company?.name || 'N/A')
      .moveDown();

    // ── Items Table Header ─────────────────────────────────────────────────
    const tableTop = doc.y;
    doc
      .fillColor('#1a3c5e')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Project', 50, tableTop, { width: 200 })
      .text('Qty (tCO₂)', 250, tableTop, { width: 80, align: 'right' })
      .text('Price/ton', 330, tableTop, { width: 80, align: 'right' })
      .text('Subtotal', 410, tableTop, { width: 100, align: 'right' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(510, doc.y).stroke().moveDown(0.5);

    // ── Line Items ─────────────────────────────────────────────────────────
    doc.font('Helvetica').fillColor('#444444').fontSize(10);
    for (const item of order.items) {
      const y = doc.y;
      doc
        .text(item.credit?.projectName || 'Carbon Credit', 50, y, {
          width: 200,
        })
        .text(Number(item.quantity).toLocaleString(), 250, y, {
          width: 80,
          align: 'right',
        })
        .text(`$${Number(item.price).toFixed(2)}`, 330, y, {
          width: 80,
          align: 'right',
        })
        .text(`$${Number(item.subtotal).toLocaleString()}`, 410, y, {
          width: 100,
          align: 'right',
        })
        .moveDown();
    }

    // ── Totals ─────────────────────────────────────────────────────────────
    doc
      .moveDown(0.5)
      .moveTo(300, doc.y)
      .lineTo(510, doc.y)
      .stroke()
      .moveDown(0.5);

    const subtotalY = doc.y;
    doc
      .font('Helvetica')
      .text('Subtotal:', 300, subtotalY, { width: 110, align: 'right' })
      .text(`$${Number(order.subtotal).toLocaleString()}`, 410, subtotalY, {
        width: 100,
        align: 'right',
      })
      .moveDown(0.5);

    const feeY = doc.y;
    doc
      .text('Service Fee (5%):', 300, feeY, { width: 110, align: 'right' })
      .text(`$${Number(order.serviceFee).toLocaleString()}`, 410, feeY, {
        width: 100,
        align: 'right',
      })
      .moveDown(0.5);

    const totalY = doc.y;
    doc
      .font('Helvetica-Bold')
      .text('Total:', 300, totalY, { width: 110, align: 'right' })
      .text(`$${Number(order.total).toLocaleString()}`, 410, totalY, {
        width: 100,
        align: 'right',
      })
      .moveDown(2);

    // ── Payment Info ───────────────────────────────────────────────────────
    if (order.paymentMethod) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#666666')
        .text(`Payment Method: ${order.paymentMethod}`);
    }

    if (order.transactionHash) {
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text(`Transaction Hash: ${order.transactionHash}`);
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    doc
      .moveDown(4)
      .fontSize(9)
      .fillColor('#999999')
      .text('Generated by Carbon Scribe Platform', { align: 'center' })
      .text(
        'This document is electronically generated and valid without signature.',
        { align: 'center' },
      );

    doc.end();
  }
}
