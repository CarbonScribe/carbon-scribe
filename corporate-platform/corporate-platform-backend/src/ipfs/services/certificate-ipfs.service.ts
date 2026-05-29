import { Injectable } from '@nestjs/common';
import { UploadService } from './upload.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { RetrievalService } from './retrieval.service';

@Injectable()
export class CertificateIpfsService {
  constructor(
    private readonly upload: UploadService,
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
  ) {}

  async anchorCertificate(retirementId: string, body: any) {
    // Expect body to contain base64 PDF content or reference to a file
    if (!body || (!body.content && !body.cid))
      return { error: 'missing content or cid' };
    if (body.cid) {
      // attach to retirement record via DB
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
    // Optionally link to retirement service / chain: omitted here; return the result for caller to integrate.
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
