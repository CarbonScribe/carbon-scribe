import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './services/upload.service';
import { RetrievalService } from './services/retrieval.service';
import { PinningService } from './services/pinning.service';
import { CertificateIpfsService } from './services/certificate-ipfs.service';

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
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit, adjust as needed
    }),
  )
  async uploadFile(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    // Require idempotencyKey
    if (!body?.idempotencyKey) {
      return { error: 'idempotencyKey is required' };
    }
    return this.upload.upload(file, {
      ...(body || {}),
      companyId: user.companyId,
    });
  }

  @Post('batch/upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB per file
    }),
  )
  async batchUpload(
    @UploadedFile() files: any[],
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    // Each file must have an idempotencyKey in the body (as array or map)
    const idempotencyKeys = Array.isArray(body.idempotencyKeys)
      ? body.idempotencyKeys
      : [];
    if (!files || files.length === 0) {
      return { error: 'No files uploaded' };
    }
    for (let i = 0; i < files.length; i++) {
      if (!idempotencyKeys[i]) {
        return {
          error: `File ${files[i].originalname} missing idempotencyKey`,
        };
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
