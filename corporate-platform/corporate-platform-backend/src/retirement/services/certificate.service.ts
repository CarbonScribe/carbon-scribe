import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { CertificateData } from '../interfaces/certificate.interface';
import { Response } from 'express';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';

const STELLAR_EXPLORER_BASE =
  process.env.STELLAR_EXPLORER_URL ||
  'https://stellar.expert/explorer/public/tx';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly retirementTrackerService: RetirementTrackerService,
  ) {}

  /** Fetch on-chain proof for a retirement transaction. Returns null if unavailable. */
  private async fetchOnChainProof(
    transactionHash?: string,
  ): Promise<Record<string, unknown> | null> {
    if (!transactionHash) return null;
    try {
      return await this.retirementTrackerService.getRetirementRecord(
        transactionHash,
      );
    } catch (err) {
      this.logger.warn(
        `Could not fetch on-chain proof for tx ${transactionHash}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async generateCertificate(data: CertificateData, res: Response) {
    const onChainProof = await this.fetchOnChainProof(data.transactionHash);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fillColor('#1a5c38')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('CARBON CREDIT RETIREMENT CERTIFICATE', { align: 'center' })
      .moveDown(0.3);

    doc
      .fillColor('#888888')
      .fontSize(9)
      .font('Helvetica')
      .text('Issued by CarbonScribe Registry · Powered by Stellar Blockchain', {
        align: 'center',
      })
      .moveDown(0.8);

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#1a5c38')
      .lineWidth(1.5)
      .stroke()
      .moveDown(0.8);

    // Certificate meta
    doc
      .fillColor('#444444')
      .fontSize(10)
      .font('Helvetica')
      .text(`Certificate Number: ${data.certificateNumber}`, { align: 'right' })
      .text(`Date Issued: ${data.retirementDate.toDateString()}`, {
        align: 'right',
      })
      .moveDown(0.8);

    // ── Body ─────────────────────────────────────────────────────────────────
    doc
      .fontSize(12)
      .fillColor('#444444')
      .text('This certifies that', { align: 'center' })
      .moveDown(0.4);

    doc
      .fontSize(18)
      .fillColor('#1a5c38')
      .font('Helvetica-Bold')
      .text(data.companyName, { align: 'center' })
      .moveDown(0.4);

    doc
      .fillColor('#444444')
      .font('Helvetica')
      .fontSize(12)
      .text('has permanently retired', { align: 'center' })
      .moveDown(0.4);

    doc
      .fontSize(20)
      .fillColor('#27ae60')
      .font('Helvetica-Bold')
      .text(`${data.creditAmount.toLocaleString()} Carbon Credits (tCO₂e)`, {
        align: 'center',
      })
      .moveDown(0.4);

    doc
      .fillColor('#444444')
      .font('Helvetica')
      .fontSize(12)
      .text('from the project:', { align: 'center' })
      .moveDown(0.4);

    doc
      .fontSize(14)
      .font('Helvetica-Oblique')
      .text(data.creditProject, { align: 'center' })
      .moveDown(0.8);

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Retirement Purpose: ${data.creditPurpose}`)
      .moveDown(0.3);

    // ── On-Chain Proof ────────────────────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke()
      .moveDown(0.6);

    doc
      .fillColor('#1a5c38')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('On-Chain Proof & Verification')
      .moveDown(0.4);

    doc.font('Helvetica').fontSize(9).fillColor('#444444');

    if (data.transactionHash) {
      doc.text(`Transaction Hash:  ${data.transactionHash}`).moveDown(0.2);
      const explorerUrl = `${STELLAR_EXPLORER_BASE}/${data.transactionHash}`;
      doc
        .fillColor('#1a5c38')
        .text(`Stellar Explorer:  ${explorerUrl}`, {
          link: explorerUrl,
          underline: true,
        })
        .fillColor('#444444')
        .moveDown(0.2);
    }

    const contractId = this.retirementTrackerService.getContractId();
    doc.text(`Smart Contract:    ${contractId}`).moveDown(0.2);

    if (onChainProof) {
      const tokenId = onChainProof['token_id'] ?? onChainProof['tokenId'];
      const retiringEntity =
        onChainProof['retiring_entity'] ?? onChainProof['retiringEntity'];
      const onChainTs = onChainProof['timestamp'] ?? onChainProof['retired_at'];
      const reason =
        onChainProof['reason'] ?? onChainProof['retirement_reason'];

      if (tokenId) doc.text(`Token ID:          ${tokenId}`).moveDown(0.2);
      if (retiringEntity)
        doc.text(`Retiring Entity:   ${retiringEntity}`).moveDown(0.2);
      if (onChainTs)
        doc
          .text(
            `On-Chain Timestamp: ${new Date(Number(onChainTs) * 1000).toISOString()}`,
          )
          .moveDown(0.2);
      if (reason) doc.text(`Retirement Reason: ${reason}`).moveDown(0.2);
    } else {
      doc
        .fillColor('#888888')
        .text(
          'On-chain record could not be retrieved at time of issuance. ' +
            'The transaction hash above can be independently verified on the Stellar network.',
        )
        .fillColor('#444444')
        .moveDown(0.2);
    }

    if (data.ipfsHash) {
      doc.text(`IPFS Hash:         ${data.ipfsHash}`).moveDown(0.2);
    }

    // ── QR Code placeholder (text-based link) ────────────────────────────────
    if (data.transactionHash) {
      doc.moveDown(0.4);
      doc
        .fillColor('#888888')
        .fontSize(8)
        .text(
          `Scan or visit the Stellar Explorer link above to independently verify this retirement on-chain.`,
          { align: 'center' },
        )
        .fillColor('#444444');
    }

    // ── Compliance Statement ──────────────────────────────────────────────────
    doc
      .moveDown(0.8)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke()
      .moveDown(0.6);

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text(
        'This retirement is permanent and irreversible. The retired credits have been ' +
          'permanently removed from circulation on the Stellar blockchain, preventing any ' +
          'possibility of double counting. This certificate is valid for compliance, audit, ' +
          'and public disclosure purposes under GHG Protocol, CSRD, and Article 6 frameworks.',
        { align: 'justify' },
      )
      .moveDown(0.6);

    // ── Footer ────────────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor('#888888')
      .text('Verified by CarbonScribe Registry', { align: 'center' })
      .text(
        'This document is electronically generated and valid without a physical signature.',
        { align: 'center' },
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
