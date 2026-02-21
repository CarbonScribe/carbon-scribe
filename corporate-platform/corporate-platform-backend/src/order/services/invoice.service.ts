import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoice(orderId: string, companyId: string): Promise<Buffer> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'completed') {
      throw new NotFoundException(
        'Invoice is only available for completed orders',
      );
    }

    // Dynamic import of pdfkit for PDF generation
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();

      // Invoice Info
      const invoiceNumber = `INV-${order.orderNumber}`;
      doc
        .fontSize(10)
        .text(`Invoice Number: ${invoiceNumber}`)
        .text(`Order Number: ${order.orderNumber}`)
        .text(`Date: ${order.createdAt.toISOString().split('T')[0]}`)
        .text(`Company ID: ${order.companyId}`)
        .moveDown();

      // Payment Info
      if (order.paymentMethod) {
        doc.text(`Payment Method: ${order.paymentMethod}`);
      }
      if (order.transactionHash) {
        doc.text(`Transaction Hash: ${order.transactionHash}`);
      }
      if (order.paidAt) {
        doc.text(`Paid At: ${order.paidAt.toISOString().split('T')[0]}`);
      }
      doc.moveDown();

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

      // Items header
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Item', 50, doc.y, { width: 200 })
        .text('Qty', 250, doc.y - doc.currentLineHeight(), {
          width: 50,
          align: 'right',
        })
        .text('Unit Price', 310, doc.y - doc.currentLineHeight(), {
          width: 80,
          align: 'right',
        })
        .text('Total', 400, doc.y - doc.currentLineHeight(), {
          width: 100,
          align: 'right',
        })
        .moveDown(0.5);

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.5);

      // Items
      doc.font('Helvetica');
      for (const item of order.items) {
        const yPos = doc.y;
        doc
          .text(item.creditName, 50, yPos, { width: 200 })
          .text(item.quantity.toString(), 250, yPos, {
            width: 50,
            align: 'right',
          })
          .text(`$${item.unitPrice.toFixed(2)}`, 310, yPos, {
            width: 80,
            align: 'right',
          })
          .text(`$${item.totalPrice.toFixed(2)}`, 400, yPos, {
            width: 100,
            align: 'right',
          })
          .moveDown(0.5);
      }

      // Totals section
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.5);

      doc
        .text(`Subtotal: $${order.subtotal.toFixed(2)}`, { align: 'right' })
        .text(`Service Fee: $${order.serviceFee.toFixed(2)}`, {
          align: 'right',
        })
        .font('Helvetica-Bold')
        .text(`Total: $${order.total.toFixed(2)}`, { align: 'right' });

      doc.end();
    });
  }
}
