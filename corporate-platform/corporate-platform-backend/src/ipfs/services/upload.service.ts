import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream, unlink } from 'fs';
import { IpfsConfig } from '../ipfs.config';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  IIpfsProvider,
  IPFS_PROVIDER,
  IpfsFile,
} from '../interfaces/ipfs-provider.interface';
import {
  resolveStorageClass,
  STORAGE_CLASS_POLICIES,
  DocumentStorageClass,
} from '../upload-policy.constants';
import * as NodeClam from 'clamscan';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly config: IpfsConfig,
    private readonly prisma: PrismaService,
    @Inject(IPFS_PROVIDER) private readonly provider: IIpfsProvider,
  ) {}

  private async computeSha256(file: any): Promise<string> {
    const hash = createHash('sha256');

    if (file?.path) {
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(file.path);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve());
      });
      return hash.digest('hex');
    }

    if (file?.buffer) {
      hash.update(file.buffer);
      return hash.digest('hex');
    }

    throw new Error('No file data available for hashing');
  }

  async upload(file: any, metadata: any) {
    if (!file) return { error: 'No file provided' };

    const idempotencyKey = metadata?.idempotencyKey;
    const companyId = metadata?.companyId || 'unknown';
    const documentType = metadata?.documentType || 'UNKNOWN';

    // Resolve storage class (#341)
    const storageClass: DocumentStorageClass =
      metadata?.storageClass ?? resolveStorageClass(documentType);
    const policy = STORAGE_CLASS_POLICIES[storageClass];

    let contentHash: string;
    try {
      contentHash = await this.computeSha256(file);
    } catch (hashErr: any) {
      this.logger.error(
        `Hashing failed for ${file?.originalname || 'unknown file'}:`,
        hashErr,
      );
      if (file.path) unlink(file.path, () => {});
      return {
        error: 'File hash computation failed',
        details: hashErr?.message || hashErr,
      };
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.ipfsDocument.findFirst({
        where: { companyId, idempotencyKey },
      });
      if (existing) {
        return { cid: existing.ipfsCid, record: existing, idempotent: true };
      }
    }

    // Antivirus scan
    try {
      const clamscan = await new NodeClam().init({
        removeInfected: false,
        quarantineInfected: false,
        scanLog: null,
        debugMode: false,
        fileList: null,
        scanRecursively: false,
        clamdscan: {
          socket: false,
          host: '127.0.0.1',
          port: 3310,
          timeout: 60000,
          localFallback: true,
        },
      });

      const scanResult = file.path
        ? await clamscan.isInfected(file.path)
        : file.buffer
          ? await clamscan.scanBuffer(file.buffer)
          : null;

      if (!scanResult) return { error: 'No file data provided' };

      if (scanResult.isInfected) {
        this.logger.warn(
          `File ${file.originalname} failed antivirus scan: ${scanResult.viruses}`,
        );
        if (file.path) unlink(file.path, () => {});
        return {
          error: 'File failed antivirus scan',
          details: scanResult.viruses,
        };
      }
      this.logger.log(`File ${file.originalname} passed antivirus scan.`);
    } catch (scanErr: any) {
      this.logger.error(
        `Antivirus scan error for ${file.originalname}:`,
        scanErr,
      );
      if (file.path) unlink(file.path, () => {});
      return {
        error: 'Antivirus scan failed',
        details: scanErr?.message || scanErr,
      };
    }

    const ipfsFile: IpfsFile = {
      path: file.path,
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    try {
      // Use provider abstraction (#340)
      const cid = await this.provider.pinFile(ipfsFile, {
        ...metadata,
        storageClass,
      });

      const record = await this.prisma.ipfsDocument.create({
        data: {
          companyId,
          documentType,
          referenceId: metadata.referenceId || '',
          ipfsCid: cid,
          ipfsGateway: this.config.gateway,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          pinned: true,
          pinnedAt: new Date(),
          metadata: { ...metadata, storageClass, policy },
          idempotencyKey: idempotencyKey || null,
          contentHash,
        },
      });

      if (file.path) unlink(file.path, () => {});
      return { cid, record: { ...record, contentHash }, storageClass };
    } catch (err: any) {
      this.logger.error(
        `${this.provider.providerName} upload failed`,
        err?.message || err,
      );
      const cid = `mockcid-${Date.now()}`;
      const record = await this.prisma.ipfsDocument.create({
        data: {
          companyId,
          documentType,
          referenceId: metadata.referenceId || '',
          ipfsCid: cid,
          ipfsGateway: this.config.fallback,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          pinned: false,
          pinnedAt: new Date(),
          metadata: { ...metadata, storageClass, policy },
          idempotencyKey: idempotencyKey || null,
          contentHash,
        },
      });
      if (file.path) unlink(file.path, () => {});
      return {
        cid,
        record: { ...record, contentHash },
        storageClass,
        warning: 'pinning-failed-mock-cid',
      };
    }
  }

  async batchUpload(files: any[], metadata: any) {
    const idempotencyKeys: string[] = metadata.idempotencyKeys || [];
    return Promise.all(
      files.map((file, i) =>
        this.upload(file, { ...metadata, idempotencyKey: idempotencyKeys[i] }),
      ),
    );
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
