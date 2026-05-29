import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './services/upload.service';
import { RetrievalService } from './services/retrieval.service';
import { PinningService } from './services/pinning.service';
import { CertificateIpfsService } from './services/certificate-ipfs.service';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_BATCH_SIZE_BYTES,
  resolveStorageClass,
} from './upload-policy.constants';

/** Validate a single file against the centralized upload policy (#342). */
function validateFile(file: any): void {
  if (!file) throw new BadRequestException('No file provided');

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException(
      `File "${file.originalname}" exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException(
      `MIME type "${file.mimetype}" is not allowed. Permitted types: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
    );
  }
}

@Controller('api/v1/ipfs')
@UseGuards(JwtAuthGuard)
export class IpfsController {
  constructor(
    private readonly upload: UploadService,
    private readonly retrieval: RetrievalService,
    private readonly pinning: PinningService,
    private readonly certificate: CertificateIpfsService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadFile(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    validateFile(file);

    if (!body?.idempotencyKey) {
      throw new BadRequestException('idempotencyKey is required');
    }

    const storageClass = resolveStorageClass(body.documentType || '');

    return this.upload.upload(file, {
      ...(body || {}),
      companyId: user.companyId,
      storageClass,
    });
  }

  @Post('batch/upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async batchUpload(
    @UploadedFiles() files: any[],
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_BATCH_SIZE_BYTES) {
      throw new BadRequestException(
        `Total batch size exceeds the maximum of ${MAX_BATCH_SIZE_BYTES / (1024 * 1024)} MB`,
      );
    }

    files.forEach(validateFile);

    const idempotencyKeys: string[] = Array.isArray(body.idempotencyKeys)
      ? body.idempotencyKeys
      : [];

    for (let i = 0; i < files.length; i++) {
      if (!idempotencyKeys[i]) {
        throw new BadRequestException(
          `File "${files[i].originalname}" is missing an idempotencyKey`,
        );
      }
    }

    return this.upload.batchUpload(files, {
      ...(body.metadata || {}),
      idempotencyKeys,
      companyId: user.companyId,
    });
  }

  @Post('batch/pin')
  async batchPin(@Body() body: { cids: string[] }) {
    return this.pinning.pinBatch(body.cids || []);
  }

  @Post('certificate/:retirementId')
  async anchorCertificate(
    @Param('retirementId') retirementId: string,
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.certificate.anchorCertificate(retirementId, {
      ...(body || {}),
      companyId: user.companyId,
    });
  }

  @Get('certificate/:cid/verify')
  async verifyCertificate(@Param('cid') cid: string) {
    return this.certificate.verifyCertificate(cid);
  }

  @Get('documents')
  async listDocuments(@CurrentUser() user: JwtPayload) {
    return this.upload.listDocuments(user.companyId);
  }

  @Get('documents/:referenceId')
  async byReference(@Param('referenceId') referenceId: string) {
    return this.upload.getByReference(referenceId);
  }

  @Get(':cid')
  async getByCid(@Param('cid') cid: string) {
    return this.retrieval.get(cid);
  }

  @Get(':cid/metadata')
  async getMetadata(@Param('cid') cid: string) {
    return this.retrieval.getMetadata(cid);
  }

  @Delete(':cid')
  async unpin(@Param('cid') cid: string, @Query('force') force?: string) {
    return this.pinning.unpin(cid, { force: !!force });
  }
}
