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
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.upload.upload(file, {
      ...(body || {}),
      companyId: user.companyId,
    });
  }

  @Post('batch/upload')
  async batchUpload(
    @Body()
    body: {
      files: Array<{ fileName: string; content: string }>;
      metadata?: any;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.upload.batchUpload(body.files || [], {
      ...(body.metadata || {}),
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
