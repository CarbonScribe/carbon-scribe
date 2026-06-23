import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { IpfsConfig } from './ipfs.config';
import { UploadService } from './services/upload.service';
import { RetrievalService } from './services/retrieval.service';
import { PinningService } from './services/pinning.service';
import { CertificateIpfsService } from './services/certificate-ipfs.service';
import { CertificateDeadLetterService } from './services/certificate-dead-letter.service';
import { CertificateRetrySchedulerService } from './services/certificate-retry-scheduler.service';
import { CertificateFailureNotificationService } from './services/certificate-failure-notification.service';
import { IpfsController } from './ipfs.controller';
import { CertificateFailureController } from './certificate-failure.controller';
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
    // Dead-letter & recovery workflow for failed certificate anchoring (#400)
    CertificateDeadLetterService,
    CertificateFailureNotificationService,
    CertificateRetrySchedulerService,
  ],
  controllers: [IpfsController, CertificateFailureController],
  exports: [
    IPFS_PROVIDER,
    IpfsService,
    IpfsConfig,
    UploadService,
    RetrievalService,
    PinningService,
    CertificateIpfsService,
    CertificateDeadLetterService,
  ],
})
export class IpfsModule {}
