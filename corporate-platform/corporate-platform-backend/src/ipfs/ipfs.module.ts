import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { IpfsConfig } from './ipfs.config';
import { UploadService } from './services/upload.service';
import { RetrievalService } from './services/retrieval.service';
import { PinningService } from './services/pinning.service';
import { CertificateIpfsService } from './services/certificate-ipfs.service';
import { IpfsController } from './ipfs.controller';
import { DatabaseModule } from '../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    IpfsService,
    IpfsConfig,
    UploadService,
    RetrievalService,
    PinningService,
    CertificateIpfsService,
  ],
  controllers: [IpfsController],
  exports: [
    IpfsService,
    UploadService,
    RetrievalService,
    PinningService,
    CertificateIpfsService,
  ],
})
export class IpfsModule {}
