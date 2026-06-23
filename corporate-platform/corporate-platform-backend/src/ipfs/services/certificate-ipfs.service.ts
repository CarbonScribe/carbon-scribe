import { Injectable, Logger } from '@nestjs/common';
import { UploadService } from './upload.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { RetrievalService } from './retrieval.service';
import { CertificateDeadLetterService } from './certificate-dead-letter.service';

@Injectable()
export class CertificateIpfsService {
  private readonly logger = new Logger(CertificateIpfsService.name);

  constructor(
    private readonly upload: UploadService,
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly deadLetter: CertificateDeadLetterService,
  ) {}

  /**
   * Public entry point for anchoring a certificate to IPFS.
   *
   * On failure the attempt is dead-lettered (#400) so it can be retried or
   * repaired without manual database forensics, rather than surfacing as silent
   * data loss. Returns the anchoring result, or an error envelope that also
   * includes the dead-letter `failureId` for traceability.
   */
  async anchorCertificate(retirementId: string, body: any) {
    if (!body || (!body.content && !body.cid))
      return { error: 'missing content or cid' };

    try {
      return await this.performAnchor(retirementId, body);
    } catch (err: any) {
      const message = err?.message || String(err);
      this.logger.error(
        `Certificate anchoring failed (retirementId=${retirementId}): ${message}`,
      );
      const failure = await this.deadLetter.recordFailure({
        retirementId,
        companyId: body.companyId,
        certificateData: body,
        error: message,
      });
      return {
        error: 'certificate-anchoring-failed',
        details: message,
        failureId: failure.id,
        status: failure.status,
      };
    }
  }

  /**
   * Performs the actual anchoring work. Throws on failure so the caller (public
   * entry point or retry scheduler) can decide how to dead-letter the attempt.
   */
  async performAnchor(retirementId: string, body: any) {
    if (body.cid) {
      // Attach an already-pinned CID to the retirement record.
      const cid = body.cid;
      await this.prisma.ipfsDocument.create({
        data: {
          companyId: body.companyId || 'unknown',
          documentType: 'CERTIFICATE',
          referenceId: retirementId,
          ipfsCid: cid,
          ipfsGateway:
            process.env.PINATA_GATEWAY ||
            process.env.IPFS_GATEWAY_FALLBACK ||
            'https://gateway.pinata.cloud/ipfs/',
          fileName: body.fileName || `${retirementId}.pdf`,
          fileSize: body.fileSize || 0,
          mimeType: body.mimeType || 'application/pdf',
          pinned: true,
          pinnedAt: new Date(),
          metadata: body.metadata || {},
        },
      });
      return { cid, attached: true };
    }

    const buffer = Buffer.from(body.content, 'base64');
    const fakeFile: any = {
      originalname: body.fileName || `${retirementId}.pdf`,
      buffer,
      size: buffer.length,
      mimetype: body.mimeType || 'application/pdf',
    };
    const res = await this.upload.upload(fakeFile, {
      documentType: 'CERTIFICATE',
      referenceId: retirementId,
      companyId: body.companyId,
    });

    // upload() returns an error envelope instead of throwing; surface it as a
    // throw so the dead-letter workflow captures the failure context.
    if (res?.error) {
      throw new Error(
        `${res.error}${res.details ? `: ${typeof res.details === 'string' ? res.details : JSON.stringify(res.details)}` : ''}`,
      );
    }

    return res;
  }

  async verifyCertificate(cid: string) {
    // Basic verification: ensure record exists and return stored metadata
    const doc = await this.prisma.ipfsDocument.findUnique({
      where: { ipfsCid: cid },
    });
    if (!doc) return { cid, verified: false, reason: 'not-found' };

    const retrieval = await this.retrieval.get(cid);
    if (retrieval?.error === 'integrity-check-failed') {
      return {
        cid,
        verified: false,
        reason: 'integrity-check-failed',
        expectedHash: retrieval.expectedHash,
        actualHash: retrieval.actualHash,
      };
    }

    if (retrieval?.error) {
      return {
        cid,
        verified: false,
        reason: 'not-retrievable',
        details: retrieval.details,
      };
    }

    return {
      cid,
      verified: true,
      integrityVerified: retrieval.integrityVerified,
      contentHash: retrieval.contentHash,
      doc,
    };
  }
}
