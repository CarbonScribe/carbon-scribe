import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as PDFDocument from 'pdfkit';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoice(orderId: string, companyId: string): Promise<Buffer> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId },
      include: {
        items: true,
        company: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" not found`);
    }

    if (order.status !== 'COMPLETED') {
      throw new NotFoundException(
        'Invoices are only available for completed orders',
      );
    }

    return this.buildPdf(order);
  }

  private buildPdf(order: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();

      // Invoice details
      const invoiceNumber = `INV-${order.orderNumber}`;
      doc
        .fontSize(10)
        .text(`Invoice Number: ${invoiceNumber}`)
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`)
        .text(`Company: ${order.company?.name || 'N/A'}`)
        .moveDown();

      // Order info
      doc
        .fontSize(12)
        .text(`Order: ${order.orderNumber}`)
        .text(`Status: ${order.status}`)
        .text(`Payment Method: ${order.paymentMethod || 'N/A'}`)
        .moveDown();

      // Items header
      doc.fontSize(10).text('Items:', { underline: true }).moveDown(0.5);

      // Items table
      for (const item of order.items) {
        doc.text(
          `${item.creditName} - ${item.projectName} | Qty: ${item.quantity} | Unit: $${item.unitPrice.toFixed(2)} | Total: $${item.totalPrice.toFixed(2)}`,
        );
      }

      doc.moveDown();

      // Totals
      doc
        .fontSize(10)
        .text(`Subtotal: $${order.subtotal.toFixed(2)}`, { align: 'right' })
        .text(`Service Fee: $${order.serviceFee.toFixed(2)}`, {
          align: 'right',
        })
        .fontSize(12)
        .text(`Total: $${order.total.toFixed(2)}`, {
          align: 'right',
          underline: true,
        });

      if (order.transactionHash) {
        doc
          .moveDown()
          .fontSize(8)
          .text(`Transaction Hash: ${order.transactionHash}`);
      }

      doc.end();
    });
  }
}
