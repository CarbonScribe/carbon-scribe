import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { CertificateData } from '../interfaces/certificate.interface';
import { Response } from 'express';

@Injectable()
export class CertificateService {
  async generateCertificate(data: CertificateData, res: Response) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Header
    doc
      .fillColor('#444444')
      .fontSize(20)
      .text('RETIREMENT CERTIFICATE', { align: 'center' })
      .moveDown();

    doc
      .fontSize(10)
      .text(`Certificate Number: ${data.certificateNumber}`, { align: 'right' })
      .text(`Date: ${data.retirementDate.toDateString()}`, { align: 'right' })
      .moveDown();

    // Body
    doc
      .fontSize(12)
      .text('This certificate confirms that', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(16)
      .fillColor('#2c3e50')
      .font('Helvetica-Bold')
      .text(data.companyName, { align: 'center' })
      .moveDown(0.5);

    doc
      .fillColor('#444444')
      .font('Helvetica')
      .fontSize(12)
      .text(`has successfully retired`, { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(16)
      .fillColor('#27ae60')
      .font('Helvetica-Bold')
      .text(`${data.creditAmount} Carbon Credits`, { align: 'center' })
      .moveDown(0.5);

    doc
      .fillColor('#444444')
      .font('Helvetica')
      .fontSize(12)
      .text(`from the project:`, { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(14)
      .font('Helvetica-Oblique')
      .text(data.creditProject, { align: 'center' })
      .moveDown();

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Purpose: ${data.creditPurpose}`, { align: 'left' })
      .moveDown(0.5);

    if (data.transactionHash) {
      doc.text(`Blockchain Transaction: ${data.transactionHash}`, {
        align: 'left',
      });
    }

    if (data.ipfsHash) {
      doc.text(`IPFS Hash: ${data.ipfsHash}`, { align: 'left' });
    }

    // Footer
    doc
      .moveDown(4)
      .fontSize(10)
      .text('Verified by Carbon Scribe Registry', { align: 'center' })
      .text(
        'This document is electronically generated and valid without signature.',
        {
          align: 'center',
        },
      );

    // Stream to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=certificate-${data.certificateNumber}.pdf`,
    );

    doc.pipe(res);
    doc.end();
  }
}
