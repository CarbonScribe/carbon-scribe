import { Injectable, Logger } from '@nestjs/common';
import * as FormData from 'form-data';
import axios from 'axios';
import { IpfsConfig } from '../ipfs.config';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly pinataBase = 'https://api.pinata.cloud';

  constructor(
    private readonly config: IpfsConfig,
    private readonly prisma: PrismaService,
  ) {}

  async upload(file: any, metadata: any) {
    if (!file) return { error: 'No file provided' };
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    if (metadata) {
      form.append(
        'pinataMetadata',
        JSON.stringify({ name: file.originalname, keyvalues: metadata }),
      );
    }

    const headers = Object.assign(
      { Authorization: `Bearer ${this.config.jwt}` },
      form.getHeaders(),
    );

    try {
      const res = await axios.post(
        `${this.pinataBase}/pinning/pinFileToIPFS`,
        form,
        { headers, timeout: this.config.timeout },
      );
      const cid = res.data.IpfsHash || res.data.cid || res.data.hash;
      const record = await this.prisma.ipfsDocument.create({
        data: {
          companyId: metadata.companyId || 'unknown',
          documentType: metadata.documentType || 'UNKNOWN',
          referenceId: metadata.referenceId || '',
          ipfsCid: cid,
          ipfsGateway: this.config.gateway,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          pinned: true,
          pinnedAt: new Date(),
          metadata,
        },
      });
      return { cid, record };
    } catch (err) {
      this.logger.error('Pinata upload failed', err?.message || err);
      // fallback: return mock CID based on buffer
      const cid = `mockcid-${Date.now()}`;
      const record = await this.prisma.ipfsDocument.create({
        data: {
          companyId: metadata.companyId || 'unknown',
          documentType: metadata.documentType || 'UNKNOWN',
          referenceId: metadata.referenceId || '',
          ipfsCid: cid,
          ipfsGateway: this.config.fallback,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          pinned: false,
          pinnedAt: new Date(),
          metadata,
        },
      });
      return { cid, record, warning: 'pinning-failed-mock-cid' };
    }
  }

  async batchUpload(
    files: Array<{ fileName: string; content: string }>,
    metadata: any,
  ) {
    const results = [];
    for (const f of files) {
      // create a buffer from base64 if provided
      const buffer = Buffer.from(f.content || '', 'base64');
      const fakeFile: any = {
        originalname: f.fileName,
        buffer,
        size: buffer.length,
        mimetype: 'application/octet-stream',
      };
      // reuse upload
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const res = await this.upload(fakeFile, metadata);
      results.push(res);
    }
    return results;
  }

  async listDocuments(companyId?: string) {
    return this.prisma.ipfsDocument.findMany({
      where: companyId ? { companyId } : {},
    });
  }

  async getByReference(referenceId: string) {
    return this.prisma.ipfsDocument.findMany({ where: { referenceId } });
  }
}
