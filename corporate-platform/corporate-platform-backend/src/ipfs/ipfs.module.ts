import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { IpfsConfig } from './ipfs.config';
import { UploadService } from './services/upload.service';
import { RetrievalService } from './services/retrieval.service';
import { PinningService } from './services/pinning.service';
import { CertificateIpfsService } from './services/certificate-ipfs.service';
import { IpfsController } from './ipfs.controller';
import { DatabaseModule } from '../shared/database/database.module';
import { PinataProvider } from './providers/pinata.provider';
import { IPFS_PROVIDER } from './interfaces/ipfs-provider.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    IpfsConfig,
    // Register the active provider via injection token.
    // To switch providers, replace PinataProvider with another IIpfsProvider implementation.
    {
      provide: IPFS_PROVIDER,
      useClass: PinataProvider,
    },
    PinataProvider,
    IpfsService,
    UploadService,
    RetrievalService,
    PinningService,
    CertificateIpfsService,
  ],
  controllers: [IpfsController],
  exports: [
    IPFS_PROVIDER,
    IpfsService,
    IpfsConfig,
    UploadService,
    RetrievalService,
    PinningService,
    CertificateIpfsService,
  ],
})
export class IpfsModule {}
